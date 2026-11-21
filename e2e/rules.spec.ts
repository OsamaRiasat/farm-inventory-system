// Business rules, tested straight on the mock engine (no browser). Same rules the forms use.
import { expect, test } from "@playwright/test";
import { ApiError } from "@/lib/api/errors";
import * as engine from "@/lib/api/mock/engine";
import { buildSeed } from "@/lib/api/mock/seed";
import { addDays, today } from "@/lib/dates";
import { farmBalances } from "@/lib/stock";

const now = new Date(2026, 9, 27, 12, 0);
// Saves without a seed time happen "now", so the slip date is today (any past date is allowed).
const base = { date: today(), time: "12:00", preparedBy: "Test" };
let n = 0;
const key = () => `test-${n++}`;
const stock = (s: engine.MockState, farmId: string, itemId: string) => farmBalances(s.movements, farmId).get(itemId) ?? 0;

function errorOf(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    if (e instanceof ApiError) return { id: e.id, values: e.values };
    throw e;
  }
  return null;
}

test("seed has the real slips and never goes below zero", () => {
  const s = buildSeed(now);
  for (const no of ["AW02-SIS-0203", "AW02-IGP-1662", "AW02-OGP-1366", "AWHATCHERY-OGP-0046"]) {
    expect(s.slips.some((x) => x.no === no), no).toBe(true);
  }
  for (const f of s.farms) {
    for (const [, qty] of farmBalances(s.movements, f.id)) expect(qty).toBeGreaterThanOrEqual(0);
  }
  const statuses = s.transfers.map((t) => t.status);
  expect(statuses).toContain("short");
  expect(statuses.filter((x) => x === "in_transit").length).toBeGreaterThanOrEqual(2);
  expect(s.slips.some((x) => x.status === "corrected")).toBe(true);
  expect(s.slips.some((x) => x.status === "cancelled")).toBe(true);
  expect(s.corrections.filter((r) => r.status === "open")).toHaveLength(1);
  // One "Return unused" example: AW-01, 60 LTR diesel issued, 15 back.
  expect(s.returns.map((r) => [r.farmId, r.lines[0].itemId, r.lines[0].qty])).toEqual([["aw01", "diesel", 15]]);
});

test("IGP raises stock by Qty Actual Received, numbers follow the farm's sequence", () => {
  const s = buildSeed(now);
  const before = stock(s, "aw02", "nylon-rope");
  const slip = engine.saveIGP(s, {
    ...base, farmId: "aw02", idempotencyKey: key(), paperNo: key(),
    source: { kind: "supplier", ms: "Test Supplier" },
    lines: [{ itemId: "nylon-rope", qtyChallan: 10, qtyReceived: 7 }],
  });
  expect(stock(s, "aw02", "nylon-rope")).toBe(before + 7);
  expect(slip.no).toMatch(/^AW02-IGP-\d{4}$/);
  expect(s.suppliers).toContain("Test Supplier");
});

test("the same save twice creates one slip", () => {
  const s = buildSeed(now);
  const input = {
    ...base, farmId: "aw02", idempotencyKey: "double-tap", paperNo: "IGP-9001",
    source: { kind: "supplier", ms: "X" },
    lines: [{ itemId: "gloves", qtyChallan: 5, qtyReceived: 5 }],
  };
  const a = engine.saveIGP(s, input);
  const b = engine.saveIGP(s, input);
  expect(b.id).toBe(a.id);
  expect(s.slips.filter((x) => x.id === a.id)).toHaveLength(1);
});

test("OGP and SIS can't take stock below zero — same message as the screen", () => {
  const s = buildSeed(now);
  const have = stock(s, "aw02", "drill");
  const err = errorOf(() =>
    engine.saveOGP(s, {
      ...base, farmId: "aw02", idempotencyKey: key(), paperNo: key(),
      to: { kind: "outside", ms: "Repair shop", reason: "repair" },
      lines: [{ itemId: "drill", qty: have + 1 }],
    }),
  );
  expect(err).toEqual({ id: "err.onlyInStock", values: { n: String(have) } });

  // Two lines of the same item count together.
  const diesel = stock(s, "aw02", "diesel");
  const err2 = errorOf(() =>
    engine.saveSIS(s, {
      ...base, farmId: "aw02", idempotencyKey: key(), paperNo: key(), shedRows: [],
      lines: [{ itemId: "diesel", qty: diesel }, { itemId: "diesel", qty: 1 }],
    }),
  );
  expect(err2?.id).toBe("err.onlyInStock");
});

test("whole numbers only for Qty items; nothing is saved when a rule fails", () => {
  const s = buildSeed(now);
  const count = s.slips.length;
  const err = errorOf(() =>
    engine.saveIGP(s, {
      ...base, farmId: "aw02", idempotencyKey: key(), paperNo: key(),
      source: { kind: "supplier", ms: "X" },
      lines: [{ itemId: "gloves", qtyChallan: 1.5, qtyReceived: 1.5 }],
    }),
  );
  expect(err?.id).toBe("err.wholeNumber");
  expect(s.slips.length).toBe(count);
});

test("transfer: OGP puts goods in transit, receiving can't exceed what was sent, shortfall marks it short", () => {
  const s = buildSeed(now);
  const ogp = engine.saveOGP(s, {
    ...base, farmId: "aw02", idempotencyKey: key(), paperNo: key(),
    to: { kind: "farm", farmId: "aw05" }, lines: [{ itemId: "chips", qty: 10 }],
  });
  const transfer = s.transfers.find((t) => t.id === ogp.transferId)!;
  expect(transfer.status).toBe("in_transit");

  const before = stock(s, "aw05", "chips");
  const tooMuch = errorOf(() =>
    engine.receiveTransfer(s, { ...base, farmId: "aw05", idempotencyKey: key(), paperNo: key(), transferId: transfer.id, lines: [{ qtyReceived: 11 }] }),
  );
  expect(tooMuch).toEqual({ id: "err.cannotReceiveMore", values: { n: "10" } });

  engine.receiveTransfer(s, { ...base, farmId: "aw05", idempotencyKey: key(), paperNo: key(), transferId: transfer.id, lines: [{ qtyReceived: 8 }] });
  expect(transfer.status).toBe("short");
  expect(stock(s, "aw05", "chips")).toBe(before + 8);

  const cancel = errorOf(() => engine.cancelSlip(s, { slipId: ogp.id, reason: "x", by: "Admin" }));
  expect(cancel?.id).toBe("err.cannotCancelReceived");
});

test("correction moves stock by the difference only and keeps the original", () => {
  const s = buildSeed(now);
  const sis = engine.saveSIS(s, {
    ...base, farmId: "aw02", idempotencyKey: key(), paperNo: key(), shedRows: [], lines: [{ itemId: "gloves", qty: 4 }],
  });
  const before = stock(s, "aw02", "gloves");
  const corrected = engine.correctSlip(s, { slipId: sis.id, lines: [{ index: 0, qty: 2 }], reason: "Typed 4", by: "Admin" });
  expect(stock(s, "aw02", "gloves")).toBe(before + 2);
  expect(engine.getSlip(s, sis.id).status).toBe("corrected");
  expect(corrected.correctionOf).toBe(sis.id);
});

test("cancel reverses the slip, and is refused when it would go below zero", () => {
  const s = buildSeed(now);
  const before = stock(s, "aw02", "ball-pen");
  const igp = engine.saveIGP(s, {
    ...base, farmId: "aw02", idempotencyKey: key(), paperNo: key(),
    source: { kind: "supplier", ms: "X" }, lines: [{ itemId: "ball-pen", qtyChallan: 10, qtyReceived: 10 }],
  });
  engine.saveSIS(s, { ...base, farmId: "aw02", idempotencyKey: key(), paperNo: key(), shedRows: [], lines: [{ itemId: "ball-pen", qty: before + 10 }] });
  expect(errorOf(() => engine.cancelSlip(s, { slipId: igp.id, reason: "x", by: "Admin" }))?.id).toBe("err.wouldGoNegative");
});

test("slip date: today or any earlier date (previous months too), never in the future", () => {
  const s = buildSeed(now);
  const sis = (date: string) =>
    errorOf(() =>
      engine.saveSIS(s, { ...base, date, farmId: "aw02", idempotencyKey: key(), paperNo: key(), lines: [{ itemId: "gloves", qty: 1 }] }),
    );
  expect(sis(addDays(today(), 1))?.id).toBe("err.dateFuture");
  expect(sis(addDays(today(), -31))).toBeNull();
  expect(sis(addDays(today(), -400))).toBeNull();
  const saved = s.slips.at(-1)!;
  expect(saved.date).toBe(addDays(today(), -400));
  expect(saved.postedAt.slice(0, 10)).toBe(today());
});

test("paper slip No.: required, and used once per farm and slip type", () => {
  const s = buildSeed(now);
  const igp = (farmId: string, paperNo: string) =>
    errorOf(() =>
      engine.saveIGP(s, {
        ...base, farmId, idempotencyKey: key(), paperNo,
        source: { kind: "supplier", ms: "X" }, lines: [{ itemId: "gloves", qtyChallan: 1, qtyReceived: 1 }],
      }),
    );
  expect(igp("aw02", "")?.id).toBe("err.enterPaperNo");
  expect(igp("aw02", "IGP-7777")).toBeNull();
  expect(igp("aw02", "igp-7777 ")).toEqual({ id: "err.paperNoUsed", values: { no: "igp-7777" } });
  expect(igp("aw05", "IGP-7777")).toBeNull(); // another farm's book
  const sis = errorOf(() =>
    engine.saveSIS(s, { ...base, farmId: "aw02", idempotencyKey: key(), paperNo: "IGP-7777", lines: [{ itemId: "gloves", qty: 1 }] }),
  );
  expect(sis).toBeNull(); // another slip type
  // The seed's SIS-203 has paper No. SIS-0203.
  const dup = errorOf(() =>
    engine.saveSIS(s, { ...base, farmId: "aw02", idempotencyKey: key(), paperNo: "SIS-0203", lines: [{ itemId: "gloves", qty: 1 }] }),
  );
  expect(dup?.id).toBe("err.paperNoUsed");
});

test("SIS: no feed rows needed, Ledger Folio typed per line; a correction keeps the paper No.", () => {
  const s = buildSeed(now);
  const sis = engine.saveSIS(s, {
    ...base, farmId: "aw02", idempotencyKey: key(), paperNo: "SIS-5001",
    lines: [{ itemId: "feed-all", qty: 50, ledgerFolio: "23/4", purpose: "Shed 1" }],
  });
  expect(sis.shedRows).toEqual([]);
  expect(sis.lines[0].ledgerFolio).toBe("23/4");
  const corrected = engine.correctSlip(s, { slipId: sis.id, lines: [{ index: 0, qty: 40 }], reason: "x", by: "Admin" });
  expect(corrected.paperNo).toBe("SIS-5001");
});

test("IGP / OGP Remarks are optional, kept as typed (Urdu too), at most 200 characters", () => {
  const s = buildSeed(now);
  const igp = (remarks?: string) =>
    engine.saveIGP(s, {
      ...base, farmId: "aw02", idempotencyKey: key(), paperNo: key(),
      source: { kind: "supplier", ms: "X" },
      lines: [{ itemId: "gloves", qtyChallan: 5, qtyReceived: 5 }],
      remarks,
    });
  expect(igp().remarks).toBeUndefined();
  expect(igp("  ").remarks).toBeUndefined();
  expect(igp(" 2 بوری پھٹی ہوئی ").remarks).toBe("2 بوری پھٹی ہوئی");
  expect(errorOf(() => igp("x".repeat(201)))?.id).toBe("err.remarksTooLong");
  const ogp = engine.saveOGP(s, {
    ...base, farmId: "aw02", idempotencyKey: key(), paperNo: key(),
    to: { kind: "outside", ms: "Workshop", reason: "other" },
    lines: [{ itemId: "gloves", qty: 1 }],
    remarks: "Sample for the supplier",
  });
  expect(ogp.remarks).toBe("Sample for the supplier");
});

// ── Return unused (SIS) ──
function issueDiesel(s: engine.MockState, qty: number) {
  return engine.saveSIS(s, {
    ...base, farmId: "aw02", idempotencyKey: key(), paperNo: key(),
    lines: [{ itemId: "diesel", qty, purpose: "Generator" }, { itemId: "gloves", qty: 2 }],
  });
}
const giveBack = (s: engine.MockState, sisId: string, lines: { lineIndex: number; qty: number }[], extra: object = {}) =>
  engine.returnUnused(s, { sisId, date: today(), by: "Test", idempotencyKey: key(), lines, ...extra });

test("return unused: 1,000 issued, 200 back → stock +200, used 800; the SIS stays as issued", () => {
  const s = buildSeed(now);
  const start = stock(s, "aw02", "diesel");
  const sis = issueDiesel(s, 1000);
  expect(stock(s, "aw02", "diesel")).toBe(start - 1000);

  const r = giveBack(s, sis.id, [{ lineIndex: 0, qty: 200 }], { remarks: "جنریٹر جلدی ٹھیک ہو گیا" });
  expect(r.no).toBe(`${sis.no}-R1`);
  expect(r.lines).toEqual([{ lineIndex: 0, itemId: "diesel", qty: 200 }]);
  expect(stock(s, "aw02", "diesel")).toBe(start - 800);
  expect((engine.getSlip(s, sis.id) as typeof sis).lines[0].qty).toBe(1000);
  expect(engine.returnedPerLine(s, sis)).toEqual([200, 0]);
  expect(s.audit.at(-1)).toMatchObject({ action: "return", recordId: sis.id, recordNo: r.no });

  // Partial returns add up; more than is left is refused with the screen's words.
  giveBack(s, sis.id, [{ lineIndex: 0, qty: 50 }]);
  expect(errorOf(() => giveBack(s, sis.id, [{ lineIndex: 0, qty: 751 }]))).toEqual({ id: "err.onlyReturnable", values: { n: "750" } });
  expect(errorOf(() => giveBack(s, sis.id, [{ lineIndex: 1, qty: 1.5 }]))?.id).toBe("err.wholeNumber");
  expect(errorOf(() => giveBack(s, sis.id, []))?.id).toBe("err.noReturnQty");
  expect(stock(s, "aw02", "diesel")).toBe(start - 750);
});

test("return unused: date between the issue date and today; same save twice = one return; only on a saved SIS", () => {
  const s = buildSeed(now);
  const sis = issueDiesel(s, 10);
  expect(errorOf(() => giveBack(s, sis.id, [{ lineIndex: 0, qty: 1 }], { date: addDays(today(), 1) }))?.id).toBe("err.dateFuture");
  expect(errorOf(() => giveBack(s, sis.id, [{ lineIndex: 0, qty: 1 }], { date: addDays(today(), -1) }))?.id).toBe("err.returnBeforeIssue");

  const input = { sisId: sis.id, date: today(), by: "Test", idempotencyKey: "return-twice", lines: [{ lineIndex: 0, qty: 3 }] };
  const a = engine.returnUnused(s, input);
  const b = engine.returnUnused(s, input);
  expect(b.id).toBe(a.id);
  expect(s.returns.filter((r) => r.sisId === sis.id)).toHaveLength(1);

  const igp = s.slips.find((x) => x.type === "IGP" && x.status === "saved")!;
  expect(errorOf(() => giveBack(s, igp.id, [{ lineIndex: 0, qty: 1 }]))?.id).toBe("err.notFound");
  engine.cancelSlip(s, { slipId: sis.id, reason: "x", by: "Admin" });
  expect(errorOf(() => giveBack(s, sis.id, [{ lineIndex: 0, qty: 1 }]))?.id).toBe("err.alreadyClosed");
});

test("return unused: admin cancels a return (never below zero); corrections and SIS cancel respect returns", () => {
  const s = buildSeed(now);
  const start = stock(s, "aw02", "diesel");
  const sis = issueDiesel(s, 1000);
  const r = giveBack(s, sis.id, [{ lineIndex: 0, qty: 200 }]);

  // Correction can't go below what came back; the correction keeps the SIS's returns.
  expect(errorOf(() => engine.correctSlip(s, { slipId: sis.id, lines: [{ index: 0, qty: 150 }], reason: "x", by: "Admin" }))).toEqual({
    id: "err.belowReturned",
    values: { n: "200" },
  });
  const corrected = engine.correctSlip(s, { slipId: sis.id, lines: [{ index: 0, qty: 900 }], reason: "x", by: "Admin" });
  expect(stock(s, "aw02", "diesel")).toBe(start - 700);
  expect(engine.returnedPerLine(s, corrected)).toEqual([200, 0]);
  const r2 = giveBack(s, corrected.id, [{ lineIndex: 0, qty: 100 }]);
  expect(r2.no).toBe(`${sis.no}-R2`);
  expect(errorOf(() => giveBack(s, corrected.id, [{ lineIndex: 0, qty: 601 }]))?.values).toEqual({ n: "600" });

  // Cancel a return: stock back down, reason kept, can't cancel twice.
  expect(errorOf(() => engine.cancelReturn(s, { returnId: r2.id, reason: " ", by: "Admin" }))?.id).toBe("err.enterReason");
  engine.cancelReturn(s, { returnId: r2.id, reason: "Typed at the wrong slip", by: "Admin" });
  expect(stock(s, "aw02", "diesel")).toBe(start - 700);
  expect(s.returns.find((x) => x.id === r2.id)?.cancelled?.reason).toBe("Typed at the wrong slip");
  expect(errorOf(() => engine.cancelReturn(s, { returnId: r2.id, reason: "x", by: "Admin" }))?.id).toBe("err.returnClosed");

  // Cancelling the SIS puts back only what was really used (900 − 200 = 700) and closes its returns.
  engine.cancelSlip(s, { slipId: corrected.id, reason: "Wrong farm", by: "Admin" });
  expect(stock(s, "aw02", "diesel")).toBe(start);
  expect(s.returns.find((x) => x.id === r.id)?.status).toBe("cancelled");
});

test("return unused: a cancelled return that would take stock below zero is refused", () => {
  const s = buildSeed(now);
  const sis = issueDiesel(s, stock(s, "aw02", "diesel"));
  const r = giveBack(s, sis.id, [{ lineIndex: 0, qty: 5 }]);
  engine.saveSIS(s, { ...base, farmId: "aw02", idempotencyKey: key(), paperNo: key(), lines: [{ itemId: "diesel", qty: 5 }] });
  expect(errorOf(() => engine.cancelReturn(s, { returnId: r.id, reason: "x", by: "Admin" }))?.id).toBe("err.wouldGoNegative");
});
