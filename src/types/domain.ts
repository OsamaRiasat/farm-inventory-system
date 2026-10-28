// Data shapes from the design spec — the contract the backend will implement.
// See docs/kb/03-data-and-api.md before changing anything here.

export type Unit = "KG" | "LTR" | "QTY" | "BG" | "ROLL" | "VIAL";
export type SlipType = "IGP" | "OGP" | "SIS";
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
  no: string; // AW02-IGP-1663
  type: SlipType;
  farmId: string;
  date: string; // ISO date
  time: string; // HH:mm
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
  lines: { itemId: string; qtyChallan: number; qtyReceived: number; weightKg?: number }[];
}

export interface OGP extends SlipBase {
  type: "OGP";
  to: { kind: "farm" | "outside"; farmId?: string; ms?: string; reason?: "repair" | "return" | "other" };
  transferId?: string;
  driverName?: string;
  vehicleNo?: string;
  lines: { itemId: string; qty: number; weightKg?: number }[];
}

export interface SIS extends SlipBase {
  type: "SIS";
  shedRows: { shedId: string; feedItemId: string; feedKg: number; mortMale: number; mortFemale: number }[];
  lines: { itemId: string; qty: number; purpose?: string; shedId?: string }[];
}

export type Slip = IGP | OGP | SIS;

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
  /** Slip id, stock count id, or "opening" for opening balances. */
  slipId: string;
  date: string;
  qtyIn: number;
  qtyOut: number;
}

// Shapes below are not in the spec; designed in week 2. Review with the backend developer.

export interface User {
  id: string;
  name: string;
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
    | "count"
    | "request_correction"
    | "reject_correction"
    | "resolve_shortfall"
    | "setup"
    | "reset_demo";
  recordId: string;
  recordNo: string;
  old?: string;
  new?: string;
  reason?: string;
}
