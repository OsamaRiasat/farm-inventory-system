// What only a real backend can get wrong: two saves at once, retries, who may see and change what,
// and the audit log that nobody can edit. Services run against the test database; permissions over HTTP.
import { expect, test, type APIRequestContext } from "@playwright/test";
import { ApiError } from "@/lib/api/errors";
import { today } from "@/lib/dates";
import { db } from "@/server/db";
import { receiveTransfer, saveIGP, saveOGP } from "@/server/services/slips";
import { stock, testFarm, unique } from "./db";
import { DEMO_PASSWORD } from "./helpers";

const base = () => ({ date: today(), time: "12:00", preparedBy: "Test" });

test("two OGPs racing for the last drill: exactly one is saved, the other gets “Only 0 in stock”", async () => {
  const farmId = await testFarm({ drill: 1 });
  const ogp = () =>
    saveOGP({
      ...base(), farmId, idempotencyKey: unique(), paperNo: unique("OGP"),
      to: { kind: "outside", ms: "Repair shop", reason: "repair" },
      lines: [{ itemId: "drill", qty: 1 }],
    });
  const results = await Promise.allSettled([ogp(), ogp(), ogp()]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  for (const r of results.filter((x) => x.status === "rejected")) {
    expect((r as PromiseRejectedResult).reason).toBeInstanceOf(ApiError);
    expect((r as PromiseRejectedResult).reason).toMatchObject({ id: "err.onlyInStock", values: { n: "0" } });
  }
  expect(await stock(farmId, "drill")).toBe(0);
});

test("receiving the same transfer twice at once makes one IGP", async () => {
  const from = await testFarm({ chips: 10 });
  const to = await testFarm();
  const ogp = await saveOGP({
    ...base(), farmId: from, idempotencyKey: unique(), paperNo: unique(),
    to: { kind: "farm", farmId: to }, lines: [{ itemId: "chips", qty: 10 }],
  });
  const receive = () =>
    receiveTransfer({ ...base(), farmId: to, idempotencyKey: unique(), paperNo: unique(), transferId: ogp.transferId, lines: [{ qtyReceived: 10 }] });
  const results = await Promise.allSettled([receive(), receive()]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ id: "err.transferClosed" });
  expect(await stock(to, "chips")).toBe(10);
});

test("a save retried at the same time (network retry) still makes one slip, one number, one stock change", async () => {
  const farmId = await testFarm();
  const input = {
    ...base(), farmId, idempotencyKey: unique(), paperNo: "IGP-1",
    source: { kind: "supplier", ms: "X" }, lines: [{ itemId: "gloves", qtyChallan: 5, qtyReceived: 5 }],
  };
  const [a, b, c] = await Promise.all([saveIGP(input), saveIGP(input), saveIGP(input)]);
  expect(new Set([a.id, b.id, c.id]).size).toBe(1);
  expect(await db().slip.count({ where: { farmId } })).toBe(1);
  expect(await stock(farmId, "gloves")).toBe(5);
});

test("the audit log can't be changed or deleted", async () => {
  const row = await db().auditEntry.findFirstOrThrow();
  await expect(db().$executeRaw`UPDATE "AuditEntry" SET "user" = 'someone' WHERE id = ${row.id}`).rejects.toThrow(/audit log/);
  await expect(db().$executeRaw`DELETE FROM "AuditEntry" WHERE id = ${row.id}`).rejects.toThrow(/audit log/);
  expect((await db().auditEntry.findUniqueOrThrow({ where: { id: row.id } })).user).toBe(row.user);
});

// ── over HTTP: sign-in and permissions ──

async function login(request: APIRequestContext, username: string) {
  const res = await request.post("/api/auth/login", { data: { username, password: DEMO_PASSWORD } });
  expect(res.ok()).toBe(true);
}

test("signed out: every API call is refused", async ({ request }) => {
  for (const path of ["/api/farms", "/api/slips", "/api/stock?farmId=aw02", "/api/dashboard"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(401);
    expect(await res.json()).toEqual({ error: { id: "err.signedOut" } });
  }
  expect(await (await request.get("/api/me")).json()).toBeNull();
  expect((await request.post("/api/auth/login", { data: { username: "aw05", password: "nope" } })).status()).toBe(400);
});

test("a Farm User sees and changes only their own farm, whatever the request says", async ({ request }) => {
  await login(request, "aw05");
  expect(await (await request.get("/api/me")).json()).toEqual({ role: "farm", farmId: "aw05", userName: "AW-05 Store Keeper" });

  // Another farm's slip, stock and stock card: not found.
  expect((await request.get("/api/slips/AW02-SIS-0203")).status()).toBe(404);
  expect((await request.get("/api/stock?farmId=aw02")).status()).toBe(404);
  expect((await request.get("/api/stock/card?farmId=aw02&itemId=diesel")).status()).toBe(404);
  // A list without a farm is their own farm's.
  const slips = (await (await request.get("/api/slips")).json()) as { farmId: string }[];
  expect(slips.length).toBeGreaterThan(0);
  expect(new Set(slips.map((s) => s.farmId))).toEqual(new Set(["aw05"]));

  // Saving for another farm is refused; nothing is saved there.
  const before = await db().slip.count({ where: { farmId: "aw02" } });
  const slip = {
    date: today(), time: "12:00", preparedBy: "Someone Else", idempotencyKey: unique(), paperNo: unique("IGP"),
    source: { kind: "supplier", ms: "X" }, lines: [{ itemId: "gloves", qtyChallan: 1, qtyReceived: 1 }],
  };
  expect((await request.post("/api/slips/igp", { data: { ...slip, farmId: "aw02" } })).status()).toBe(404);
  expect(await db().slip.count({ where: { farmId: "aw02" } })).toBe(before);

  // On their own farm, Prepared by is the signed-in user, not what the form sent.
  const saved = await request.post("/api/slips/igp", { data: { ...slip, farmId: "aw05" } });
  expect(saved.ok()).toBe(true);
  expect(await saved.json()).toMatchObject({ farmId: "aw05", preparedBy: "AW-05 Store Keeper" });

  // Their own farm's history only (F7 shows who corrected a slip and why).
  const audit = (await (await request.get("/api/audit")).json()) as { farmId?: string }[];
  expect(new Set(audit.map((a) => a.farmId))).toEqual(new Set(["aw05"]));
  expect((await request.get("/api/audit?farmId=aw02")).status()).toBe(404);

  // Admin-only actions are not there for a Farm User.
  expect((await request.get("/api/dashboard")).status()).toBe(404);
  expect((await request.post("/api/slips/AW05-IGP-0001/cancel", { data: { reason: "x" } })).status()).toBe(404);
});

test("a Farm User can open the other farm's OGP that is coming to them", async ({ request }) => {
  // Seed: AW-Hatchery → AW-02, waiting at Patoki.
  const waiting = await db().transfer.findFirstOrThrow({ where: { fromFarmId: "awhatchery", toFarmId: "aw02", status: "in_transit" } });
  await login(request, "aw02");
  expect((await request.get(`/api/slips/${waiting.ogpId}`)).ok()).toBe(true);
  await login(request, "aw05");
  expect((await request.get(`/api/slips/${waiting.ogpId}`)).status()).toBe(404);
});

test("the Admin acts on any farm, and is named in the audit log", async ({ request }) => {
  const farmId = await testFarm({ gloves: 5 });
  await login(request, "admin");
  const res = await request.post("/api/slips/sis", {
    data: { farmId, date: today(), time: "12:00", preparedBy: "x", idempotencyKey: unique(), paperNo: unique("SIS"), lines: [{ itemId: "gloves", qty: 2 }] },
  });
  expect(res.ok()).toBe(true);
  const sis = await res.json();
  expect(sis.preparedBy).toBe("Accounts Admin");
  const cancel = await request.post(`/api/slips/${sis.id}/cancel`, { data: { reason: "Test", by: "someone else" } });
  expect(cancel.ok()).toBe(true);
  expect(await db().auditEntry.findFirst({ where: { recordId: sis.id, action: "cancel" } })).toMatchObject({ user: "Accounts Admin" });
  expect(await stock(farmId, "gloves")).toBe(5);

  // Rule errors come back with the message id, values and the field.
  const over = await request.post("/api/slips/sis", {
    data: { farmId, date: today(), time: "12:00", preparedBy: "x", idempotencyKey: unique(), paperNo: unique("SIS"), lines: [{ itemId: "gloves", qty: 6 }] },
  });
  expect(over.status()).toBe(400);
  expect(await over.json()).toEqual({
    error: { id: "err.onlyInStock", values: { n: "5" }, fieldErrors: [{ path: ["lines", 0, "qty"], id: "err.onlyInStock", values: { n: "5" } }] },
  });
});

test("sign out ends the session on the server", async ({ request }) => {
  await login(request, "aw05");
  expect((await request.get("/api/farms")).ok()).toBe(true);
  await request.post("/api/auth/logout");
  expect((await request.get("/api/farms")).status()).toBe(401);
});
