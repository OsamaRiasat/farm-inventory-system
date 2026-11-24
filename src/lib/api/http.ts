// The API in the browser: same functions the screens always used, now over fetch to /api (src/app/api).
// Every failure becomes an ApiError with the server's message id, so screens show the rule's own words.

import type { MsgId } from "@/lib/i18n";
import type { FieldError } from "@/lib/validation";
import type {
  CorrectionRequest,
  Farm,
  IGP,
  Item,
  OGP,
  SIS,
  SISReturn,
  Shed,
  Slip,
  StockCount,
  Transfer,
  User,
  AuditEntry,
} from "@/types/domain";
import { ApiError } from "./errors";
import type {
  CorrectionInput,
  CorrectionRequestInput,
  Dashboard,
  ReportFilters,
  ReportResult,
  ReportType,
  ReturnInput,
  SlipFilters,
  StockCardRow,
  StockMatrix,
  StockRow,
  TransferView,
} from "./types";

export type FarmPatch = { id: string; name: string; type: Farm["type"]; active: boolean; by?: string };
export type ItemInput = Omit<Item, "id" | "number"> & { id?: string; by?: string };

/** Fired when the server says the session is gone, so the gates send the user to the login. */
export const SIGNED_OUT_EVENT = "awfarms-signed-out";

function qs(params: Record<string, string | undefined | null>) {
  const entries = Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== "");
  return entries.length ? `?${new URLSearchParams(entries)}` : "";
}

const enc = encodeURIComponent;

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("err.notSaved");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = (data as { error?: { id?: MsgId; values?: Record<string, string>; fieldErrors?: FieldError[] } } | null)?.error;
    if (res.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
    throw new ApiError(e?.id ?? "err.notSaved", e?.values, e?.fieldErrors ?? []);
  }
  return data as T;
}

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body: unknown = {}) => request<T>("POST", path, body);

export const httpApi = {
  // ── reference data ──
  listFarms: () => get<Farm[]>("/farms"),
  listItems: () => get<Item[]>("/items"),
  searchItems: (q: string) => get<Item[]>(`/items/search${qs({ q })}`),
  listSuppliers: () => get<string[]>("/suppliers"),
  listUsers: () => get<User[]>("/users"),

  // ── stock ──
  getStock: (farmId: string) => get<StockRow[]>(`/stock${qs({ farmId })}`),
  getStockMatrix: () => get<StockMatrix>("/stock/matrix"),
  getStockCard: (farmId: string, itemId: string) => get<StockCardRow[]>(`/stock/card${qs({ farmId, itemId })}`),

  // ── slips ──
  listSlips: (filters: SlipFilters = {}) => get<Slip[]>(`/slips${qs(filters)}`),
  getSlip: (id: string) => get<Slip>(`/slips/${enc(id)}`),
  saveIGP: (input: unknown) => post<IGP>("/slips/igp", input),
  saveOGP: (input: unknown) => post<OGP>("/slips/ogp", input),
  saveSIS: (input: unknown) => post<SIS>("/slips/sis", input),

  // ── return unused (SIS) ──
  /** Returns on this SIS (any version of it), oldest first, cancelled ones included. */
  listReturns: (slipId: string) => get<SISReturn[]>(`/slips/${enc(slipId)}/returns`),
  returnUnused: (input: ReturnInput) => post<SISReturn>("/returns", input),
  cancelReturn: (input: { returnId: string; reason: string; by?: string }) =>
    post<SISReturn>(`/returns/${enc(input.returnId)}/cancel`, { reason: input.reason }),

  // ── transfers ──
  listWaitingTransfers: (farmId: string) => get<TransferView[]>(`/transfers/waiting${qs({ farmId })}`),
  listTransfers: (filters: { farmId?: string } = {}) => get<TransferView[]>(`/transfers${qs(filters)}`),
  receiveTransfer: (input: unknown) => post<IGP>("/transfers/receive", input),
  resolveShortfall: (input: { transferId: string; reason: string; by?: string }) =>
    post<Transfer>(`/transfers/${enc(input.transferId)}/resolve`, { reason: input.reason }),

  // ── corrections ──
  requestCorrection: (input: CorrectionRequestInput) => post<CorrectionRequest>("/corrections", input),
  listCorrectionRequests: (filters: { farmId?: string; status?: "open" | "approved" | "rejected" } = {}) =>
    get<CorrectionRequest[]>(`/corrections${qs(filters)}`),
  correctSlip: (input: CorrectionInput) => post<Slip>(`/slips/${enc(input.slipId)}/correct`, input),
  rejectCorrection: (input: { requestId: string; note: string; by?: string }) =>
    post<CorrectionRequest>(`/corrections/${enc(input.requestId)}/reject`, { note: input.note }),
  cancelSlip: (input: { slipId: string; reason: string; by?: string }) =>
    post<Slip>(`/slips/${enc(input.slipId)}/cancel`, { reason: input.reason }),
  saveStockCount: (input: unknown) => post<StockCount>("/stock-counts", input),

  // ── admin ──
  getDashboard: () => get<Dashboard>("/dashboard"),
  getReport: (type: ReportType, filters: ReportFilters = {}) => get<ReportResult>(`/reports/${enc(type)}${qs(filters)}`),

  // ── setup (A8, A9) ──
  updateFarm: (input: FarmPatch) => post<Farm>(`/farms/${enc(input.id)}`, input),
  addShed: (input: { farmId: string; name: string; by?: string }) => post<Shed>("/sheds", input),
  updateShed: (input: { id: string; name: string; active: boolean; by?: string }) => post<Shed>(`/sheds/${enc(input.id)}`, input),
  saveItem: (input: ItemInput) => post<Item>("/items", input),

  listAudit: (filters: { farmId?: string } = {}) => get<AuditEntry[]>(`/audit${qs(filters)}`),
};
