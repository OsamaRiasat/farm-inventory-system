// Business rules, tested straight on the server services against the test database (no browser).
// Same Zod schemas and messages the forms use. Each test works on its own throwaway farm (e2e/db.ts).
import { expect, test } from "@playwright/test";
import { ApiError } from "@/lib/api/errors";
import { addDays, today } from "@/lib/dates";
import { returnedPerLine } from "@/lib/slip-rules";
import { db } from "@/server/db";
import { cancelSlip, correctSlip } from "@/server/services/corrections";
import { cancelReturn, listReturns, returnUnused } from "@/server/services/returns";
import { getSlipById, receiveTransfer, saveIGP, saveOGP, saveSIS } from "@/server/services/slips";
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

test("whole numbers only for Qty items; nothing is saved when a rule fails", async () => {
  const farmId = await testFarm();
  const err = await errorOf(() =>
    saveIGP({
      ...base(), farmId, idempotencyKey: key(), paperNo: key(),
      source: { kind: "supplier", ms: "X" },
      lines: [{ itemId: "gloves", qtyChallan: 1.5, qtyReceived: 1.5 }],
    }),
  );
  expect(err?.id).toBe("err.wholeNumber");
  expect(await db().slip.count({ where: { farmId } })).toBe(0);
  expect(await db().counter.count({ where: { farmId } })).toBe(0);
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
    lines: [{ itemId: "feed-all", qty: 50, ledgerFolio: "23/4", purpose: "Shed 1" }],
  });
  expect(sis.shedRows).toEqual([]);
  expect(sis.lines[0].ledgerFolio).toBe("23/4");
  expect((await getSlipById(sis.id)).lines[0]).toEqual({ itemId: "feed-all", qty: 50, ledgerFolio: "23/4", purpose: "Shed 1" });
  const corrected = await correctSlip({ slipId: sis.id, lines: [{ index: 0, qty: 40 }], reason: "x", by: "Admin" });
  expect(corrected.paperNo).toBe("SIS-5001");
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
  expect((await errorOf(() => giveBack(sis.id, [{ lineIndex: 1, qty: 1.5 }])))?.id).toBe("err.wholeNumber");
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
