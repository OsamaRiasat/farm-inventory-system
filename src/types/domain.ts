// Data shapes from the design spec — the contract the backend will implement.
// See docs/kb/03-data-and-api.md before changing anything here.

export const UNITS = ["KG", "LTR", "QTY", "BG", "ROLL", "VIAL", "MAUND"] as const;
export type Unit = (typeof UNITS)[number];
/** DR = Daily Report (eggs and trays, once a day per farm — T07). */
export type SlipType = "IGP" | "OGP" | "SIS" | "DR";
export const SLIP_TYPES = ["IGP", "OGP", "SIS", "DR"] as const satisfies readonly SlipType[];
export type SlipStatus = "saved" | "corrected" | "cancelled";
export type FarmType = "breeder" | "layer" | "hatchery";

export interface Shed {
  id: string;
  farmId: string;
  name: string;
  active: boolean;
}

export interface Farm {
  id: string;
  code: string;
  name: string;
  type: FarmType;
  sheds: Shed[];
  active: boolean;
}

export interface Item {
  id: string;
  number: number;
  name: string;
  nameUr: string;
  aliases: string[];
  category: string;
  unit: Unit;
  isFeed: boolean;
  active: boolean;
}

export interface SlipBase {
  id: string;
  no: string; // AW02-IGP-1663 — the system's number, unique across farms
  /** The number on the farm's paper slip book, typed by the farm ("IGP-0123"). Shown to farms instead of `no`. */
  paperNo: string;
  type: SlipType;
  farmId: string;
  /** ISO date the goods came in (IGP) / went out (OGP) / were used (SIS). Any past date (previous months too), never future. */
  date: string;
  time: string; // HH:mm
  /** Local date-time the slip was saved ("posted"), automatic. */
  postedAt: string;
  preparedBy: string;
  status: SlipStatus;
  correctionOf?: string;
  correctedBy?: string;
}

export interface IGP extends SlipBase {
  type: "IGP";
  source: { kind: "supplier" | "farm" | "other"; farmId?: string; ms?: string };
  transferId?: string;
  biltyNo?: string;
  truckNo?: string;
  driverName?: string;
  demandNo?: string;
  challanNo?: string;
  challanDate?: string;
  /** bags: feed items only (`Item.isFeed`), typed next to the KG — client #26. */
  lines: { itemId: string; qtyChallan: number; qtyReceived: number; weightKg?: number; bags?: number }[];
  /** Optional free note for the whole slip (Urdu or English, ≤ 200 characters). Kept as first saved. */
  remarks?: string;
}

export interface OGP extends SlipBase {
  type: "OGP";
  to: { kind: "farm" | "outside"; farmId?: string; ms?: string; reason?: "repair" | "return" | "other" };
  transferId?: string;
  driverName?: string;
  vehicleNo?: string;
  lines: { itemId: string; qty: number; weightKg?: number; bags?: number }[];
  /** Optional free note for the whole slip (Urdu or English, ≤ 200 characters). Kept as first saved. */
  remarks?: string;
}

export interface SIS extends SlipBase {
  type: "SIS";
  /** Feed & mortality per shed. No longer entered (client, 30 Oct 2026): feed is a normal item line. Kept for old slips. */
  shedRows: { shedId: string; feedItemId: string; feedKg: number; mortMale: number; mortFemale: number }[];
  /** ledgerFolio: the page in the farm storekeeper's own ledger, typed per line. */
  lines: { itemId: string; qty: number; bags?: number; ledgerFolio?: string; purpose?: string; shedId?: string }[];
}

/**
 * Daily Report (T07): the farm's egg and tray counts for one date — one per farm per date (cancelled ones don't count).
 * Only the eggs left after hatching, market and discarded go into stock, as the one line
 * `{ itemId: <Eggs>, qty: eggsReceived − hatchingEggs − marketEggs − discardedEggs }` (no line when that is 0).
 * Trays and boxes are recorded only; they never change stock. All counts are whole numbers ≥ 0.
 */
export interface DR extends SlipBase {
  type: "DR";
  eggsReceived: number;
  hatchingEggs: number;
  marketEggs: number;
  discardedEggs: number;
  gattaTray: number;
  plasticTray: number;
  eggsBox: number;
  /** Eggs added to stock (derived by the server, never typed). No bags: `never` keeps `line.bags` readable on any slip. */
  lines: { itemId: string; qty: number; bags?: never }[];
  remarks?: string;
}

export type Slip = IGP | OGP | SIS | DR;

/**
 * Unused items brought back after an SIS ("Return unused"). The SIS stays as issued; stock goes up on the
 * return date. Points at the SIS it was saved on (later corrections of that SIS keep its returns).
 * No paper slip exists for returns, so there is no paperNo.
 */
export interface SISReturn {
  id: string;
  no: string; // AW02-SIS-0484-R1
  /** The SIS (or its correction) the return was saved on. */
  sisId: string;
  farmId: string;
  /** ISO date the items came back: not before the issue date, never after today. */
  date: string;
  postedAt: string;
  by: string;
  /** lineIndex = the SIS line the items came back from. */
  lines: { lineIndex: number; itemId: string; qty: number }[];
  remarks?: string;
  status: "saved" | "cancelled";
  cancelled?: { by: string; at: string; reason: string };
}

export interface Transfer {
  id: string;
  ogpId: string;
  igpId?: string;
  fromFarmId: string;
  toFarmId: string;
  // "cancelled" added to the spec's set: an OGP cancelled while still in transit.
  status: "in_transit" | "received" | "short" | "cancelled";
  sentAt: string;
  receivedAt?: string;
  /** Admin's decision on a shortfall (A5 Resolve). */
  resolution?: { kind: "written_off"; by: string; at: string; reason: string };
}

export interface Movement {
  id: string;
  farmId: string;
  itemId: string;
  /** Slip id, SIS return id, stock count id, or "opening" for opening balances. */
  slipId: string;
  date: string;
  qtyIn: number;
  qtyOut: number;
}

// Shapes below are not in the spec; designed in week 2. Review with the backend developer.

export interface User {
  id: string;
  name: string;
  /** Sign-in name: small letters, digits, . _ - */
  username: string;
  role: "farm" | "admin";
  farmId?: string;
  phone: string;
  active: boolean;
}

export interface CorrectionRequest {
  id: string;
  slipId: string;
  farmId: string;
  lineIndex: number;
  requestedQty: number;
  reason: string;
  requestedBy: string;
  at: string; // ISO date-time
  status: "open" | "approved" | "rejected";
  /** Admin's note on a rejection, shown to the farm on F7. */
  note?: string;
  correctionId?: string;
}

export interface StockCount {
  id: string;
  no: string; // AW02-CNT-0003
  farmId: string;
  date: string;
  time: string;
  preparedBy: string;
  reason: string;
  lines: { itemId: string; systemQty: number; countedQty: number }[];
}

/** A farm's request for an item that isn't in the list (client #30). Becomes an Item only when the Admin approves. */
export interface ItemRequest {
  id: string;
  farmId: string;
  name: string;
  nameUr: string;
  category: string;
  unit: Unit;
  requestedBy: string;
  at: string; // ISO date-time
  status: "pending" | "approved" | "rejected";
  /** Admin's note on a rejection. */
  note?: string;
  /** The item created on approval. */
  itemId?: string;
}

export interface AuditEntry {
  id: string;
  at: string; // ISO date-time
  user: string;
  farmId?: string;
  action:
    | "save"
    | "receive"
    | "correct"
    | "cancel"
    | "return"
    | "cancel_return"
    | "count"
    | "request_correction"
    | "reject_correction"
    | "resolve_shortfall"
    | "request_item"
    | "approve_item"
    | "reject_item"
    | "setup"
    | "add_user"
    | "edit_user"
    | "set_password"
    | "reset_demo";
  recordId: string;
  recordNo: string;
  old?: string;
  new?: string;
  reason?: string;
}
