// Saving IGP / OGP / SIS and receiving transfers. Ported from the mock engine; same Zod schemas, same messages.

import { igpSchema, receiveSchema } from "@/features/igp/schema";
import { ogpSchema } from "@/features/ogp/schema";
import { sisSchema } from "@/features/sis/schema";
import { drSchema, eggsToStock } from "@/features/daily-report/schema";
import { ApiError } from "@/lib/api/errors";
import type { SlipFilters } from "@/lib/api/types";
import { nowStamp } from "@/lib/dates";
import { slipDeltas } from "@/lib/slip-rules";
import { feedBagsOnly } from "@/lib/validation";
import type { AuditEntry, DR, IGP, OGP, SIS, Slip, Transfer } from "@/types/domain";
import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "../db";
import { slipInclude, toSlip } from "../mappers";
import {
  addMovements,
  audit,
  getFarm,
  getSlip,
  getTransfer,
  insertSlip,
  itemIdsOf,
  nextNo,
  parse,
  remember,
  remembered,
  rulesFor,
  withFarmLock,
  type SaveOpts,
} from "../repo";

const farmIdOf = (input: unknown) => String((input as { farmId?: unknown })?.farmId ?? "");
const keyOf = (input: unknown) => (input as { idempotencyKey?: unknown })?.idempotencyKey;
const paperOf = (input: unknown) => (input as { paperNo?: unknown })?.paperNo;

async function base(
  tx: Tx,
  v: { farmId: string; paperNo: string; date: string; time: string; preparedBy: string },
  kind: Slip["type"],
  opts: SaveOpts,
) {
  const farm = await getFarm(tx, v.farmId);
  const no = await nextNo(tx, farm, kind, opts.no);
  return {
    id: no,
    no,
    paperNo: v.paperNo,
    farmId: farm.id,
    date: v.date,
    time: v.time,
    postedAt: opts.at ?? nowStamp(),
    preparedBy: v.preparedBy,
    status: "saved" as const,
  };
}

async function commitSlip(tx: Tx, slip: Slip, key: string, opts: SaveOpts, action: AuditEntry["action"] = "save") {
  await insertSlip(tx, slip);
  await addMovements(tx, slip, slipDeltas(slip));
  await remember(tx, key, slip.id);
  await audit(tx, { user: slip.preparedBy, farmId: slip.farmId, action, recordId: slip.id, recordNo: slip.no }, opts.at);
  return slip;
}

export function saveIGP(input: unknown, opts: SaveOpts = {}): Promise<IGP> {
  return withFarmLock([farmIdOf(input)], async (tx) => {
    const done = await remembered(tx, keyOf(input));
    if (done) return (await getSlip(tx, done)) as IGP;
    const rules = await rulesFor(tx, farmIdOf(input), { itemIds: itemIdsOf(input), paperNo: { type: "IGP", value: paperOf(input) } }, opts.at);
    const v = parse(igpSchema(rules), input);
    const slip: IGP = {
      ...(await base(tx, v, "IGP", opts)),
      type: "IGP",
      source: v.source,
      biltyNo: v.biltyNo,
      truckNo: v.truckNo,
      driverName: v.driverName,
      demandNo: v.demandNo,
      challanNo: v.challanNo,
      challanDate: v.challanDate,
      lines: v.lines.map((l) => feedBagsOnly(rules, l.itemId, l)),
      remarks: v.remarks || undefined,
    };
    if (v.source.kind === "supplier") await tx.supplier.createMany({ data: [{ name: v.source.ms }], skipDuplicates: true });
    return (await commitSlip(tx, slip, v.idempotencyKey, opts)) as IGP;
  });
}

export function saveOGP(input: unknown, opts: SaveOpts = {}): Promise<OGP> {
  return withFarmLock([farmIdOf(input)], async (tx) => {
    const done = await remembered(tx, keyOf(input));
    if (done) return (await getSlip(tx, done)) as OGP;
    const rules = await rulesFor(tx, farmIdOf(input), { itemIds: itemIdsOf(input), paperNo: { type: "OGP", value: paperOf(input) } }, opts.at);
    const v = parse(ogpSchema(rules), input);
    if (v.to.kind === "farm") await getFarm(tx, v.to.farmId);
    const slip: OGP = {
      ...(await base(tx, v, "OGP", opts)),
      type: "OGP",
      to: v.to,
      driverName: v.driverName,
      vehicleNo: v.vehicleNo,
      lines: v.lines.map((l) => feedBagsOnly(rules, l.itemId, l)),
      remarks: v.remarks || undefined,
    };
    let transfer: Transfer | undefined;
    if (v.to.kind === "farm") {
      transfer = {
        id: `T-${slip.no}`,
        ogpId: slip.id,
        fromFarmId: slip.farmId,
        toFarmId: v.to.farmId,
        status: "in_transit",
        sentAt: `${slip.date}T${slip.time}`,
      };
      slip.transferId = transfer.id;
    }
    await commitSlip(tx, slip, v.idempotencyKey, opts);
    if (transfer) await tx.transfer.create({ data: transfer });
    return slip;
  });
}

export function saveSIS(input: unknown, opts: SaveOpts = {}): Promise<SIS> {
  return withFarmLock([farmIdOf(input)], async (tx) => {
    const done = await remembered(tx, keyOf(input));
    if (done) return (await getSlip(tx, done)) as SIS;
    const rules = await rulesFor(tx, farmIdOf(input), { itemIds: itemIdsOf(input), paperNo: { type: "SIS", value: paperOf(input) } }, opts.at);
    const v = parse(sisSchema(rules), input);
    const slip: SIS = {
      ...(await base(tx, v, "SIS", opts)),
      type: "SIS",
      shedRows: v.shedRows,
      lines: v.lines.map((l) => feedBagsOnly(rules, l.itemId, l)),
    };
    return (await commitSlip(tx, slip, v.idempotencyKey, opts)) as SIS;
  });
}

/** The stock item a Daily Report's eggs go into (category "Current Assets"; found by name, any case). */
export const EGGS_ITEM_NAME = "Eggs";

async function eggsItemId(tx: Tx) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Item" WHERE lower(btrim(name)) = lower(${EGGS_ITEM_NAME}) LIMIT 1`;
  if (!rows[0]) throw new Error(`Item "${EGGS_ITEM_NAME}" is missing — run the T07 migration or the seed`);
  return rows[0].id;
}

/**
 * T07 Daily Report: one per farm per date (cancelled ones don't count). Only one stock movement:
 * Eggs in = Total − Hatching − Market − Discarded (none when 0). Trays and boxes are recorded only.
 */
export function saveDR(input: unknown, opts: SaveOpts = {}): Promise<DR> {
  return withFarmLock([farmIdOf(input)], async (tx) => {
    const done = await remembered(tx, keyOf(input));
    if (done) return (await getSlip(tx, done)) as DR;
    const farmId = farmIdOf(input);
    const date = (input as { date?: unknown })?.date;
    const rules = await rulesFor(tx, farmId, { itemIds: [], paperNo: { type: "DR", value: paperOf(input) } }, opts.at);
    const existing =
      typeof date === "string" && date
        ? await tx.slip.findFirst({
            where: { farmId, type: "DR", date, correctionOf: null, status: { not: "cancelled" } },
            select: { no: true, paperNo: true },
          })
        : null;
    const v = parse(drSchema({ ...rules, reportOn: (d) => (existing && d === date ? existing.paperNo || existing.no : undefined) }), input);
    const eggs = eggsToStock(v);
    const slip: DR = {
      ...(await base(tx, v, "DR", opts)),
      type: "DR",
      eggsReceived: v.eggsReceived,
      hatchingEggs: v.hatchingEggs,
      marketEggs: v.marketEggs,
      discardedEggs: v.discardedEggs,
      gattaTray: v.gattaTray,
      plasticTray: v.plasticTray,
      eggsBox: v.eggsBox,
      lines: eggs > 0 ? [{ itemId: await eggsItemId(tx), qty: eggs }] : [],
      remarks: v.remarks || undefined,
    };
    return (await commitSlip(tx, slip, v.idempotencyKey, opts)) as DR;
  });
}

/** Farms a transfer touches, read before locking (they never change). */
async function transferFarms(transferId: string) {
  const t = await db().transfer.findUnique({ where: { id: transferId }, select: { fromFarmId: true, toFarmId: true } });
  return t ? [t.fromFarmId, t.toFarmId] : [];
}

export async function receiveTransfer(input: unknown, opts: SaveOpts = {}): Promise<IGP> {
  const transferId = String((input as { transferId?: unknown })?.transferId ?? "");
  return withFarmLock(await transferFarms(transferId), async (tx) => {
    const done = await remembered(tx, keyOf(input));
    if (done) return (await getSlip(tx, done)) as IGP;
    const transfer = await getTransfer(tx, transferId);
    if (!transfer) throw new ApiError("err.notFound");
    if (transfer.status !== "in_transit") throw new ApiError("err.transferClosed");
    if (farmIdOf(input) !== transfer.toFarmId) throw new ApiError("err.notFound");

    const ogp = (await getSlip(tx, transfer.ogpId)) as OGP;
    const sent = ogp.lines.map((l) => ({ itemId: l.itemId, qty: l.qty }));
    const rules = await rulesFor(
      tx,
      transfer.toFarmId,
      { itemIds: sent.map((s) => s.itemId), paperNo: { type: "IGP", value: paperOf(input) } },
      opts.at,
    );
    const v = parse(receiveSchema(rules, sent), input);
    const slip: IGP = {
      ...(await base(tx, v, "IGP", opts)),
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
        bags: rules.item(s.itemId)?.isFeed ? v.lines[i].bags : undefined,
      })),
      remarks: v.remarks || undefined,
    };
    await commitSlip(tx, slip, v.idempotencyKey, opts, "receive");
    await tx.transfer.update({
      where: { id: transfer.id },
      data: {
        igpId: slip.id,
        receivedAt: `${slip.date}T${slip.time}`,
        status: slip.lines.some((l) => l.qtyReceived < l.qtyChallan) ? "short" : "received",
      },
    });
    return slip;
  });
}

// ── reads ──

export async function getSlipById(id: string) {
  return getSlip(db(), id);
}

/** Newest first. */
export async function listSlips(f: SlipFilters = {}): Promise<Slip[]> {
  const and: Prisma.SlipWhereInput[] = [];
  if (f.farmId) and.push({ farmId: f.farmId });
  if (f.type) and.push({ type: f.type });
  if (f.status) and.push({ status: f.status });
  if (f.from) and.push({ date: { gte: f.from } });
  if (f.to) and.push({ date: { lte: f.to } });
  const no = f.no?.trim();
  if (no) and.push({ OR: [{ no: { contains: no, mode: "insensitive" } }, { paperNo: { contains: no, mode: "insensitive" } }] });
  if (f.itemId) {
    and.push({
      OR: [{ lines: { some: { itemId: f.itemId } } }, { shedRows: { array_contains: [{ feedItemId: f.itemId }] } }],
    });
  }
  const rows = await db().slip.findMany({
    where: { AND: and },
    include: slipInclude,
    orderBy: [{ date: "desc" }, { time: "desc" }],
  });
  return rows.map(toSlip);
}
