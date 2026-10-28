// Phase 1 implementation of the API: everything runs in the browser over the mock store.
// Every call is async, cloned and delayed, so screens behave as they will with a real backend.

import { daysBetween, today } from "@/lib/dates";
import { createItemSearch } from "@/lib/item-search";
import { allBalances, farmBalances, stockCard } from "@/lib/stock";
import type { OGP, IGP, Slip } from "@/types/domain";
import { ApiError } from "../errors";
import type {
  CorrectionInput,
  CorrectionRequestInput,
  Dashboard,
  MockOptions,
  ReportFilters,
  ReportResult,
  ReportType,
  SlipFilters,
  StockCardRow,
  StockMatrix,
  StockRow,
  TransferView,
} from "../types";
import * as engine from "./engine";
import { buildReport } from "./reports";
import { getState, onExternalChange, resetState, update } from "./store";

const OPTIONS_KEY = "awfarms.mock.options";
const IN_TRANSIT_ALERT_DAYS = 2;

let options: MockOptions | null = null;

export function getMockOptions(): MockOptions {
  if (!options) {
    options = { latencyMs: 300, failSaves: false };
    try {
      Object.assign(options, JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? "{}"));
    } catch {
      // Defaults.
    }
  }
  return options;
}

const optionListeners = new Set<() => void>();

/** For useSyncExternalStore on the demo page. */
export function subscribeMockOptions(listener: () => void) {
  optionListeners.add(listener);
  return () => optionListeners.delete(listener);
}

export function setMockOptions(next: Partial<MockOptions>) {
  options = { ...getMockOptions(), ...next };
  optionListeners.forEach((l) => l());
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  } catch {
    // Kept in memory only.
  }
}

const delay = () => new Promise((r) => setTimeout(r, getMockOptions().latencyMs));

async function read<T>(fn: (s: engine.MockState) => T): Promise<T> {
  await delay();
  return structuredClone(fn(getState()));
}

async function write<T>(fn: (s: engine.MockState) => T): Promise<T> {
  await delay();
  if (getMockOptions().failSaves) throw new ApiError("err.notSaved");
  return structuredClone(update(fn));
}

let searchCache: { items: unknown; search: ReturnType<typeof createItemSearch> } | null = null;
function itemSearch(s: engine.MockState) {
  if (searchCache?.items !== s.items) searchCache = { items: s.items, search: createItemSearch(s.items) };
  return searchCache.search;
}

function bySlipTime(a: Slip, b: Slip) {
  return `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`);
}

function matches(slip: Slip, f: SlipFilters) {
  if (f.farmId && slip.farmId !== f.farmId) return false;
  if (f.type && slip.type !== f.type) return false;
  if (f.status && slip.status !== f.status) return false;
  if (f.from && slip.date < f.from) return false;
  if (f.to && slip.date > f.to) return false;
  if (f.no && !slip.no.toLowerCase().includes(f.no.trim().toLowerCase())) return false;
  if (f.itemId) {
    const inLines = slip.lines.some((l) => l.itemId === f.itemId);
    const inFeed = slip.type === "SIS" && slip.shedRows.some((r) => r.feedItemId === f.itemId);
    if (!inLines && !inFeed) return false;
  }
  return true;
}

function transferView(s: engine.MockState, transferId: string): TransferView {
  const transfer = s.transfers.find((t) => t.id === transferId)!;
  return {
    transfer,
    ogp: engine.getSlip(s, transfer.ogpId) as OGP,
    igp: transfer.igpId ? (engine.getSlip(s, transfer.igpId) as IGP) : undefined,
  };
}

export const mockApi = {
  // ── reference data ──
  listFarms: () => read((s) => s.farms),
  listItems: () => read((s) => s.items),
  searchItems: (q: string) => read((s) => itemSearch(s)(q, 20)),
  listSuppliers: () => read((s) => [...s.suppliers].sort()),
  listUsers: () => read((s) => s.users),

  // ── stock ──
  getStock: (farmId: string) =>
    read((s): StockRow[] => [...farmBalances(s.movements, farmId)].map(([itemId, qty]) => ({ itemId, qty }))),

  getStockMatrix: () =>
    read((s): StockMatrix => {
      const farms: StockMatrix["farms"] = {};
      for (const [farmId, balances] of allBalances(s.movements)) farms[farmId] = Object.fromEntries(balances);
      const inTransit: StockMatrix["inTransit"] = {};
      for (const t of s.transfers.filter((x) => x.status === "in_transit")) {
        for (const l of (engine.getSlip(s, t.ogpId) as OGP).lines) inTransit[l.itemId] = (inTransit[l.itemId] ?? 0) + l.qty;
      }
      return { farms, inTransit };
    }),

  getStockCard: (farmId: string, itemId: string) =>
    read((s): StockCardRow[] =>
      stockCard(s.movements, farmId, itemId).map((m) => {
        const slip = s.slips.find((x) => x.id === m.slipId);
        const count = slip ? undefined : s.stockCounts.find((c) => c.id === m.slipId);
        return {
          ...m,
          ref: slip?.no ?? count?.no ?? "Opening balance",
          kind: slip?.type ?? (count ? "COUNT" : "OPENING"),
        };
      }),
    ),

  // ── slips ──
  listSlips: (filters: SlipFilters = {}) => read((s) => s.slips.filter((x) => matches(x, filters)).sort(bySlipTime)),
  getSlip: (id: string) => read((s) => engine.getSlip(s, id)),
  saveIGP: (input: unknown) => write((s) => engine.saveIGP(s, input)),
  saveOGP: (input: unknown) => write((s) => engine.saveOGP(s, input)),
  saveSIS: (input: unknown) => write((s) => engine.saveSIS(s, input)),

  // ── transfers ──
  listWaitingTransfers: (farmId: string) =>
    read((s) =>
      s.transfers
        .filter((t) => t.toFarmId === farmId && t.status === "in_transit")
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
        .map((t) => transferView(s, t.id)),
    ),
  listTransfers: (filters: { farmId?: string } = {}) =>
    read((s) =>
      s.transfers
        .filter((t) => !filters.farmId || t.fromFarmId === filters.farmId || t.toFarmId === filters.farmId)
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
        .map((t) => transferView(s, t.id)),
    ),
  receiveTransfer: (input: unknown) => write((s) => engine.receiveTransfer(s, input)),
  resolveShortfall: (input: { transferId: string; reason: string; by: string }) => write((s) => engine.resolveShortfall(s, input)),

  // ── corrections ──
  requestCorrection: (input: CorrectionRequestInput) => write((s) => engine.requestCorrection(s, input)),
  listCorrectionRequests: (filters: { farmId?: string; status?: "open" | "approved" | "rejected" } = {}) =>
    read((s) =>
      s.corrections
        .filter((r) => (!filters.farmId || r.farmId === filters.farmId) && (!filters.status || r.status === filters.status))
        .sort((a, b) => b.at.localeCompare(a.at)),
    ),
  correctSlip: (input: CorrectionInput) => write((s) => engine.correctSlip(s, input)),
  rejectCorrection: (input: { requestId: string; note: string; by: string }) => write((s) => engine.rejectCorrection(s, input)),
  cancelSlip: (input: { slipId: string; reason: string; by: string }) => write((s) => engine.cancelSlip(s, input)),
  saveStockCount: (input: unknown) => write((s) => engine.saveStockCount(s, input)),

  // ── admin ──
  getDashboard: () =>
    read((s): Dashboard => {
      const day = today();
      const todays = s.slips.filter((x) => x.date === day && x.status !== "cancelled" && !x.correctionOf);
      const inTransit = s.transfers.filter((t) => t.status === "in_transit");
      return {
        tiles: {
          slipsToday: todays.length,
          inTransit: inTransit.length,
          inTransitOld: inTransit.filter((t) => daysBetween(t.sentAt.slice(0, 10), day) > IN_TRANSIT_ALERT_DAYS).length,
          shortfalls: s.transfers.filter((t) => t.status === "short" && !t.resolution).length,
          corrections: s.corrections.filter((r) => r.status === "open").length,
        },
        farmsToday: s.farms
          .filter((f) => f.active)
          .map((f) => {
            const mine = todays.filter((x) => x.farmId === f.id);
            return {
              farmId: f.id,
              igp: mine.filter((x) => x.type === "IGP").length,
              ogp: mine.filter((x) => x.type === "OGP").length,
              sis: mine.filter((x) => x.type === "SIS").length,
              lastSlipTime: mine.map((x) => x.time).sort().at(-1) ?? null,
            };
          }),
        latest: [...s.slips].filter((x) => !x.correctionOf).sort(bySlipTime).slice(0, 20),
      };
    }),

  getReport: (type: ReportType, filters: ReportFilters = {}) => read((s): ReportResult => buildReport(s, type, filters)),

  // ── setup (A8, A9) ──
  updateFarm: (input: engine.FarmPatch) => write((s) => engine.updateFarm(s, input)),
  addShed: (input: { farmId: string; name: string; by: string }) => write((s) => engine.addShed(s, input)),
  updateShed: (input: { id: string; name: string; active: boolean; by: string }) => write((s) => engine.updateShed(s, input)),
  saveItem: (input: engine.ItemInput) => write((s) => engine.saveItem(s, input)),

  listAudit: (filters: { farmId?: string } = {}) =>
    read((s) => s.audit.filter((a) => !filters.farmId || a.farmId === filters.farmId).sort((a, b) => b.at.localeCompare(a.at))),

  /** Calls back when the data changed outside this tab. The real backend can push the same signal. */
  onExternalChange,

  // ── demo only (not part of the backend contract) ──
  getMockOptions,
  setMockOptions,
  subscribeMockOptions,
  resetDemo: async () => {
    await delay();
    resetState();
  },
};
