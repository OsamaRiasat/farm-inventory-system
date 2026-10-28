import type { MsgId } from "@/lib/i18n";
import type { Movement, OGP, IGP, Slip, SlipStatus, SlipType, Transfer } from "@/types/domain";

// API-only shapes (filters, results). Domain shapes live in src/types/domain.ts.

export type { IgpInput, ReceiveInput } from "@/features/igp/schema";
export type { OgpInput } from "@/features/ogp/schema";
export type { SisInput } from "@/features/sis/schema";
export type { StockCountInput } from "@/features/stock-count/schema";

export type SlipFilters = {
  farmId?: string;
  type?: SlipType;
  status?: SlipStatus;
  from?: string; // ISO date, inclusive
  to?: string; // ISO date, inclusive
  itemId?: string;
  /** Part of a slip number, any case. */
  no?: string;
};

export type StockRow = { itemId: string; qty: number };

export type StockMatrix = {
  /** farmId → itemId → quantity on hand. */
  farms: Record<string, Record<string, number>>;
  /** itemId → quantity sent on an OGP and not yet received. */
  inTransit: Record<string, number>;
};

export type StockCardRow = Movement & {
  balance: number;
  /** Slip number, stock count number, or "Opening balance". */
  ref: string;
  kind: SlipType | "COUNT" | "OPENING";
};

export type TransferView = { transfer: Transfer; ogp: OGP; igp?: IGP };

export type FarmToday = { farmId: string; igp: number; ogp: number; sis: number; lastSlipTime: string | null };

export type Dashboard = {
  tiles: { slipsToday: number; inTransit: number; inTransitOld: number; shortfalls: number; corrections: number };
  farmsToday: FarmToday[];
  latest: Slip[];
};

export type CorrectionInput = {
  slipId: string;
  /** New quantity per line index: IGP → Qty Actual Received, OGP / SIS → Qty. */
  lines: { index: number; qty: number }[];
  reason: string;
  by: string;
  /** The farm's request this correction answers, if any. */
  requestId?: string;
};

export type CorrectionRequestInput = {
  slipId: string;
  lineIndex: number;
  requestedQty: number;
  reason: string;
  requestedBy: string;
};

export type ReportType =
  | "stock-on-hand"
  | "item-stock-card"
  | "consumption"
  | "feed-mortality"
  | "gate-register"
  | "transfers"
  | "out-for-repair"
  | "corrections";

export type ReportFilters = SlipFilters & { category?: string };

/** How a report cell is shown: a number, a date, a slip link, a type / status chip, a farm name … */
export type ReportCellKind = "text" | "qty" | "date" | "stamp" | "slip" | "type" | "status" | "action" | "farm" | "item" | "unit";

export type ReportColumn = { key: string; label: MsgId; kind: ReportCellKind };
export type ReportRow = Record<string, string | number | null>;

/** Every report is a table (+ an optional line chart), so one screen shows all eight. */
export type ReportResult = {
  columns: ReportColumn[];
  rows: ReportRow[];
  totals?: ReportRow;
  /** Shown instead of rows when the report needs more filters (e.g. pick a farm and an item). */
  note?: MsgId;
  /** Feed & mortality: one line per shed, daily mortality. */
  series?: { name: string; points: { date: string; value: number }[] }[];
};

export type MockOptions = {
  /** Delay on every call, so loading states show. */
  latencyMs: number;
  /** Every save fails with "Not saved", to demo the error state. */
  failSaves: boolean;
};
