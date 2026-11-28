// Business rules, tested straight on the server services against the test database (no browser).
// Same Zod schemas and messages the forms use. Each test works on its own throwaway farm (e2e/db.ts).
import { expect, test } from "@playwright/test";
import { ApiError } from "@/lib/api/errors";
import { addDays, today } from "@/lib/dates";
import { returnedPerLine } from "@/lib/slip-rules";
import { db } from "@/server/db";
import { cancelSlip, correctSlip } from "@/server/services/corrections";
import { cancelReturn, listReturns, returnUnused } from "@/server/services/returns";
import { getSlipById, receiveTransfer, saveDR, saveIGP, saveOGP, saveSIS } from "@/server/services/slips";
import { approveItemRequest, listItemRequests, rejectItemRequest, requestItem, saveItem } from "@/server/services/setup";
import { stock, testFarm, unique } from "./db";

// Saves without a seed time happen "now", so the slip date is today (any past date is allowed).
const base = () => ({ date: today(), time: "12:00", preparedBy: "Test" });
const key = () => unique("test");

async function errorOf(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof ApiError) return { id: e.id, values: e.values };
    throw e;
  }
  return null;
}

test("seed has the real slips and never goes below zero", async () => {
  const nos = ["AW02-SIS-0203", "AW02-IGP-1662", "AW02-OGP-1366", "AWHATCHERY-OGP-0046"];
  expect((await db().slip.findMany({ where: { no: { in: nos } } })).map((s) => s.no).sort()).toEqual([...nos].sort());
  const negative = await db().movement.groupBy({
    by: ["farmId", "itemId"],
    _sum: { qtyIn: true, qtyOut: true },
  });
  for (const r of negative) expect((r._sum.qtyIn ?? 0) - (r._sum.qtyOut ?? 0), `${r.farmId} ${r.itemId}`).toBeGreaterThanOrEqual(-0.0005);
  const statuses = (await db().transfer.findMany({ where: { fromFarmId: { startsWith: "aw" } } })).map((t) => t.status);
  expect(statuses).toContain("short");
  expect(statuses.filter((x) => x === "in_transit").length).toBeGreaterThanOrEqual(2);
  expect(await db().slip.count({ where: { status: "corrected" } })).toBeGreaterThanOrEqual(1);
  expect(await db().slip.count({ where: { status: "cancelled" } })).toBeGreaterThanOrEqual(1);
  // One "Return unused" example: AW-01, 60 LTR diesel issued, 15 back.
  const seeded = await db().sisReturn.findMany({ where: { farmId: "aw01" }, include: { lines: true } });
  expect(seeded.map((r) => [r.farmId, r.lines[0].itemId, r.lines[0].qty])).toEqual([["aw01", "diesel", 15]]);
});

test("IGP raises stock by Qty Actual Received, numbers follow the farm's sequence", async () => {
  const farmId = await testFarm();
  const slip = await saveIGP({
    ...base(), farmId, idempotencyKey: key(), paperNo: key(),
    source: { kind: "supplier", ms: "Test Supplier" },
    lines: [{ itemId: "nylon-rope", qtyChallan: 10, qtyReceived: 7 }],
  });
  expect(await stock(farmId, "nylon-rope")).toBe(7);
  expect(slip.no).toBe(`${farmId.toUpperCase()}-IGP-0001`);
  expect(await db().supplier.findUnique({ where: { name: "Test Supplier" } })).not.toBeNull();
});

test("the same save twice creates one slip", async () => {
  const farmId = await testFarm();
  const input = {
    ...base(), farmId, idempotencyKey: key(), paperNo: "IGP-9001",
    source: { kind: "supplier", ms: "X" },
    lines: [{ itemId: "gloves", qtyChallan: 5, qtyReceived: 5 }],
  };
  const a = await saveIGP(input);
  const b = await saveIGP(input);
  expect(b.id).toBe(a.id);
  expect(await db().slip.count({ where: { farmId } })).toBe(1);
  expect(await stock(farmId, "gloves")).toBe(5);
});

test("OGP and SIS can't take stock below zero — same message as the screen", async () => {
  const farmId = await testFarm({ drill: 3, diesel: 100 });
  const err = await errorOf(() =>
    saveOGP({
      ...base(), farmId, idempotencyKey: key(), paperNo: key(),
      to: { kind: "outside", ms: "Repair shop", reason: "repair" },
      lines: [{ itemId: "drill", qty: 4 }],
    }),
  );
  expect(err).toEqual({ id: "err.onlyInStock", values: { n: "3" } });

  // Two lines of the same item count together.
  const err2 = await errorOf(() =>
    saveSIS({
      ...base(), farmId, idempotencyKey: key(), paperNo: key(), shedRows: [],
      lines: [{ itemId: "diesel", qty: 100 }, { itemId: "diesel", qty: 1 }],
    }),
  );
  expect(err2?.id).toBe("err.onlyInStock");
});

test("decimals for any unit (client #21: 0.5 of a Qty item); nothing is saved when a rule fails", async () => {
  const farmId = await testFarm();
  await saveIGP({
    ...base(), farmId, idempotencyKey: key(), paperNo: key(),
    source: { kind: "supplier", ms: "X" },
    lines: [{ itemId: "gloves", qtyChallan: 0.5, qtyReceived: 0.5 }],
  });
  expect(await stock(farmId, "gloves")).toBe(0.5);

  const other = await testFarm();
  const err = await errorOf(() =>
    saveIGP({
      ...base(), farmId: other, idempotencyKey: key(), paperNo: key(),
      source: { kind: "supplier", ms: "X" },
      lines: [{ itemId: "gloves", qtyChallan: 1, qtyReceived: 1 }, { itemId: "no-such-item", qtyChallan: 1, qtyReceived: 1 }],
    }),
  );
  expect(err?.id).toBe("err.pickItem");
  expect(await db().slip.count({ where: { farmId: other } })).toBe(0);
  expect(await db().counter.count({ where: { farmId: other } })).toBe(0);
});

test("transfer: OGP puts goods in transit, receiving can't exceed what was sent, shortfall marks it short", async () => {
  const from = await testFarm({ chips: 50 });
  const to = await testFarm();
  const ogp = await saveOGP({
    ...base(), farmId: from, idempotencyKey: key(), paperNo: key(),
    to: { kind: "farm", farmId: to }, lines: [{ itemId: "chips", qty: 10 }],
  });
  const transfer = () => db().transfer.findUniqueOrThrow({ where: { id: ogp.transferId! } });
  expect((await transfer()).status).toBe("in_transit");

  const tooMuch = await errorOf(() =>
    receiveTransfer({ ...base(), farmId: to, idempotencyKey: key(), paperNo: key(), transferId: ogp.transferId, lines: [{ qtyReceived: 11 }] }),
  );
  expect(tooMuch).toEqual({ id: "err.cannotReceiveMore", values: { n: "10" } });

  // Only the farm it was sent to can receive it.
  const wrongFarm = await errorOf(() =>
    receiveTransfer({ ...base(), farmId: from, idempotencyKey: key(), paperNo: key(), transferId: ogp.transferId, lines: [{ qtyReceived: 1 }] }),
  );
  expect(wrongFarm?.id).toBe("err.notFound");

  await receiveTransfer({ ...base(), farmId: to, idempotencyKey: key(), paperNo: key(), transferId: ogp.transferId, lines: [{ qtyReceived: 8 }] });
  expect((await transfer()).status).toBe("short");
  expect(await stock(to, "chips")).toBe(8);
  expect(await stock(from, "chips")).toBe(40);

  const cancel = await errorOf(() => cancelSlip({ slipId: ogp.id, reason: "x", by: "Admin" }));
  expect(cancel?.id).toBe("err.cannotCancelReceived");
});

test("correction moves stock by the difference only and keeps the original", async () => {
  const farmId = await testFarm({ gloves: 10 });
  const sis = await saveSIS({ ...base(), farmId, idempotencyKey: key(), paperNo: key(), shedRows: [], lines: [{ itemId: "gloves", qty: 4 }] });
  expect(await stock(farmId, "gloves")).toBe(6);
  const corrected = await correctSlip({ slipId: sis.id, lines: [{ index: 0, qty: 2 }], reason: "Typed 4", by: "Admin" });
  expect(await stock(farmId, "gloves")).toBe(8);
  expect((await getSlipById(sis.id)).status).toBe("corrected");
  expect(corrected.correctionOf).toBe(sis.id);
  expect(corrected.no).toBe(`${sis.no}-C1`);
  const log = await db().auditEntry.findFirst({ where: { farmId, action: "correct" } });
  expect(log).toMatchObject({ old: "4", new: "2", reason: "Typed 4", user: "Admin" });
});

test("cancel reverses the slip, and is refused when it would go below zero", async () => {
  const farmId = await testFarm({ "ball-pen": 5 });
  const igp = await saveIGP({
    ...base(), farmId, idempotencyKey: key(), paperNo: key(),
    source: { kind: "supplier", ms: "X" }, lines: [{ itemId: "ball-pen", qtyChallan: 10, qtyReceived: 10 }],
  });
  await saveSIS({ ...base(), farmId, idempotencyKey: key(), paperNo: key(), shedRows: [], lines: [{ itemId: "ball-pen", qty: 15 }] });
  expect((await errorOf(() => cancelSlip({ slipId: igp.id, reason: "x", by: "Admin" })))?.id).toBe("err.wouldGoNegative");

  const other = await saveIGP({
    ...base(), farmId, idempotencyKey: key(), paperNo: key(),
    source: { kind: "supplier", ms: "X" }, lines: [{ itemId: "gloves", qtyChallan: 3, qtyReceived: 3 }],
  });
  await cancelSlip({ slipId: other.id, reason: "Entered twice", by: "Admin" });
  expect(await stock(farmId, "gloves")).toBe(0);
  expect((await getSlipById(other.id)).status).toBe("cancelled");
});

test("slip date: today or any earlier date (previous months too), never in the future", async () => {
  const farmId = await testFarm({ gloves: 10 });
  const sis = (date: string) =>
    errorOf(() => saveSIS({ ...base(), date, farmId, idempotencyKey: key(), paperNo: key(), lines: [{ itemId: "gloves", qty: 1 }] }));
  expect((await sis(addDays(today(), 1)))?.id).toBe("err.dateFuture");
  expect(await sis(addDays(today(), -31))).toBeNull();
  expect(await sis(addDays(today(), -400))).toBeNull();
  const saved = await db().slip.findFirstOrThrow({ where: { farmId }, orderBy: { no: "desc" } });
  expect(saved.date).toBe(addDays(today(), -400));
  expect(saved.postedAt.slice(0, 10)).toBe(today());
});

test("paper slip No.: required, and used once per farm and slip type", async () => {
  const farmId = await testFarm({ gloves: 10 });
  const otherFarm = await testFarm();
  const igp = (farm: string, paperNo: string) =>
    errorOf(() =>
      saveIGP({
        ...base(), farmId: farm, idempotencyKey: key(), paperNo,
        source: { kind: "supplier", ms: "X" }, lines: [{ itemId: "gloves", qtyChallan: 1, qtyReceived: 1 }],
      }),
    );
  expect((await igp(farmId, ""))?.id).toBe("err.enterPaperNo");
  expect(await igp(farmId, "IGP-7777")).toBeNull();
  expect(await igp(farmId, "igp-7777 ")).toEqual({ id: "err.paperNoUsed", values: { no: "igp-7777" } });
  expect(await igp(otherFarm, "IGP-7777")).toBeNull(); // another farm's book
  const sis = await errorOf(() =>
    saveSIS({ ...base(), farmId, idempotencyKey: key(), paperNo: "IGP-7777", lines: [{ itemId: "gloves", qty: 1 }] }),
  );
  expect(sis).toBeNull(); // another slip type
  // The seed's SIS-203 at Patoki has paper No. SIS-0203.
  const dup = await errorOf(() =>
    saveSIS({ ...base(), farmId: "aw02", idempotencyKey: key(), paperNo: "SIS-0203", lines: [{ itemId: "gloves", qty: 1 }] }),
  );
  expect(dup?.id).toBe("err.paperNoUsed");
});

test("SIS: no feed rows needed, Ledger Folio typed per line; a correction keeps the paper No.", async () => {
  const farmId = await testFarm({ "feed-all": 100 });
  const sis = await saveSIS({
    ...base(), farmId, idempotencyKey: key(), paperNo: "SIS-5001",
    lines: [{ itemId: "feed-all", qty: 50, bags: 1, ledgerFolio: "23/4", purpose: "Shed 1" }],
  });
  expect(sis.shedRows).toEqual([]);
  expect(sis.lines[0].ledgerFolio).toBe("23/4");
  expect((await getSlipById(sis.id)).lines[0]).toEqual({ itemId: "feed-all", qty: 50, bags: 1, ledgerFolio: "23/4", purpose: "Shed 1" });
  const corrected = await correctSlip({ slipId: sis.id, lines: [{ index: 0, qty: 40 }], reason: "x", by: "Admin" });
  expect(corrected.paperNo).toBe("SIS-5001");
});

test("Feed All lines need Bags (whole number) next to the KG; other items never keep bags (client #26)", async () => {
  const farmId = await testFarm({ "feed-all": 5000, gloves: 10 });
  const igp = (lines: unknown[]) =>
    saveIGP({ ...base(), farmId, idempotencyKey: key(), paperNo: key(), source: { kind: "supplier", ms: "Feed Mill" }, lines });

  const missing = await errorOf(() => igp([{ itemId: "feed-all", qtyChallan: 2500, qtyReceived: 2500 }]));
  expect(missing).toEqual({ id: "err.bagsRequired", values: undefined });
  const half = await errorOf(() => igp([{ itemId: "feed-all", qtyChallan: 2500, qtyReceived: 2500, bags: 49.5 }]));
  expect(half?.id).toBe("err.bagsWhole");
  const zero = await errorOf(() => igp([{ itemId: "feed-all", qtyChallan: 2500, qtyReceived: 2500, bags: 0 }]));
  expect(zero?.id).toBe("err.bagsRequired");

  const saved = await igp([
    { itemId: "feed-all", qtyChallan: 2500, qtyReceived: 2500, bags: 50 },
    { itemId: "gloves", qtyChallan: 5, qtyReceived: 5, bags: 3 },
  ]);
  expect(saved.lines.map((l) => l.bags)).toEqual([50, undefined]);
  expect((await getSlipById(saved.id)).lines.map((l) => l.bags)).toEqual([50, undefined]);
  expect(await stock(farmId, "feed-all")).toBe(7500); // stock stays in KG

  const ogpMissing = await errorOf(() =>
    saveOGP({ ...base(), farmId, idempotencyKey: key(), paperNo: key(), to: { kind: "outside", ms: "X", reason: "other" }, lines: [{ itemId: "feed-all", qty: 100 }] }),
  );
  expect(ogpMissing?.id).toBe("err.bagsRequired");
  const sisMissing = await errorOf(() => saveSIS({ ...base(), farmId, idempotencyKey: key(), paperNo: key(), lines: [{ itemId: "feed-all", qty: 100 }] }));
  expect(sisMissing?.id).toBe("err.bagsRequired");

  // A correction can fix the bags on a feed line.
  const corrected = await correctSlip({ slipId: saved.id, lines: [{ index: 0, qty: 2450, bags: 49 }], reason: "1 bag torn", by: "Admin" });
  expect(corrected.lines[0]).toMatchObject({ qtyReceived: 2450, bags: 49 });
});

test("Transfer of feed: Bags on the OGP, the receiving IGP types its own bags", async () => {
  const from = await testFarm({ "feed-all": 3000 });
  const to = await testFarm();
  const ogp = await saveOGP({
    ...base(), farmId: from, idempotencyKey: key(), paperNo: key(), to: { kind: "farm", farmId: to },
    lines: [{ itemId: "feed-all", qty: 1000, bags: 20 }],
  });
  const receive = (lines: unknown[]) => receiveTransfer({ ...base(), farmId: to, idempotencyKey: key(), paperNo: key(), transferId: ogp.transferId, lines });
  expect((await errorOf(() => receive([{ qtyReceived: 1000 }])))?.id).toBe("err.bagsRequired");
  const igp = await receive([{ qtyReceived: 950, bags: 19 }]);
  expect(igp.lines[0]).toMatchObject({ qtyChallan: 1000, qtyReceived: 950, bags: 19 });
});

test("IGP / OGP Remarks are optional, kept as typed (Urdu too), at most 200 characters", async () => {
  const farmId = await testFarm({ gloves: 10 });
  const igp = (remarks?: string) =>
    saveIGP({
      ...base(), farmId, idempotencyKey: key(), paperNo: key(),
      source: { kind: "supplier", ms: "X" },
      lines: [{ itemId: "gloves", qtyChallan: 5, qtyReceived: 5 }],
      remarks,
    });
  expect((await igp()).remarks).toBeUndefined();
  expect((await igp("  ")).remarks).toBeUndefined();
  const urdu = await igp(" 2 بوری پھٹی ہوئی ");
  expect(urdu.remarks).toBe("2 بوری پھٹی ہوئی");
  expect(await getSlipById(urdu.id)).toMatchObject({ remarks: "2 بوری پھٹی ہوئی" });
  expect((await errorOf(() => igp("x".repeat(201))))?.id).toBe("err.remarksTooLong");
  const ogp = await saveOGP({
    ...base(), farmId, idempotencyKey: key(), paperNo: key(),
    to: { kind: "outside", ms: "Workshop", reason: "other" },
    lines: [{ itemId: "gloves", qty: 1 }],
    remarks: "Sample for the supplier",
  });
  expect(ogp.remarks).toBe("Sample for the supplier");
});

// ── Return unused (SIS) ──
function issueDiesel(farmId: string, qty: number) {
  return saveSIS({
    ...base(), farmId, idempotencyKey: key(), paperNo: key(),
    lines: [{ itemId: "diesel", qty, purpose: "Generator" }, { itemId: "gloves", qty: 2 }],
  });
}
const giveBack = (sisId: string, lines: { lineIndex: number; qty: number }[], extra: object = {}) =>
  returnUnused({ sisId, date: today(), by: "Test", idempotencyKey: key(), lines, ...extra });

test("return unused: 1,000 issued, 200 back → stock +200, used 800; the SIS stays as issued", async () => {
  const farmId = await testFarm({ diesel: 2000, gloves: 10 });
  const sis = await issueDiesel(farmId, 1000);
  expect(await stock(farmId, "diesel")).toBe(1000);

  const r = await giveBack(sis.id, [{ lineIndex: 0, qty: 200 }], { remarks: "جنریٹر جلدی ٹھیک ہو گیا" });
  expect(r.no).toBe(`${sis.no}-R1`);
  expect(r.lines).toEqual([{ lineIndex: 0, itemId: "diesel", qty: 200 }]);
  expect(await stock(farmId, "diesel")).toBe(1200);
  const again = await getSlipById(sis.id);
  expect(again.lines[0]).toMatchObject({ qty: 1000 });
  expect(returnedPerLine(again, await listReturns(sis.id))).toEqual([200, 0]);
  expect(await db().auditEntry.findFirst({ where: { farmId, action: "return" } })).toMatchObject({ recordId: sis.id, recordNo: r.no });

  // Partial returns add up; more than is left is refused with the screen's words.
  await giveBack(sis.id, [{ lineIndex: 0, qty: 50 }]);
  expect(await errorOf(() => giveBack(sis.id, [{ lineIndex: 0, qty: 751 }]))).toEqual({ id: "err.onlyReturnable", values: { n: "750" } });
  expect((await errorOf(() => giveBack(sis.id, [])))?.id).toBe("err.noReturnQty");
  expect(await stock(farmId, "diesel")).toBe(1250);
});

test("return unused: date between the issue date and today; same save twice = one return; only on a saved SIS", async () => {
  const farmId = await testFarm({ diesel: 100, gloves: 10, chips: 5 });
  const sis = await issueDiesel(farmId, 10);
  expect((await errorOf(() => giveBack(sis.id, [{ lineIndex: 0, qty: 1 }], { date: addDays(today(), 1) })))?.id).toBe("err.dateFuture");
  expect((await errorOf(() => giveBack(sis.id, [{ lineIndex: 0, qty: 1 }], { date: addDays(today(), -1) })))?.id).toBe("err.returnBeforeIssue");

  const input = { sisId: sis.id, date: today(), by: "Test", idempotencyKey: key(), lines: [{ lineIndex: 0, qty: 3 }] };
  const a = await returnUnused(input);
  const b = await returnUnused(input);
  expect(b.id).toBe(a.id);
  expect(await db().sisReturn.count({ where: { sisId: sis.id } })).toBe(1);

  const igp = await saveIGP({
    ...base(), farmId, idempotencyKey: key(), paperNo: key(),
    source: { kind: "supplier", ms: "X" }, lines: [{ itemId: "chips", qtyChallan: 1, qtyReceived: 1 }],
  });
  expect((await errorOf(() => giveBack(igp.id, [{ lineIndex: 0, qty: 1 }])))?.id).toBe("err.notFound");
  await cancelSlip({ slipId: sis.id, reason: "x", by: "Admin" });
  expect((await errorOf(() => giveBack(sis.id, [{ lineIndex: 0, qty: 1 }])))?.id).toBe("err.alreadyClosed");
});

test("return unused: admin cancels a return (never below zero); corrections and SIS cancel respect returns", async () => {
  const farmId = await testFarm({ diesel: 2000, gloves: 10 });
  const sis = await issueDiesel(farmId, 1000);
  const r = await giveBack(sis.id, [{ lineIndex: 0, qty: 200 }]);

  // Correction can't go below what came back; the correction keeps the SIS's returns.
  expect(await errorOf(() => correctSlip({ slipId: sis.id, lines: [{ index: 0, qty: 150 }], reason: "x", by: "Admin" }))).toEqual({
    id: "err.belowReturned",
    values: { n: "200" },
  });
  const corrected = await correctSlip({ slipId: sis.id, lines: [{ index: 0, qty: 900 }], reason: "x", by: "Admin" });
  expect(await stock(farmId, "diesel")).toBe(1300);
  expect(returnedPerLine(corrected, await listReturns(corrected.id))).toEqual([200, 0]);
  const r2 = await giveBack(corrected.id, [{ lineIndex: 0, qty: 100 }]);
  expect(r2.no).toBe(`${sis.no}-R2`);
  expect((await errorOf(() => giveBack(corrected.id, [{ lineIndex: 0, qty: 601 }])))?.values).toEqual({ n: "600" });

  // Cancel a return: stock back down, reason kept, can't cancel twice.
  expect((await errorOf(() => cancelReturn({ returnId: r2.id, reason: " ", by: "Admin" })))?.id).toBe("err.enterReason");
  await cancelReturn({ returnId: r2.id, reason: "Typed at the wrong slip", by: "Admin" });
  expect(await stock(farmId, "diesel")).toBe(1300);
  expect((await db().sisReturn.findUniqueOrThrow({ where: { id: r2.id } })).cancelReason).toBe("Typed at the wrong slip");
  expect((await errorOf(() => cancelReturn({ returnId: r2.id, reason: "x", by: "Admin" })))?.id).toBe("err.returnClosed");

  // Cancelling the SIS puts back only what was really used (900 − 200 = 700) and closes its returns.
  await cancelSlip({ slipId: corrected.id, reason: "Wrong farm", by: "Admin" });
  expect(await stock(farmId, "diesel")).toBe(2000);
  expect((await db().sisReturn.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("cancelled");
});

test("return unused: a cancelled return that would take stock below zero is refused", async () => {
  const farmId = await testFarm({ diesel: 40, gloves: 10 });
  const sis = await issueDiesel(farmId, 40);
  const r = await giveBack(sis.id, [{ lineIndex: 0, qty: 5 }]);
  await saveSIS({ ...base(), farmId, idempotencyKey: key(), paperNo: key(), lines: [{ itemId: "diesel", qty: 5 }] });
  expect((await errorOf(() => cancelReturn({ returnId: r.id, reason: "x", by: "Admin" })))?.id).toBe("err.wouldGoNegative");
});

test("T02 / client #28: one item per name; the Stock in Store copy of a duplicate is the one kept", async () => {
  const names = (await db().item.findMany({ select: { name: true } })).map((i) => i.name.trim().toLowerCase());
  expect(names.length - new Set(names).size).toBe(0);
  const kept = await db().item.findMany({ where: { name: { in: ["Regulator", "Liquid Soap", "Thermameter Digital"], mode: "insensitive" } } });
  expect(kept.map((i) => i.category)).toEqual(["Stock in Store", "Stock in Store", "Stock in Store"]);
  expect(kept.find((i) => /liquid soap/i.test(i.name))?.unit).toBe("QTY");
});

test("T02: saving an item with a name already in the list is refused, whatever the case or spaces", async () => {
  const item = { nameUr: "ریگولیٹر", aliases: [], category: "Shed Items", unit: "QTY" as const, isFeed: false, active: true, by: "Admin" };
  expect((await errorOf(() => saveItem({ ...item, name: "Regulator" })))?.id).toBe("err.duplicateName");
  expect((await errorOf(() => saveItem({ ...item, name: "  REGULATOR " })))?.id).toBe("err.duplicateName");
  // The database refuses it too (two saves at once).
  await expect(db().item.create({ data: { id: unique("dup"), number: 999_000 + Math.floor(Math.random() * 999), name: " regulator", category: "Shed Items", unit: "QTY" } })).rejects.toThrow();
});

test("item request (client #30): not an item until approved; duplicates refused; approve creates it, reject needs a reason", async () => {
  const farmId = await testFarm();
  const name = unique("Zebra hose");
  const ask = (n = name) => requestItem({ name: n, nameUr: "", category: "Shed Items", unit: "QTY", farmId, requestedBy: "Farm" });

  const request = await ask();
  expect(request).toMatchObject({ status: "pending", farmId, name });
  expect(await db().item.count({ where: { name } })).toBe(0);
  expect((await errorOf(() => ask(name.toUpperCase())))?.id).toBe("err.alreadyRequested");
  expect((await errorOf(() => ask("Diesel Stock")))?.id).toBe("err.itemExists");
  expect((await errorOf(() => ask(" ")))?.id).toBe("err.required");

  // The Admin's edits win; Urdu is required to add it, like any item.
  const final = { name: `${name} 1"`, nameUr: "", aliases: [], category: "Shed Items", unit: "ROLL" as const, isFeed: false, active: true };
  expect((await errorOf(() => approveItemRequest({ requestId: request.id, item: final, by: "Admin" })))?.id).toBe("err.required");
  const item = await approveItemRequest({ requestId: request.id, item: { ...final, nameUr: "زیبرا پائپ" }, by: "Admin" });
  expect(item).toMatchObject({ name: final.name, unit: "ROLL", active: true });
  expect((await listItemRequests({ farmId }))[0]).toMatchObject({ status: "approved", itemId: item.id });
  expect((await errorOf(() => approveItemRequest({ requestId: request.id, item: final, by: "Admin" })))?.id).toBe("err.notFound");

  const other = await ask(unique("Odd thing"));
  expect((await errorOf(() => rejectItemRequest({ requestId: other.id, note: " ", by: "Admin" })))?.id).toBe("err.enterReason");
  expect(await rejectItemRequest({ requestId: other.id, note: "Use Nylon Rope", by: "Admin" })).toMatchObject({ status: "rejected", note: "Use Nylon Rope" });
  expect(await db().auditEntry.count({ where: { farmId, action: { in: ["request_item", "approve_item", "reject_item"] } } })).toBe(4);
});

// ── Daily Report (T07) ──

const EGGS = "eggs";
const dr = (farmId: string, counts: Record<string, number>, extra: Record<string, unknown> = {}) =>
  saveDR({ ...base(), farmId, idempotencyKey: key(), paperNo: key(), ...counts, ...extra });

test("Daily Report: Eggs into stock = Total − Hatching − Market − Discarded, one movement, numbered AW…-DR-0001", async () => {
  const farmId = await testFarm();
  const slip = await dr(farmId, { eggsReceived: 10000, hatchingEggs: 8000, marketEggs: 1200, discardedEggs: 50, gattaTray: 340, plasticTray: 12, eggsBox: 23 });
  expect(slip.no).toBe(`${farmId.toUpperCase()}-DR-0001`);
  expect(slip.lines).toEqual([{ itemId: EGGS, qty: 750 }]);
  expect(await stock(farmId, EGGS)).toBe(750);
  const moves = await db().movement.findMany({ where: { farmId } });
  expect(moves.map((m) => [m.itemId, m.qtyIn, m.qtyOut])).toEqual([[EGGS, 750, 0]]);
  // Everything typed is kept on the report, and it reads back the same.
  const back = await getSlipById(slip.id);
  expect(back).toMatchObject({ type: "DR", eggsReceived: 10000, hatchingEggs: 8000, marketEggs: 1200, discardedEggs: 50, gattaTray: 340, plasticTray: 12, eggsBox: 23 });
  expect(await db().auditEntry.count({ where: { recordId: slip.id, action: "save" } })).toBe(1);
});

test("Daily Report: Gatta Tray, Plastic Tray and Eggs Box never change stock; 0 eggs left = no movement", async () => {
  const farmId = await testFarm({ "egg-tray": 5 });
  const slip = await dr(farmId, { eggsReceived: 500, hatchingEggs: 400, marketEggs: 100, discardedEggs: 0, gattaTray: 900, plasticTray: 70, eggsBox: 40 });
  expect(slip.lines).toEqual([]);
  expect(await db().movement.count({ where: { farmId, slipId: slip.id } })).toBe(0);
  const trayIds = (await db().item.findMany({ where: { name: { in: ["Gatta Tray", "Plastic Tray", "Eggs Box"] } }, select: { id: true } })).map((i) => i.id);
  expect(trayIds).toHaveLength(3);
  for (const id of trayIds) expect(await stock(farmId, id)).toBe(id === "egg-tray" ? 5 : 0);
  expect(await stock(farmId, EGGS)).toBe(0);
});

test("Daily Report: Hatching + Market + Discarded more than Total is refused, nothing saved", async () => {
  const farmId = await testFarm();
  const err = await errorOf(() => dr(farmId, { eggsReceived: 1000, hatchingEggs: 600, marketEggs: 300, discardedEggs: 101 }));
  expect(err).toEqual({ id: "err.drEggsOver", values: { n: "1,001", total: "1,000" } });
  expect(await db().slip.count({ where: { farmId } })).toBe(0);
  // Whole numbers ≥ 0 only; Total is required, the rest default to 0.
  expect((await errorOf(() => dr(farmId, { eggsReceived: 10.5 })))?.id).toBe("err.drWhole");
  expect((await errorOf(() => dr(farmId, { eggsReceived: 10, plasticTray: -1 })))?.id).toBe("err.zeroOrMore");
  expect((await errorOf(() => dr(farmId, { hatchingEggs: 1 })))?.id).toBe("err.required");
  const ok = await dr(farmId, { eggsReceived: 30 });
  expect(ok).toMatchObject({ hatchingEggs: 0, marketEggs: 0, discardedEggs: 0, gattaTray: 0, plasticTray: 0, eggsBox: 0 });
  expect(await stock(farmId, EGGS)).toBe(30);
});

test("Daily Report: one per farm per date — a second one is refused until the first is cancelled", async () => {
  const farmId = await testFarm();
  const first = await dr(farmId, { eggsReceived: 100, marketEggs: 40 }, { paperNo: "DR-0007" });
  const err = await errorOf(() => dr(farmId, { eggsReceived: 50 }));
  expect(err?.id).toBe("err.drDateUsed");
  expect(err?.values?.no).toBe("DR-0007");
  // Another date is fine; another farm on the same date too.
  await dr(farmId, { eggsReceived: 50 }, { date: addDays(today(), -1) });
  await dr(await testFarm(), { eggsReceived: 50 });
  // Admin cancels the first: its eggs come back out of stock, and the date is free again.
  expect(await stock(farmId, EGGS)).toBe(110);
  await cancelSlip({ slipId: first.id, reason: "Wrong counts", by: "Admin" });
  expect(await stock(farmId, EGGS)).toBe(50);
  await dr(farmId, { eggsReceived: 80 });
  expect(await stock(farmId, EGGS)).toBe(130);
  // A Daily Report can't be corrected (cancel and re-enter instead).
  const again = await dr(farmId, { eggsReceived: 5 }, { date: addDays(today(), -2) });
  expect((await errorOf(() => correctSlip({ slipId: again.id, lines: [{ index: 0, qty: 1 }], reason: "x", by: "Admin" })))?.id).toBe("err.drNoCorrection");
});

test("Current Assets items exist once each — Gatta Tray reused, the migration adds nothing a second time", async () => {
  const names = ["Eggs", "Gatta Tray", "Plastic Tray", "Eggs Box"];
  const rows = await db().$queryRaw<{ name: string; category: string; n: bigint }[]>`
    SELECT min(name) AS name, min(category) AS category, count(*) AS n FROM "Item"
    WHERE lower(btrim(name)) IN ('eggs', 'gatta tray', 'plastic tray', 'eggs box') GROUP BY lower(btrim(name))`;
  expect(rows.map((r) => r.name).sort()).toEqual([...names].sort());
  for (const r of rows) expect(Number(r.n), r.name).toBe(1);
  // Gatta Tray was already in the client's list: kept where it was, not copied into Current Assets.
  expect(rows.find((r) => r.name === "Gatta Tray")?.category).toBe("Packing Material");
  for (const name of ["Eggs", "Plastic Tray", "Eggs Box"]) expect(rows.find((r) => r.name === name)?.category).toBe("Current Assets");
  // The migration's insert is safe to run on a database that already has them (live): 0 rows.
  const fs = await import("node:fs");
  const sql = fs.readFileSync("prisma/migrations/20261128000002_daily_report/migration.sql", "utf8");
  const insert = sql.slice(sql.indexOf('INSERT INTO "Item"')).trim().replace(/;$/, "");
  expect(await db().$executeRawUnsafe(insert)).toBe(0);
});

