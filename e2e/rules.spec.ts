// Business rules, tested straight on the mock engine (no browser). Same rules the forms use.
import { expect, test } from "@playwright/test";
import { ApiError } from "@/lib/api/errors";
import * as engine from "@/lib/api/mock/engine";
import { buildSeed } from "@/lib/api/mock/seed";
import { farmBalances } from "@/lib/stock";

const now = new Date(2026, 9, 27, 12, 0);
const base = { date: "2026-10-27", time: "12:00", preparedBy: "Test" };
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
});

test("IGP raises stock by Qty Actual Received, numbers follow the farm's sequence", () => {
  const s = buildSeed(now);
  const before = stock(s, "aw02", "nylon-rope");
  const slip = engine.saveIGP(s, {
    ...base, farmId: "aw02", idempotencyKey: key(),
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
    ...base, farmId: "aw02", idempotencyKey: "double-tap",
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
      ...base, farmId: "aw02", idempotencyKey: key(),
      to: { kind: "outside", ms: "Repair shop", reason: "repair" },
      lines: [{ itemId: "drill", qty: have + 1 }],
    }),
  );
  expect(err).toEqual({ id: "err.onlyInStock", values: { n: String(have) } });

  // Two lines of the same item count together.
  const diesel = stock(s, "aw02", "diesel");
  const err2 = errorOf(() =>
    engine.saveSIS(s, {
      ...base, farmId: "aw02", idempotencyKey: key(), shedRows: [],
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
      ...base, farmId: "aw02", idempotencyKey: key(),
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
    ...base, farmId: "aw02", idempotencyKey: key(),
    to: { kind: "farm", farmId: "aw05" }, lines: [{ itemId: "chips", qty: 10 }],
  });
  const transfer = s.transfers.find((t) => t.id === ogp.transferId)!;
  expect(transfer.status).toBe("in_transit");

  const before = stock(s, "aw05", "chips");
  const tooMuch = errorOf(() =>
    engine.receiveTransfer(s, { ...base, farmId: "aw05", idempotencyKey: key(), transferId: transfer.id, lines: [{ qtyReceived: 11 }] }),
  );
  expect(tooMuch).toEqual({ id: "err.cannotReceiveMore", values: { n: "10" } });

  engine.receiveTransfer(s, { ...base, farmId: "aw05", idempotencyKey: key(), transferId: transfer.id, lines: [{ qtyReceived: 8 }] });
  expect(transfer.status).toBe("short");
  expect(stock(s, "aw05", "chips")).toBe(before + 8);

  const cancel = errorOf(() => engine.cancelSlip(s, { slipId: ogp.id, reason: "x", by: "Admin" }));
  expect(cancel?.id).toBe("err.cannotCancelReceived");
});

test("correction moves stock by the difference only and keeps the original", () => {
  const s = buildSeed(now);
  const sis = engine.saveSIS(s, {
    ...base, farmId: "aw02", idempotencyKey: key(), shedRows: [], lines: [{ itemId: "gloves", qty: 4 }],
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
    ...base, farmId: "aw02", idempotencyKey: key(),
    source: { kind: "supplier", ms: "X" }, lines: [{ itemId: "ball-pen", qtyChallan: 10, qtyReceived: 10 }],
  });
  engine.saveSIS(s, { ...base, farmId: "aw02", idempotencyKey: key(), shedRows: [], lines: [{ itemId: "ball-pen", qty: before + 10 }] });
  expect(errorOf(() => engine.cancelSlip(s, { slipId: igp.id, reason: "x", by: "Admin" }))?.id).toBe("err.wouldGoNegative");
});
