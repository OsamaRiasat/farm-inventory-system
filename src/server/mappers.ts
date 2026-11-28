// Database rows ↔ the domain types in src/types/domain.ts (the API contract).
// Optional fields are left out when empty, as the mock did, so JSON responses look the same.

import type { Prisma } from "@/generated/prisma/client";
import type {
  AuditEntry,
  CorrectionRequest,
  DR,
  Farm,
  IGP,
  Item,
  ItemRequest,
  Movement,
  OGP,
  SIS,
  SISReturn,
  Slip,
  StockCount,
  Transfer,
  User,
} from "@/types/domain";
import { paperNoKey } from "@/lib/slip-rules";

/** Drops undefined / null keys. */
function clean<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined || o[k] === null) delete o[k];
  return o;
}
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);
const num = (v: number | null | undefined) => v ?? 0;

// ── setup ──

export const farmInclude = { sheds: { orderBy: { seq: "asc" } } } satisfies Prisma.FarmInclude;
type FarmRow = Prisma.FarmGetPayload<{ include: typeof farmInclude }>;

export function toFarm(r: FarmRow): Farm {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    active: r.active,
    sheds: r.sheds.map((s) => ({ id: s.id, farmId: s.farmId, name: s.name, active: s.active })),
  };
}

export function toItem(r: Prisma.ItemModel): Item {
  return {
    id: r.id,
    number: r.number,
    name: r.name,
    nameUr: r.nameUr,
    aliases: r.aliases,
    category: r.category,
    unit: r.unit,
    isFeed: r.isFeed,
    active: r.active,
  };
}

export function toUser(r: Prisma.UserModel): User {
  return clean({ id: r.id, name: r.name, username: r.username, role: r.role, farmId: opt(r.farmId), phone: r.phone, active: r.active });
}

// ── slips ──

export const slipInclude = { lines: { orderBy: { index: "asc" } } } satisfies Prisma.SlipInclude;
export type SlipRow = Prisma.SlipGetPayload<{ include: typeof slipInclude }>;

export function toSlip(r: SlipRow): Slip {
  const base = clean({
    id: r.id,
    no: r.no,
    paperNo: r.paperNo,
    farmId: r.farmId,
    date: r.date,
    time: r.time,
    postedAt: r.postedAt,
    preparedBy: r.preparedBy,
    status: r.status,
    correctionOf: opt(r.correctionOf),
    correctedBy: opt(r.correctedBy),
  });
  switch (r.type) {
    case "IGP":
      return clean<IGP>({
        ...base,
        type: "IGP",
        source: clean({ kind: r.sourceKind as IGP["source"]["kind"], farmId: opt(r.sourceFarmId), ms: opt(r.sourceMs) }),
        transferId: opt(r.transferId),
        biltyNo: opt(r.biltyNo),
        truckNo: opt(r.truckNo),
        driverName: opt(r.driverName),
        demandNo: opt(r.demandNo),
        challanNo: opt(r.challanNo),
        challanDate: opt(r.challanDate),
        lines: r.lines.map((l) =>
          clean({
            itemId: l.itemId,
            qtyChallan: num(l.qtyChallan),
            qtyReceived: num(l.qtyReceived),
            weightKg: opt(l.weightKg),
            bags: opt(l.bags),
          }),
        ),
        remarks: opt(r.remarks),
      });
    case "OGP":
      return clean<OGP>({
        ...base,
        type: "OGP",
        to: clean({
          kind: r.toKind as OGP["to"]["kind"],
          farmId: opt(r.toFarmId),
          ms: opt(r.toMs),
          reason: opt(r.toReason) as OGP["to"]["reason"],
        }),
        transferId: opt(r.transferId),
        driverName: opt(r.driverName),
        vehicleNo: opt(r.vehicleNo),
        lines: r.lines.map((l) => clean({ itemId: l.itemId, qty: num(l.qty), weightKg: opt(l.weightKg), bags: opt(l.bags) })),
        remarks: opt(r.remarks),
      });
    case "SIS":
      return {
        ...base,
        type: "SIS",
        shedRows: (r.shedRows as SIS["shedRows"] | null) ?? [],
        lines: r.lines.map((l) =>
          clean({
            itemId: l.itemId,
            qty: num(l.qty),
            bags: opt(l.bags),
            ledgerFolio: opt(l.ledgerFolio),
            purpose: opt(l.purpose),
            shedId: opt(l.shedId),
          }),
        ),
      };
    case "DR":
      return clean<DR>({
        ...base,
        type: "DR",
        eggsReceived: num(r.eggsReceived),
        hatchingEggs: num(r.hatchingEggs),
        marketEggs: num(r.marketEggs),
        discardedEggs: num(r.discardedEggs),
        gattaTray: num(r.gattaTray),
        plasticTray: num(r.plasticTray),
        eggsBox: num(r.eggsBox),
        lines: r.lines.map((l) => ({ itemId: l.itemId, qty: num(l.qty) })),
        remarks: opt(r.remarks),
      });
  }
}

/** Slip header columns (no lines) for insert / update. */
export function slipData(s: Slip): Omit<Prisma.SlipUncheckedCreateInput, "lines"> {
  const common = {
    id: s.id,
    no: s.no,
    paperNo: s.paperNo,
    paperNoKey: paperNoKey(s.paperNo),
    type: s.type,
    farmId: s.farmId,
    date: s.date,
    time: s.time,
    postedAt: s.postedAt,
    preparedBy: s.preparedBy,
    status: s.status,
    correctionOf: s.correctionOf ?? null,
    correctedBy: s.correctedBy ?? null,
  };
  switch (s.type) {
    case "IGP":
      return {
        ...common,
        transferId: s.transferId ?? null,
        remarks: s.remarks ?? null,
        sourceKind: s.source.kind,
        sourceFarmId: s.source.farmId ?? null,
        sourceMs: s.source.ms ?? null,
        biltyNo: s.biltyNo ?? null,
        truckNo: s.truckNo ?? null,
        driverName: s.driverName ?? null,
        demandNo: s.demandNo ?? null,
        challanNo: s.challanNo ?? null,
        challanDate: s.challanDate ?? null,
      };
    case "OGP":
      return {
        ...common,
        transferId: s.transferId ?? null,
        remarks: s.remarks ?? null,
        toKind: s.to.kind,
        toFarmId: s.to.farmId ?? null,
        toMs: s.to.ms ?? null,
        toReason: s.to.reason ?? null,
        driverName: s.driverName ?? null,
        vehicleNo: s.vehicleNo ?? null,
      };
    case "SIS":
      return { ...common, shedRows: s.shedRows.length ? s.shedRows : undefined };
    case "DR":
      return {
        ...common,
        remarks: s.remarks ?? null,
        eggsReceived: s.eggsReceived,
        hatchingEggs: s.hatchingEggs,
        marketEggs: s.marketEggs,
        discardedEggs: s.discardedEggs,
        gattaTray: s.gattaTray,
        plasticTray: s.plasticTray,
        eggsBox: s.eggsBox,
      };
  }
}

export function slipLineData(s: Slip): Prisma.SlipLineCreateManyInput[] {
  switch (s.type) {
    case "IGP":
      return s.lines.map((l, index) => ({
        slipId: s.id,
        index,
        itemId: l.itemId,
        qtyChallan: l.qtyChallan,
        qtyReceived: l.qtyReceived,
        weightKg: l.weightKg ?? null,
        bags: l.bags ?? null,
      }));
    case "OGP":
      return s.lines.map((l, index) => ({
        slipId: s.id,
        index,
        itemId: l.itemId,
        qty: l.qty,
        weightKg: l.weightKg ?? null,
        bags: l.bags ?? null,
      }));
    case "SIS":
      return s.lines.map((l, index) => ({
        slipId: s.id,
        index,
        itemId: l.itemId,
        qty: l.qty,
        bags: l.bags ?? null,
        ledgerFolio: l.ledgerFolio ?? null,
        purpose: l.purpose ?? null,
        shedId: l.shedId ?? null,
      }));
    case "DR":
      return s.lines.map((l, index) => ({ slipId: s.id, index, itemId: l.itemId, qty: l.qty }));
  }
}

// ── stock and the rest ──

export function toTransfer(r: Prisma.TransferModel): Transfer {
  return clean<Transfer>({
    id: r.id,
    ogpId: r.ogpId,
    igpId: opt(r.igpId),
    fromFarmId: r.fromFarmId,
    toFarmId: r.toFarmId,
    status: r.status,
    sentAt: r.sentAt,
    receivedAt: opt(r.receivedAt),
    resolution:
      r.resolutionKind === "written_off"
        ? { kind: "written_off", by: r.resolutionBy ?? "", at: r.resolutionAt ?? "", reason: r.resolutionReason ?? "" }
        : undefined,
  });
}

export function toMovement(r: Prisma.MovementModel): Movement {
  return { id: `m${r.id}`, farmId: r.farmId, itemId: r.itemId, slipId: r.slipId, date: r.date, qtyIn: r.qtyIn, qtyOut: r.qtyOut };
}

export const returnInclude = { lines: { orderBy: { index: "asc" } } } satisfies Prisma.SisReturnInclude;
type ReturnRow = Prisma.SisReturnGetPayload<{ include: typeof returnInclude }>;

export function toReturn(r: ReturnRow): SISReturn {
  return clean<SISReturn>({
    id: r.id,
    no: r.no,
    sisId: r.sisId,
    farmId: r.farmId,
    date: r.date,
    postedAt: r.postedAt,
    by: r.by,
    lines: r.lines.map((l) => ({ lineIndex: l.lineIndex, itemId: l.itemId, qty: l.qty })),
    remarks: opt(r.remarks),
    status: r.status,
    cancelled: r.cancelledAt ? { by: r.cancelledBy ?? "", at: r.cancelledAt, reason: r.cancelReason ?? "" } : undefined,
  });
}

export const countInclude = { lines: { orderBy: { index: "asc" } } } satisfies Prisma.StockCountInclude;
type CountRow = Prisma.StockCountGetPayload<{ include: typeof countInclude }>;

export function toStockCount(r: CountRow): StockCount {
  return {
    id: r.id,
    no: r.no,
    farmId: r.farmId,
    date: r.date,
    time: r.time,
    preparedBy: r.preparedBy,
    reason: r.reason,
    lines: r.lines.map((l) => ({ itemId: l.itemId, systemQty: l.systemQty, countedQty: l.countedQty })),
  };
}

export function toCorrection(r: Prisma.CorrectionRequestModel): CorrectionRequest {
  return clean<CorrectionRequest>({
    id: r.id,
    slipId: r.slipId,
    farmId: r.farmId,
    lineIndex: r.lineIndex,
    requestedQty: r.requestedQty,
    reason: r.reason,
    requestedBy: r.requestedBy,
    at: r.at,
    status: r.status,
    note: opt(r.note),
    correctionId: opt(r.correctionId),
  });
}

export function toItemRequest(r: Prisma.ItemRequestModel): ItemRequest {
  return clean<ItemRequest>({
    id: r.id,
    farmId: r.farmId,
    name: r.name,
    nameUr: r.nameUr,
    category: r.category,
    unit: r.unit,
    requestedBy: r.requestedBy,
    at: r.at,
    status: r.status,
    note: opt(r.note),
    itemId: opt(r.itemId),
  });
}

export function toAudit(r: Prisma.AuditEntryModel): AuditEntry {
  return clean<AuditEntry>({
    id: `a${r.id}`,
    at: r.at,
    user: r.user,
    farmId: opt(r.farmId),
    action: r.action as AuditEntry["action"],
    recordId: r.recordId,
    recordNo: r.recordNo,
    old: opt(r.old),
    new: opt(r.new),
    reason: opt(r.reason),
  });
}
