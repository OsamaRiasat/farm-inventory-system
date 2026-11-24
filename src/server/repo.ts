// Data access used by the services, always inside a transaction (`tx`). Rule logic lives in the services.

import type { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { nowStamp, today } from "@/lib/dates";
import { fmtQty } from "@/lib/format";
import { formatNo, paperNoKey, round3 } from "@/lib/slip-rules";
import { toFieldErrors, type RuleContext } from "@/lib/validation";
import type { AuditEntry, Farm, Item, SISReturn, Slip, SlipType, Transfer } from "@/types/domain";
import { db, type Tx } from "./db";
import {
  farmInclude,
  returnInclude,
  slipData,
  slipInclude,
  slipLineData,
  toFarm,
  toItem,
  toReturn,
  toSlip,
  toTransfer,
} from "./mappers";

/** Seed-only overrides: a fixed slip number and the time the action happened. */
export type SaveOpts = { no?: number; at?: string };

// ── transactions ──

/**
 * Runs `fn` in one transaction holding a lock per farm (sorted, so two farms never deadlock).
 * Every stock change at a farm goes through here, so two saves racing for the last stock run one after
 * the other: the second sees the first one's movements and gets "Only n in stock".
 */
export function withFarmLock<T>(farmIds: (string | undefined)[], fn: (tx: Tx) => Promise<T>): Promise<T> {
  const ids = [...new Set(farmIds.filter((x): x is string => !!x))].sort();
  return db().$transaction(
    async (tx) => {
      for (const id of ids) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"farm:" + id}))`;
      return fn(tx);
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}

/** A transaction without farm locks (setup changes, correction requests). */
export function inTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db().$transaction(fn, { timeout: 20_000, maxWait: 10_000 });
}

// ── validation ──

export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const errors = toFieldErrors(result.error);
    throw new ApiError(errors[0].id, errors[0].values, errors);
  }
  return result.data;
}

/** Item ids an input mentions (lines and old SIS feed rows), to load just those items and balances. */
export function itemIdsOf(input: unknown, extra: string[] = []) {
  const v = input as { lines?: { itemId?: unknown }[]; shedRows?: { feedItemId?: unknown }[] } | null;
  const ids = new Set(extra);
  for (const l of Array.isArray(v?.lines) ? v.lines : []) if (typeof l?.itemId === "string") ids.add(l.itemId);
  for (const r of Array.isArray(v?.shedRows) ? v.shedRows : []) if (typeof r?.feedItemId === "string") ids.add(r.feedItemId);
  return [...ids];
}

/**
 * What the Zod schemas need (src/lib/validation.ts RuleContext), loaded for one save:
 * the items on the slip, their balances at this farm, today, and whether the paper No. is taken.
 */
export async function rulesFor(
  tx: Tx,
  farmId: string,
  q: { itemIds: string[]; paperNo?: { type: SlipType; value: unknown } },
  at?: string,
): Promise<RuleContext> {
  const [items, balances] = await Promise.all([
    tx.item.findMany({ where: { id: { in: q.itemIds } } }),
    balancesOf(tx, farmId, q.itemIds),
  ]);
  const byId = new Map(items.map((i) => [i.id, toItem(i)]));
  let used: { paperNo: string; no: string } | undefined;
  if (q.paperNo && typeof q.paperNo.value === "string" && q.paperNo.value.trim()) {
    const hit = await tx.slip.findFirst({
      where: { farmId, type: q.paperNo.type, correctionOf: null, paperNoKey: paperNoKey(q.paperNo.value) },
      select: { no: true },
    });
    if (hit) used = { paperNo: paperNoKey(q.paperNo.value), no: hit.no };
  }
  return {
    item: (id) => byId.get(id),
    stockOf: (id) => balances.get(id) ?? 0,
    today: at?.slice(0, 10) ?? today(),
    paperNoUsed: (_type, paperNo) => (used && used.paperNo === paperNoKey(paperNo) ? used.no : undefined),
  };
}

// ── reads ──

export async function getFarm(tx: Tx, farmId: string): Promise<Farm> {
  const row = await tx.farm.findUnique({ where: { id: farmId }, include: farmInclude });
  if (!row) throw new ApiError("err.notFound");
  return toFarm(row);
}

export async function getSlip(tx: Tx, slipId: string): Promise<Slip> {
  const row = await tx.slip.findUnique({ where: { id: slipId }, include: slipInclude });
  if (!row) throw new ApiError("err.notFound");
  return toSlip(row);
}

export async function findSlip(tx: Tx, slipId: string): Promise<Slip | undefined> {
  const row = await tx.slip.findUnique({ where: { id: slipId }, include: slipInclude });
  return row ? toSlip(row) : undefined;
}

export async function getTransfer(tx: Tx, transferId: string): Promise<Transfer | undefined> {
  const row = await tx.transfer.findUnique({ where: { id: transferId } });
  return row ? toTransfer(row) : undefined;
}

export async function itemName(tx: Tx, itemId: string) {
  return (await tx.item.findUnique({ where: { id: itemId }, select: { name: true } }))?.name ?? itemId;
}

export async function getItems(tx: Tx, ids: string[]): Promise<Map<string, Item>> {
  const rows = await tx.item.findMany({ where: { id: { in: ids } } });
  return new Map(rows.map((r) => [r.id, toItem(r)]));
}

/** itemId → quantity on hand at one farm (only the given items, or all). */
export async function balancesOf(tx: Tx, farmId: string, itemIds?: string[]): Promise<Map<string, number>> {
  const rows = await tx.movement.groupBy({
    by: ["itemId"],
    where: { farmId, ...(itemIds ? { itemId: { in: itemIds } } : {}) },
    _sum: { qtyIn: true, qtyOut: true },
  });
  return new Map(rows.map((r) => [r.itemId, round3((r._sum.qtyIn ?? 0) - (r._sum.qtyOut ?? 0))]));
}

/** The slip and every slip it corrects, newest first. */
export async function chain(tx: Tx, slip: Slip) {
  const list = [slip];
  let current = slip;
  while (current.correctionOf) {
    current = await getSlip(tx, current.correctionOf);
    list.push(current);
  }
  return list;
}

/** Every version of a slip: the latest correction and all it replaces. */
export async function family(tx: Tx, slip: Slip) {
  let head = slip;
  while (head.correctedBy) head = await getSlip(tx, head.correctedBy);
  return chain(tx, head);
}

/** Returns saved on any version of this SIS (cancelled ones too), oldest first. */
export async function returnsOf(tx: Tx, slip: Slip): Promise<SISReturn[]> {
  if (slip.type !== "SIS") return [];
  const ids = (await family(tx, slip)).map((s) => s.id);
  const rows = await tx.sisReturn.findMany({ where: { sisId: { in: ids } }, include: returnInclude });
  return rows.map(toReturn).sort((a, b) => a.date.localeCompare(b.date) || a.postedAt.localeCompare(b.postedAt));
}

// ── writes ──

/** Next number in the farm's own sequence for this kind (IGP, OGP, SIS, CNT). Call under the farm's lock. */
export async function nextNo(tx: Tx, farm: Farm, kind: string, override?: number) {
  const counter = await tx.counter.findUnique({ where: { farmId_kind: { farmId: farm.id, kind } } });
  const last = counter?.last ?? 0;
  const n = override ?? last + 1;
  await tx.counter.upsert({
    where: { farmId_kind: { farmId: farm.id, kind } },
    create: { farmId: farm.id, kind, last: n },
    update: { last: Math.max(last, n) },
  });
  const no = formatNo(farm, kind, n);
  const taken = (await tx.slip.count({ where: { no } })) + (await tx.stockCount.count({ where: { no } }));
  if (taken) throw new Error(`Duplicate number ${no}`);
  return no;
}

export async function insertSlip(tx: Tx, slip: Slip) {
  await tx.slip.create({ data: slipData(slip) as never });
  await tx.slipLine.createMany({ data: slipLineData(slip) });
}

export async function addMovements(
  tx: Tx,
  record: { id: string; farmId: string; date: string },
  entries: { itemId: string; delta: number }[],
) {
  const data = entries
    .filter((e) => e.delta !== 0)
    .map(({ itemId, delta }) => ({
      farmId: record.farmId,
      itemId,
      slipId: record.id,
      date: record.date,
      qtyIn: delta > 0 ? delta : 0,
      qtyOut: delta < 0 ? -delta : 0,
    }));
  if (data.length) await tx.movement.createMany({ data });
}

export async function audit(tx: Tx, entry: Omit<AuditEntry, "id" | "at">, at?: string) {
  await tx.auditEntry.create({
    data: {
      at: at ?? nowStamp(),
      user: entry.user,
      farmId: entry.farmId ?? null,
      action: entry.action,
      recordId: entry.recordId,
      recordNo: entry.recordNo,
      old: entry.old ?? null,
      new: entry.new ?? null,
      reason: entry.reason ?? null,
    },
  });
}

export async function remembered(tx: Tx, key: unknown): Promise<string | undefined> {
  if (typeof key !== "string" || !key) return undefined;
  return (await tx.idempotencyKey.findUnique({ where: { key } }))?.recordId;
}

export async function remember(tx: Tx, key: string, recordId: string) {
  await tx.idempotencyKey.create({ data: { key, recordId } });
}

/** Blocks a correction or cancel that would take any item below zero. */
export async function assertNotNegative(tx: Tx, farmId: string, deltas: { itemId: string; delta: number }[]) {
  const totals = new Map<string, number>();
  for (const { itemId, delta } of deltas) totals.set(itemId, (totals.get(itemId) ?? 0) + delta);
  const balances = await balancesOf(tx, farmId, [...totals.keys()]);
  for (const [itemId, delta] of totals) {
    const balance = balances.get(itemId) ?? 0;
    if (balance + delta < 0) {
      throw new ApiError("err.wouldGoNegative", { item: await itemName(tx, itemId), n: fmtQty(balance) });
    }
  }
}
