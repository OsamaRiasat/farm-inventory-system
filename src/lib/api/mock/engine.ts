// The mock backend's rules: turns inputs into slips, movements, transfers and audit entries.
// Used by the API (src/lib/api/mock/index.ts) and by the seed, so seeded history obeys the same rules.

import type { z } from "zod";
import { igpSchema, receiveSchema } from "@/features/igp/schema";
import { ogpSchema } from "@/features/ogp/schema";
import { sisSchema } from "@/features/sis/schema";
import { stockCountSchema } from "@/features/stock-count/schema";
import { nowStamp } from "@/lib/dates";
import { fmtQty } from "@/lib/format";
import { farmBalances } from "@/lib/stock";
import { toFieldErrors, type RuleContext } from "@/lib/validation";
import type {
  AuditEntry,
  CorrectionRequest,
  Farm,
  IGP,
  Item,
  Movement,
  OGP,
  SIS,
  Slip,
  StockCount,
  Transfer,
  User,
} from "@/types/domain";
import { ApiError } from "../errors";
import type { CorrectionInput, CorrectionRequestInput } from "../types";

export type MockState = {
  version: number;
  seededAt: string;
  farms: Farm[];
  items: Item[];
  users: User[];
  suppliers: string[];
  slips: Slip[];
  transfers: Transfer[];
  movements: Movement[];
  corrections: CorrectionRequest[];
  stockCounts: StockCount[];
  audit: AuditEntry[];
  /** farmId → "IGP" | "OGP" | "SIS" | "CNT" → last number used. */
  counters: Record<string, Record<string, number>>;
  /** idempotency key → saved record id. */
  idempotency: Record<string, string>;
  nextId: number;
};

/** Seed-only overrides: a fixed slip number and the time the action happened. */
export type SaveOpts = { no?: number; at?: string };

// ── helpers ─────────────────────────────────────────────────────────────

export function getFarm(state: MockState, farmId: string) {
  const farm = state.farms.find((f) => f.id === farmId);
  if (!farm) throw new ApiError("err.notFound");
  return farm;
}

export function getSlip(state: MockState, slipId: string) {
  const slip = state.slips.find((s) => s.id === slipId);
  if (!slip) throw new ApiError("err.notFound");
  return slip;
}

export function ruleContext(state: MockState, farmId: string): RuleContext {
  const items = new Map(state.items.map((i) => [i.id, i]));
  const balances = farmBalances(state.movements, farmId);
  return { item: (id) => items.get(id), stockOf: (id) => balances.get(id) ?? 0 };
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const errors = toFieldErrors(result.error);
    throw new ApiError(errors[0].id, errors[0].values, errors);
  }
  return result.data;
}

/** "AW-02" → "AW02", "AW Layer-01" → "AWLAYER01". */
export function slipPrefix(farm: Farm) {
  return farm.code.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function nextNo(state: MockState, farm: Farm, kind: string, override?: number) {
  const counters = (state.counters[farm.id] ??= {});
  const n = override ?? (counters[kind] ?? 0) + 1;
  counters[kind] = Math.max(counters[kind] ?? 0, n);
  const no = `${slipPrefix(farm)}-${kind}-${String(n).padStart(4, "0")}`;
  if (state.slips.some((s) => s.no === no) || state.stockCounts.some((c) => c.no === no)) {
    throw new Error(`Duplicate number ${no}`);
  }
  return no;
}

function newId(state: MockState, prefix: string) {
  return `${prefix}${state.nextId++}`;
}

function addMovements(
  state: MockState,
  record: { id: string; farmId: string; date: string },
  entries: { itemId: string; delta: number }[],
) {
  for (const { itemId, delta } of entries) {
    if (delta === 0) continue;
    state.movements.push({
      id: newId(state, "m"),
      farmId: record.farmId,
      itemId,
      slipId: record.id,
      date: record.date,
      qtyIn: delta > 0 ? delta : 0,
      qtyOut: delta < 0 ? -delta : 0,
    });
  }
}

function audit(state: MockState, entry: Omit<AuditEntry, "id" | "at">, at?: string) {
  state.audit.push({ id: newId(state, "a"), at: at ?? nowStamp(), ...entry });
}

function remembered<T extends Slip | StockCount>(state: MockState, key: string, list: T[]): T | undefined {
  const id = state.idempotency[key];
  return id ? list.find((r) => r.id === id) : undefined;
}

/** Blocks a correction or cancel that would take any item below zero. */
function assertNotNegative(state: MockState, farmId: string, deltas: { itemId: string; delta: number }[]) {
  const balances = farmBalances(state.movements, farmId);
  const totals = new Map<string, number>();
  for (const { itemId, delta } of deltas) totals.set(itemId, (totals.get(itemId) ?? 0) + delta);
  for (const [itemId, delta] of totals) {
    const balance = balances.get(itemId) ?? 0;
    if (balance + delta < 0) {
      const item = state.items.find((i) => i.id === itemId);
      throw new ApiError("err.wouldGoNegative", { item: item?.name ?? itemId, n: fmtQty(balance) });
    }
  }
}

/** Only gate passes can belong to a transfer. */
function transferIdOf(slip: Slip) {
  return slip.type === "SIS" ? undefined : slip.transferId;
}

/** Stock effect of a slip's lines (positive = into the farm). */
function slipDeltas(slip: Slip): { itemId: string; delta: number }[] {
  switch (slip.type) {
    case "IGP":
      return slip.lines.map((l) => ({ itemId: l.itemId, delta: l.qtyReceived }));
    case "OGP":
      return slip.lines.map((l) => ({ itemId: l.itemId, delta: -l.qty }));
    case "SIS":
      return [
        ...slip.shedRows.map((r) => ({ itemId: r.feedItemId, delta: -r.feedKg })),
        ...slip.lines.map((l) => ({ itemId: l.itemId, delta: -l.qty })),
      ];
  }
}

function base(state: MockState, v: { farmId: string; date: string; time: string; preparedBy: string }, kind: Slip["type"], opts: SaveOpts) {
  const farm = getFarm(state, v.farmId);
  const no = nextNo(state, farm, kind, opts.no);
  return { id: no, no, farmId: farm.id, date: v.date, time: v.time, preparedBy: v.preparedBy, status: "saved" as const };
}

function commitSlip(state: MockState, slip: Slip, key: string, opts: SaveOpts, action: AuditEntry["action"] = "save") {
  state.slips.push(slip);
  addMovements(state, slip, slipDeltas(slip));
  state.idempotency[key] = slip.id;
  audit(state, { user: slip.preparedBy, farmId: slip.farmId, action, recordId: slip.id, recordNo: slip.no }, opts.at);
  return slip;
}

const farmIdOf = (input: unknown) => String((input as { farmId?: unknown })?.farmId ?? "");
const keyOf = (input: unknown) => String((input as { idempotencyKey?: unknown })?.idempotencyKey ?? "");

// ── slips ───────────────────────────────────────────────────────────────

export function saveIGP(state: MockState, input: unknown, opts: SaveOpts = {}): IGP {
  const done = remembered(state, keyOf(input), state.slips);
  if (done) return done as IGP;
  const v = parse(igpSchema(ruleContext(state, farmIdOf(input))), input);
  const slip: IGP = {
    ...base(state, v, "IGP", opts),
    type: "IGP",
    source: v.source,
    biltyNo: v.biltyNo,
    truckNo: v.truckNo,
    driverName: v.driverName,
    demandNo: v.demandNo,
    challanNo: v.challanNo,
    challanDate: v.challanDate,
    lines: v.lines,
  };
  if (v.source.kind === "supplier" && !state.suppliers.includes(v.source.ms)) state.suppliers.push(v.source.ms);
  return commitSlip(state, slip, v.idempotencyKey, opts) as IGP;
}

export function saveOGP(state: MockState, input: unknown, opts: SaveOpts = {}): OGP {
  const done = remembered(state, keyOf(input), state.slips);
  if (done) return done as OGP;
  const v = parse(ogpSchema(ruleContext(state, farmIdOf(input))), input);
  if (v.to.kind === "farm") getFarm(state, v.to.farmId);
  const slip: OGP = {
    ...base(state, v, "OGP", opts),
    type: "OGP",
    to: v.to,
    driverName: v.driverName,
    vehicleNo: v.vehicleNo,
    lines: v.lines,
  };
  if (v.to.kind === "farm") {
    const transfer: Transfer = {
      id: `T-${slip.no}`,
      ogpId: slip.id,
      fromFarmId: slip.farmId,
      toFarmId: v.to.farmId,
      status: "in_transit",
      sentAt: `${slip.date}T${slip.time}`,
    };
    slip.transferId = transfer.id;
    state.transfers.push(transfer);
  }
  return commitSlip(state, slip, v.idempotencyKey, opts) as OGP;
}

export function saveSIS(state: MockState, input: unknown, opts: SaveOpts = {}): SIS {
  const done = remembered(state, keyOf(input), state.slips);
  if (done) return done as SIS;
  const v = parse(sisSchema(ruleContext(state, farmIdOf(input))), input);
  const slip: SIS = { ...base(state, v, "SIS", opts), type: "SIS", shedRows: v.shedRows, lines: v.lines };
  return commitSlip(state, slip, v.idempotencyKey, opts) as SIS;
}

export function receiveTransfer(state: MockState, input: unknown, opts: SaveOpts = {}): IGP {
  const done = remembered(state, keyOf(input), state.slips);
  if (done) return done as IGP;
  const transferId = String((input as { transferId?: unknown })?.transferId ?? "");
  const transfer = state.transfers.find((t) => t.id === transferId);
  if (!transfer) throw new ApiError("err.notFound");
  if (transfer.status !== "in_transit") throw new ApiError("err.transferClosed");
  if (farmIdOf(input) !== transfer.toFarmId) throw new ApiError("err.notFound");

  const ogp = getSlip(state, transfer.ogpId) as OGP;
  const sent = ogp.lines.map((l) => ({ itemId: l.itemId, qty: l.qty }));
  const v = parse(receiveSchema(ruleContext(state, transfer.toFarmId), sent), input);
  const slip: IGP = {
    ...base(state, v, "IGP", opts),
    type: "IGP",
    source: { kind: "farm", farmId: transfer.fromFarmId },
    transferId: transfer.id,
    driverName: ogp.driverName,
    truckNo: ogp.vehicleNo,
    lines: sent.map((s, i) => ({
      itemId: s.itemId,
      qtyChallan: s.qty,
      qtyReceived: v.lines[i].qtyReceived,
      weightKg: v.lines[i].weightKg,
    })),
  };
  transfer.igpId = slip.id;
  transfer.receivedAt = `${slip.date}T${slip.time}`;
  transfer.status = slip.lines.some((l) => l.qtyReceived < l.qtyChallan) ? "short" : "received";
  commitSlip(state, slip, v.idempotencyKey, opts, "receive");
  return slip;
}

// ── corrections and cancellations ───────────────────────────────────────

/** The slip and every slip it corrects, newest first. */
function chain(state: MockState, slip: Slip) {
  const list = [slip];
  let current = slip;
  while (current.correctionOf) {
    current = getSlip(state, current.correctionOf);
    list.push(current);
  }
  return list;
}

function lineSummary(slip: Slip) {
  const qtys = slip.lines.map((l) => ("qtyReceived" in l ? l.qtyReceived : l.qty));
  return qtys.map(fmtQty).join(", ");
}

/** Admin correction: a new slip with the right quantities; stock moves by the difference only. */
export function correctSlip(state: MockState, input: CorrectionInput, opts: SaveOpts = {}): Slip {
  const original = getSlip(state, input.slipId);
  if (original.status !== "saved") throw new ApiError("err.alreadyClosed");
  if (!input.reason.trim()) throw new ApiError("err.enterReason");
  if (original.type === "OGP" && original.transferId) {
    const transfer = state.transfers.find((t) => t.id === original.transferId);
    if (transfer && transfer.status !== "in_transit") throw new ApiError("err.cannotCancelReceived");
  }

  const corrected = structuredClone(original) as Slip;
  for (const { index, qty } of input.lines) {
    const line = corrected.lines[index];
    if (!line || qty < 0 || (corrected.type !== "IGP" && qty === 0)) throw new ApiError("err.qtyAboveZero");
    if ("qtyReceived" in line) {
      if (qty > line.qtyChallan && transferIdOf(corrected)) {
        throw new ApiError("err.cannotReceiveMore", { n: fmtQty(line.qtyChallan) });
      }
      line.qtyReceived = qty;
    } else {
      line.qty = qty;
    }
  }

  const before = slipDeltas(original);
  const after = slipDeltas(corrected);
  const deltas = after.map((a, i) => ({ itemId: a.itemId, delta: a.delta - (before[i]?.delta ?? 0) }));
  assertNotNegative(state, original.farmId, deltas);

  const count = chain(state, original).length;
  corrected.id = `${original.no.replace(/-C\d+$/, "")}-C${count}`;
  corrected.no = corrected.id;
  corrected.correctionOf = original.id;
  corrected.correctedBy = undefined;
  corrected.status = "saved";
  original.status = "corrected";
  original.correctedBy = corrected.id;
  state.slips.push(corrected);
  addMovements(state, corrected, deltas);

  const correctedTransferId = transferIdOf(corrected);
  if (correctedTransferId) {
    const transfer = state.transfers.find((t) => t.id === correctedTransferId);
    if (transfer && corrected.type === "OGP") transfer.ogpId = corrected.id;
    if (transfer && corrected.type === "IGP") {
      transfer.igpId = corrected.id;
      transfer.status = corrected.lines.some((l) => l.qtyReceived < l.qtyChallan) ? "short" : "received";
    }
  }
  if (input.requestId) {
    const request = state.corrections.find((r) => r.id === input.requestId);
    if (request) {
      request.status = "approved";
      request.correctionId = corrected.id;
    }
  }
  audit(
    state,
    {
      user: input.by,
      farmId: original.farmId,
      action: "correct",
      recordId: original.id,
      recordNo: original.no,
      old: lineSummary(original),
      new: lineSummary(corrected),
      reason: input.reason,
    },
    opts.at,
  );
  return corrected;
}

/** Cancel reverses the slip's whole effect on stock. A received transfer's OGP can't be cancelled. */
export function cancelSlip(state: MockState, input: { slipId: string; reason: string; by: string }, opts: SaveOpts = {}): Slip {
  const slip = getSlip(state, input.slipId);
  if (slip.status !== "saved") throw new ApiError("err.alreadyClosed");
  if (!input.reason.trim()) throw new ApiError("err.enterReason");

  const transferId = transferIdOf(slip);
  const transfer = transferId ? state.transfers.find((t) => t.id === transferId) : undefined;
  if (slip.type === "OGP" && transfer && transfer.status !== "in_transit") throw new ApiError("err.cannotCancelReceived");

  const ids = new Set(chain(state, slip).map((s) => s.id));
  const net = new Map<string, number>();
  for (const m of state.movements) {
    if (ids.has(m.slipId)) net.set(m.itemId, (net.get(m.itemId) ?? 0) + m.qtyIn - m.qtyOut);
  }
  const reversal = [...net].map(([itemId, n]) => ({ itemId, delta: -n }));
  assertNotNegative(state, slip.farmId, reversal);
  addMovements(state, slip, reversal);
  slip.status = "cancelled";

  if (transfer && slip.type === "OGP") transfer.status = "cancelled";
  if (transfer && slip.type === "IGP") {
    transfer.status = "in_transit";
    transfer.igpId = undefined;
    transfer.receivedAt = undefined;
  }
  audit(
    state,
    { user: input.by, farmId: slip.farmId, action: "cancel", recordId: slip.id, recordNo: slip.no, reason: input.reason },
    opts.at,
  );
  return slip;
}

export function requestCorrection(state: MockState, input: CorrectionRequestInput, opts: SaveOpts = {}) {
  const slip = getSlip(state, input.slipId);
  if (!slip.lines[input.lineIndex]) throw new ApiError("err.notFound");
  if (!input.reason.trim()) throw new ApiError("err.enterReason");
  if (!(input.requestedQty >= 0)) throw new ApiError("err.required");
  const request: CorrectionRequest = {
    id: newId(state, "cr"),
    slipId: slip.id,
    farmId: slip.farmId,
    lineIndex: input.lineIndex,
    requestedQty: input.requestedQty,
    reason: input.reason.trim(),
    requestedBy: input.requestedBy,
    at: opts.at ?? nowStamp(),
    status: "open",
  };
  state.corrections.push(request);
  audit(
    state,
    { user: input.requestedBy, farmId: slip.farmId, action: "request_correction", recordId: slip.id, recordNo: slip.no, reason: request.reason },
    opts.at,
  );
  return request;
}

export function rejectCorrection(state: MockState, input: { requestId: string; note: string; by: string }) {
  const request = state.corrections.find((r) => r.id === input.requestId);
  if (!request || request.status !== "open") throw new ApiError("err.notFound");
  if (!input.note.trim()) throw new ApiError("err.enterReason");
  request.status = "rejected";
  request.note = input.note.trim();
  const slip = getSlip(state, request.slipId);
  audit(state, { user: input.by, farmId: slip.farmId, action: "reject_correction", recordId: slip.id, recordNo: slip.no, reason: request.note });
  return request;
}

export function resolveShortfall(state: MockState, input: { transferId: string; reason: string; by: string }) {
  const transfer = state.transfers.find((t) => t.id === input.transferId);
  if (!transfer || transfer.status !== "short" || transfer.resolution) throw new ApiError("err.notFound");
  if (!input.reason.trim()) throw new ApiError("err.enterReason");
  const at = nowStamp();
  transfer.resolution = { kind: "written_off", by: input.by, at, reason: input.reason.trim() };
  const ogp = getSlip(state, transfer.ogpId);
  audit(state, { user: input.by, farmId: transfer.fromFarmId, action: "resolve_shortfall", recordId: transfer.id, recordNo: ogp.no, reason: input.reason });
  return transfer;
}

// ── stock count ─────────────────────────────────────────────────────────

export function saveStockCount(state: MockState, input: unknown, opts: SaveOpts = {}): StockCount {
  const done = remembered(state, keyOf(input), state.stockCounts);
  if (done) return done;
  const rules = ruleContext(state, farmIdOf(input));
  const v = parse(stockCountSchema(rules), input);
  const farm = getFarm(state, v.farmId);
  const no = nextNo(state, farm, "CNT", opts.no);
  const count: StockCount = {
    id: no,
    no,
    farmId: farm.id,
    date: v.date,
    time: v.time,
    preparedBy: v.preparedBy,
    reason: v.reason,
    lines: v.lines.map((l) => ({ itemId: l.itemId, systemQty: rules.stockOf(l.itemId), countedQty: l.countedQty })),
  };
  state.stockCounts.push(count);
  addMovements(state, count, count.lines.map((l) => ({ itemId: l.itemId, delta: l.countedQty - l.systemQty })));
  state.idempotency[v.idempotencyKey] = count.id;
  audit(state, { user: v.preparedBy, farmId: farm.id, action: "count", recordId: count.id, recordNo: count.no, reason: v.reason }, opts.at);
  return count;
}

// ── setup (A8 farms & sheds, A9 items) ───────────────────────────────────
// Nothing is deleted: farms, sheds and items are deactivated. Every change is in the audit log.

export type FarmPatch = { id: string; name: string; type: Farm["type"]; active: boolean; by: string };

export function updateFarm(state: MockState, input: FarmPatch) {
  const farm = getFarm(state, input.id);
  if (!input.name.trim()) throw new ApiError("err.required");
  const old = `${farm.name} · ${farm.type} · ${farm.active ? "active" : "inactive"}`;
  Object.assign(farm, { name: input.name.trim(), type: input.type, active: input.active });
  audit(state, { user: input.by, farmId: farm.id, action: "setup", recordId: farm.id, recordNo: farm.code, old, new: `${farm.name} · ${farm.type} · ${farm.active ? "active" : "inactive"}` });
  return farm;
}

export function addShed(state: MockState, input: { farmId: string; name: string; by: string }) {
  const farm = getFarm(state, input.farmId);
  const name = input.name.trim();
  if (!name) throw new ApiError("err.required");
  if (farm.sheds.some((s) => s.name.toLowerCase() === name.toLowerCase())) throw new ApiError("err.duplicateName");
  const shed = { id: `${farm.id}-s${state.nextId++}`, farmId: farm.id, name, active: true };
  farm.sheds.push(shed);
  audit(state, { user: input.by, farmId: farm.id, action: "setup", recordId: shed.id, recordNo: `${farm.code} ${name}`, new: name });
  return shed;
}

export function updateShed(state: MockState, input: { id: string; name: string; active: boolean; by: string }) {
  const farm = state.farms.find((f) => f.sheds.some((s) => s.id === input.id));
  const shed = farm?.sheds.find((s) => s.id === input.id);
  if (!farm || !shed) throw new ApiError("err.notFound");
  const name = input.name.trim();
  if (!name) throw new ApiError("err.required");
  if (farm.sheds.some((s) => s.id !== shed.id && s.name.toLowerCase() === name.toLowerCase())) throw new ApiError("err.duplicateName");
  const old = `${shed.name}${shed.active ? "" : " (inactive)"}`;
  Object.assign(shed, { name, active: input.active });
  audit(state, { user: input.by, farmId: farm.id, action: "setup", recordId: shed.id, recordNo: `${farm.code} ${name}`, old, new: `${shed.name}${shed.active ? "" : " (inactive)"}` });
  return shed;
}

export type ItemInput = Omit<Item, "id" | "number"> & { id?: string; by: string };

/** Adds an item (id omitted) or edits one. The unit can't change once the item has stock movements. */
export function saveItem(state: MockState, input: ItemInput) {
  const name = input.name.trim();
  if (!name || !input.nameUr.trim() || !input.category.trim()) throw new ApiError("err.required");
  if (state.items.some((i) => i.id !== input.id && i.name.toLowerCase() === name.toLowerCase())) throw new ApiError("err.duplicateName");
  const fields = {
    name,
    nameUr: input.nameUr.trim(),
    aliases: input.aliases.map((a) => a.trim()).filter(Boolean),
    category: input.category.trim(),
    unit: input.unit,
    isFeed: input.isFeed,
    active: input.active,
  };
  if (input.id) {
    const item = state.items.find((i) => i.id === input.id);
    if (!item) throw new ApiError("err.notFound");
    if (item.unit !== fields.unit && state.movements.some((m) => m.itemId === item.id)) throw new ApiError("err.unitLocked");
    const old = `${item.name} · ${item.unit} · ${item.category}${item.active ? "" : " (inactive)"}`;
    Object.assign(item, fields);
    audit(state, { user: input.by, action: "setup", recordId: item.id, recordNo: item.name, old, new: `${item.name} · ${item.unit} · ${item.category}${item.active ? "" : " (inactive)"}` });
    return item;
  }
  const item: Item = { id: newId(state, "item-"), number: Math.max(0, ...state.items.map((i) => i.number)) + 1, ...fields };
  state.items.push(item);
  audit(state, { user: input.by, action: "setup", recordId: item.id, recordNo: item.name, new: `${item.name} · ${item.unit} · ${item.category}` });
  return item;
}
