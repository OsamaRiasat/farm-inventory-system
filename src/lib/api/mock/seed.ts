// Builds the demo data: 11 farms, ~60 items, opening balances and two weeks of history ending today.
// Every slip goes through the engine, so the history obeys the same rules as the live app.
// Includes the real examples from the screen recording (Hatchery OGP-46 → Patoki IGP-1662,
// Patoki OGP-1366 drill machine, Patoki SIS-203) plus one transfer in transit, one in transit
// for more than 2 days, one short transfer, one corrected slip, one cancelled slip and one
// open correction request.

import { addDays, isoDate, isoTime } from "@/lib/dates";
import { allowsDecimals } from "@/lib/format";
import { farmBalances } from "@/lib/stock";
import type { Farm, FarmType, Item, Unit, User } from "@/types/domain";
import * as engine from "./engine";
import type { MockState } from "./engine";
import farmsJson from "./seed/farms.json";
import itemsJson from "./seed/items.json";

export const MOCK_VERSION = 1;
const ADMIN = "Accounts Admin";

const SUPPLIERS = {
  feed: "Sutlej Feeds Mill",
  diesel: "Kamran Diesel Depot",
  medicine: "Hamza Medicine Co.",
  electric: "Punjab Electric Store",
  general: "Al-Madina Traders",
};

const REPAIR_SHOPS = ["Bilal Electric Works", "رفیق موٹر ورکس", "Shah Jee Fan Repair"];
const PURPOSES = ["شیڈ کی صفائی", "جنریٹر", "پنکھے کی مرمت", "کچن", "پانی کی لائن", "Shed wash", "Generator service", "Office"];

/** Small deterministic PRNG, so every reset produces the same demo. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSeed(now = new Date()): MockState {
  const rand = mulberry32(20261027);
  const between = (min: number, max: number) => Math.round(min + rand() * (max - min));
  const chance = (p: number) => rand() < p;
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];

  const todayIso = isoDate(now);
  const nowT = isoTime(now);

  const farms: Farm[] = farmsJson.map((f) => ({
    id: f.id,
    code: f.code,
    name: f.name,
    type: f.type as FarmType,
    active: true,
    sheds: Array.from({ length: f.sheds }, (_, i) => ({ id: `${f.id}-s${i + 1}`, farmId: f.id, name: `Shed ${i + 1}`, active: true })),
  }));
  const items: Item[] = itemsJson.map((i) => ({ ...i, unit: i.unit as Unit, active: true }));
  const users: User[] = [
    ...farms.map((f, i) => ({
      id: `u-${f.id}`,
      name: `${f.code} Store Keeper`,
      role: "farm" as const,
      farmId: f.id,
      phone: `0300-55500${String(i + 1).padStart(2, "0")}`,
      active: true,
    })),
    { id: "u-admin", name: ADMIN, role: "admin", phone: "0300-5550000", active: true },
  ];
  const userOf = (farmId: string) => users.find((u) => u.farmId === farmId)!.name;

  const state: MockState = {
    version: MOCK_VERSION,
    seededAt: now.toISOString(),
    farms,
    items,
    users,
    suppliers: Object.values(SUPPLIERS),
    slips: [],
    transfers: [],
    movements: [],
    corrections: [],
    stockCounts: [],
    audit: [],
    counters: {},
    idempotency: {},
    nextId: 1,
  };

  // ── opening balances, 14 days ago ──
  const openingDate = addDays(todayIso, -14);
  for (const farm of farms) {
    for (const item of items) {
      const qty = openingQty(farm, item);
      if (qty > 0) {
        state.movements.push({
          id: `m${state.nextId++}`,
          farmId: farm.id,
          itemId: item.id,
          slipId: "opening",
          date: openingDate,
          qtyIn: qty,
          qtyOut: 0,
        });
      }
    }
  }

  function setOpening(farmId: string, itemId: string, qty: number) {
    const existing = state.movements.find((m) => m.slipId === "opening" && m.farmId === farmId && m.itemId === itemId);
    if (existing) existing.qtyIn = qty;
    else state.movements.push({ id: `m${state.nextId++}`, farmId, itemId, slipId: "opening", date: openingDate, qtyIn: qty, qtyOut: 0 });
  }

  // Patoki opening stock as seen in the recording.
  const patokiOpening: Record<string, number> = {
    "feed-all": 23739, diesel: 2550, "nylon-rope": 80, "aqua-kair": 300, hcl: 240, "accid-pro": 200, chips: 7552,
    polythene: 22, brush: 7, holder: 48, drill: 6, "fan-belt-89a": 24, "fan-belt-88a": 8, "fan-belt-57a": 6,
  };
  for (const [itemId, qty] of Object.entries(patokiOpening)) setOpening("aw02", itemId, qty);
  // Enough stock for the scripted transfers and slips below.
  setOpening("aw05", "drill", 4);
  setOpening("aw05", "gloves", 30);
  setOpening("aw01", "nylon-rope", 60);

  function openingQty(farm: Farm, item: Item): number {
    const hatchery = farm.type === "hatchery";
    if (item.isFeed) {
      if (hatchery) return 0;
      if (farm.type === "layer") return item.id === "feed-layer" ? between(18000, 28000) : 0;
      return item.id === "feed-all" ? between(20000, 30000) : item.id === "feed-grower" ? between(0, 6000) : 0;
    }
    if (item.category === "Packing Material") {
      if (hatchery) return item.id === "egg-tray" ? 40000 : 2500;
      return item.id === "egg-tray" ? between(500, 2000) : between(100, 300);
    }
    if (hatchery && ["chappal", "uniform-worker", "uniform-assistant", "foil", "gentylo"].includes(item.id)) {
      return { chappal: 200, "uniform-worker": 30, "uniform-assistant": 20, foil: 50, gentylo: 300 }[item.id]!;
    }
    if (item.id === "diesel") return between(1200, 3000);
    if (item.id === "chips") return hatchery ? 0 : between(2000, 8000);
    if (chance(0.15)) return 0;
    switch (item.unit) {
      case "VIAL":
        return between(20, 200);
      case "LTR":
        return between(40, 300);
      case "KG":
        return between(10, 60);
      case "BG":
        return between(20, 300);
      case "ROLL":
        return between(2, 12);
      default:
        return between(2, 60);
    }
  }

  // Slip numbers continue from the paper books; Patoki and the Hatchery line up with the real slips.
  for (const farm of farms) {
    state.counters[farm.id] = { IGP: between(100, 2000), OGP: between(100, 2000), SIS: between(100, 600), CNT: 0 };
  }
  state.counters.aw02 = { IGP: 1657, OGP: 1362, SIS: 202, CNT: 0 };
  state.counters.awhatchery = { ...state.counters.awhatchery, OGP: 44 };

  // ── helpers ──
  let keyN = 0;
  const key = () => `seed-${keyN++}`;
  const stockOf = (farmId: string, itemId: string) => farmBalances(state.movements, farmId).get(itemId) ?? 0;

  /** Today's events can't be in the future: pull them back before "now". */
  function timeFor(date: string, time: string): string | null {
    if (date !== todayIso || time <= nowT) return time;
    const [h, m] = nowT.split(":").map(Number);
    const minutes = h * 60 + m - between(5, 90);
    if (minutes < 5) return null;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  const at = (date: string, time: string) => `${date}T${time}:00`;

  /** A quantity the farm can actually spare, or 0. */
  function usable(farmId: string, item: Item, wanted: number) {
    const stock = stockOf(farmId, item.id);
    const qty = Math.min(wanted, stock);
    return allowsDecimals(item.unit) ? Math.floor(qty * 10) / 10 : Math.floor(qty);
  }
  const itemById = (id: string) => items.find((i) => i.id === id)!;

  function igp(farmId: string, date: string, time: string, ms: string, lines: [string, number, number?][], no?: number) {
    const t = timeFor(date, time);
    if (!t) return;
    engine.saveIGP(
      state,
      {
        farmId, date, time: t, preparedBy: userOf(farmId), idempotencyKey: key(),
        source: { kind: "supplier", ms },
        biltyNo: String(between(1000, 9999)),
        truckNo: `LES-${between(1000, 9999)}`,
        challanNo: String(between(100, 999)),
        lines: lines.map(([itemId, qty, received]) => ({ itemId, qtyChallan: qty, qtyReceived: received ?? qty })),
      },
      { no, at: at(date, t) },
    );
  }

  function transfer(fromId: string, toId: string, date: string, time: string, lines: [string, number][], driver: string, vehicle: string, no?: number) {
    const t = timeFor(date, time);
    if (!t) return null;
    const ogp = engine.saveOGP(
      state,
      {
        farmId: fromId, date, time: t, preparedBy: userOf(fromId), idempotencyKey: key(),
        to: { kind: "farm", farmId: toId }, driverName: driver, vehicleNo: vehicle,
        lines: lines.map(([itemId, qty]) => ({ itemId, qty })),
      },
      { no, at: at(date, t) },
    );
    return ogp.transferId!;
  }

  function receive(transferId: string | null, date: string, time: string, received: number[], no?: number) {
    if (!transferId) return;
    const t = timeFor(date, time);
    if (!t) return;
    const tr = state.transfers.find((x) => x.id === transferId)!;
    engine.receiveTransfer(
      state,
      {
        farmId: tr.toFarmId, date, time: t, preparedBy: userOf(tr.toFarmId), idempotencyKey: key(), transferId,
        lines: received.map((qtyReceived) => ({ qtyReceived })),
      },
      { no, at: at(date, t) },
    );
  }

  function sis(farm: Farm, date: string, time: string, shedRows: { feed: string; kg: number; male: number; female: number }[], lines: [string, number, string?][], no?: number) {
    const t = timeFor(date, time);
    if (!t) return null;
    return engine.saveSIS(
      state,
      {
        farmId: farm.id, date, time: t, preparedBy: userOf(farm.id), idempotencyKey: key(),
        shedRows: shedRows.map((r, i) => ({ shedId: farm.sheds[i].id, feedItemId: r.feed, feedKg: r.kg, mortMale: r.male, mortFemale: r.female })),
        lines: lines.map(([itemId, qty, purpose]) => ({ itemId, qty, purpose })),
      },
      { no, at: at(date, t) },
    );
  }

  // ── scripted events (by day offset) ──
  const farm = (id: string) => farms.find((f) => f.id === id)!;
  const skipSis = new Set<string>();
  const scripted: Record<number, () => void> = {
    [-13]: () => {
      // SIS-203 at Patoki, from the recording: Feed All 23,739 → 14,941 KG, Diesel 2,550 → 2,465 LTR …
      skipSis.add("aw02:-13");
      sis(
        farm("aw02"), addDays(todayIso, -13), "11:15",
        [2200, 2200, 2199, 2199].map((kg, i) => ({ feed: "feed-all", kg, male: i % 2, female: 2 + i })),
        [["diesel", 85, "جنریٹر"], ["nylon-rope", 21], ["aqua-kair", 300], ["hcl", 60], ["accid-pro", 25], ["chips", 5], ["polythene", 3], ["brush", 2], ["holder", 1]],
        203,
      );
    },
    [-12]: () => {
      // Hatchery OGP-46 → Patoki IGP-1662, from the recording.
      const date = addDays(todayIso, -12);
      const t = transfer("awhatchery", "aw02", date, "07:30",
        [["egg-boxes", 180], ["egg-tray", 9000], ["chappal", 90], ["uniform-worker", 10], ["uniform-assistant", 5], ["foil", 14], ["gentylo", 100]],
        "Ameen", "LES-9701", 46);
      receive(t, date, "08:10", [180, 9000, 90, 10, 5, 14, 100], 1662);
    },
    [-10]: () => {
      // Patoki OGP-1366: drill machine 6 → 5, to Layer-04 Khan.
      const date = addDays(todayIso, -10);
      const t = transfer("aw02", "layer04", date, "14:20", [["drill", 1]], "Tariq", "LEA-3341", 1366);
      receive(t, addDays(todayIso, -9), "09:05", [1]);
    },
    [-6]: () => {
      // Short transfer: 200 LTR diesel sent, 195 received.
      const t = transfer("aw05", "aw06", addDays(todayIso, -6), "08:00", [["diesel", 200]], "Shafiq", "LEB-2210");
      receive(t, addDays(todayIso, -6), "12:40", [195]);
    },
    [-5]: () => {
      // A slip saved twice by mistake; the second one is cancelled by the Accounts Admin.
      const date = addDays(todayIso, -5);
      igp("aw06", date, "09:40", SUPPLIERS.general, [["gloves", 24], ["brush", 6]]);
      igp("aw06", date, "09:42", SUPPLIERS.general, [["gloves", 24], ["brush", 6]]);
      const dup = state.slips[state.slips.length - 1];
      engine.cancelSlip(state, { slipId: dup.id, reason: "Entered twice / دو بار درج ہوا", by: ADMIN }, { at: at(date, "15:10") });
    },
    [-4]: () => {
      // In transit for more than 2 days.
      transfer("aw01", "aw3a", addDays(todayIso, -4), "10:30", [["nylon-rope", 20]], "Iqbal", "LEC-7782");
    },
    [-3]: () => {
      // Corrected slip: diesel typed as 58 instead of 85.
      skipSis.add("aw02:-3");
      const date = addDays(todayIso, -3);
      const p = farm("aw02");
      const slip = sis(p, date, "10:50",
        p.sheds.map((_, i) => ({ feed: "feed-all", kg: 2000 + i * 25, male: i === 0 ? 1 : 0, female: 3 })),
        [["diesel", 58, "جنریٹر"], ["chips", 6]]);
      if (slip) engine.correctSlip(state, { slipId: slip.id, lines: [{ index: 0, qty: 85 }], reason: "Typed 58 instead of 85", by: ADMIN }, { at: at(date, "16:30") });
    },
    [-1]: () => {
      const date = addDays(todayIso, -1);
      // Waiting at Patoki.
      transfer("awhatchery", "aw02", date, "15:00", [["egg-tray", 9000], ["egg-boxes", 180], ["chappal", 50]], "Ameen", "LES-9701");
      // Open correction request from AW-05.
      skipSis.add("aw05:-1");
      const a5 = farm("aw05");
      const slip = sis(a5, date, "10:20",
        a5.sheds.map((_, i) => ({ feed: "feed-all", kg: 2010 + i * 30, male: 1, female: 2 + i })),
        [["diesel", 40, "جنریٹر"], ["gloves", 4]]);
      if (slip) {
        engine.requestCorrection(state, { slipId: slip.id, lineIndex: 1, requestedQty: 2, reason: "4 لکھا گیا، اصل میں 2 دستانے استعمال ہوئے", requestedBy: userOf("aw05") }, { at: at(date, "17:05") });
      }
    },
    [0]: () => {
      transfer("aw05", "aw02", todayIso, "09:00", [["drill", 1]], "Tariq", "LEA-3341");
    },
  };

  // Farms that have not saved today's SIS (shown on the admin dashboard).
  const missingToday = new Set(["aw04", "aw3b", "layer04"]);

  const consumables: [string, number, number][] = [
    ["diesel", 20, 120], ["nylon-rope", 1, 5], ["aqua-kair", 10, 50], ["hcl", 5, 20], ["accid-pro", 5, 25],
    ["chips", 2, 10], ["polythene", 1, 3], ["brush", 1, 2], ["holder", 1, 1], ["led-bulb", 1, 2], ["vit-ad3e", 1, 3],
    ["virkon", 1, 2], ["gloves", 2, 6], ["sugar", 2, 5], ["tea", 1, 2], ["gen-oil", 2, 5], ["fan-belt-89a", 1, 2],
    ["fan-belt-57a", 1, 1], ["nipple", 2, 10], ["gas-cylinder", 1, 1], ["formalin", 2, 8],
  ];
  const miscDeliveries: { ms: string; items: [string, number, number][] }[] = [
    { ms: SUPPLIERS.medicine, items: [["aqua-kair", 100, 300], ["hcl", 40, 120], ["accid-pro", 40, 100], ["vit-ad3e", 10, 30], ["nd-vaccine", 20, 60], ["virkon", 5, 20]] },
    { ms: SUPPLIERS.electric, items: [["holder", 10, 30], ["led-bulb", 10, 40], ["wire", 1, 3], ["breaker", 2, 6], ["fan-belt-89a", 5, 20]] },
    { ms: SUPPLIERS.general, items: [["gloves", 12, 48], ["brush", 4, 12], ["polythene", 10, 30], ["nylon-rope", 10, 40], ["sugar", 10, 25], ["tea", 2, 5]] },
  ];

  // ── day by day ──
  for (let d = -13; d <= 0; d++) {
    const date = addDays(todayIso, d);
    scripted[d]?.();

    for (const f of farms) {
      const feedId = f.type === "layer" ? "feed-layer" : "feed-all";

      // Feed delivery when the farm is running low.
      if (f.type !== "hatchery" && stockOf(f.id, feedId) < f.sheds.length * 2300 * 2) {
        const qty = 25000;
        igp(f.id, date, "08:30", SUPPLIERS.feed, [[feedId, qty, chance(0.15) ? qty - between(20, 80) : qty]]);
      }
      if (stockOf(f.id, "diesel") < 600) igp(f.id, date, "08:50", SUPPLIERS.diesel, [["diesel", 2000]]);

      // Other deliveries now and then, sometimes short.
      if (chance(0.3)) {
        const delivery = pick(miscDeliveries);
        const lines = delivery.items
          .filter(() => chance(0.5))
          .slice(0, 3)
          .map(([id, min, max]): [string, number, number] => {
            const qty = between(min, max);
            return [id, qty, chance(0.1) ? Math.max(0, qty - between(1, 3)) : qty];
          });
        if (lines.length) igp(f.id, date, `${pick(["09", "10", "11"])}:${String(between(0, 59)).padStart(2, "0")}`, delivery.ms, lines);
      }

      // Daily Stock Issue Slip.
      const skip = skipSis.has(`${f.id}:${d}`) || (d === 0 && missingToday.has(f.id));
      if (!skip) {
        const shedRows =
          f.type === "hatchery"
            ? []
            : f.sheds.map(() => {
                const kg = f.type === "layer" ? between(1000, 1600) : between(1600, 2300);
                return {
                  feed: feedId,
                  kg: usable(f.id, itemById(feedId), kg),
                  male: f.type === "layer" ? 0 : between(0, 3),
                  female: between(0, f.type === "layer" ? 12 : 9),
                };
              });
        // Feed used comes off the same stock across sheds: keep the total within stock.
        let feedLeft = stockOf(f.id, feedId);
        for (const r of shedRows) {
          r.kg = Math.max(0, Math.min(r.kg, feedLeft));
          feedLeft -= r.kg;
        }
        const pool = f.type === "hatchery" ? consumables.filter(([id]) => ["formalin", "gloves", "sugar", "tea", "diesel", "gen-oil"].includes(id)) : consumables;
        const lines: [string, number, string?][] = [];
        for (let n = between(1, 4); n > 0; n--) {
          const [id, min, max] = pick(pool);
          if (lines.some(([l]) => l === id)) continue;
          const qty = usable(f.id, itemById(id), between(min, max));
          if (qty > 0) lines.push([id, qty, chance(0.4) ? pick(PURPOSES) : undefined]);
        }
        if (shedRows.length || lines.length) {
          sis(f, date, `${pick(["10", "11"])}:${String(between(0, 59)).padStart(2, "0")}`, shedRows, lines);
        }
      }

      // Something goes out for repair now and then.
      if (chance(0.07)) {
        const id = pick(["drill", "fan-36", "battery"]);
        if (stockOf(f.id, id) >= 1) {
          const t = timeFor(date, "13:30");
          if (t) {
            engine.saveOGP(
              state,
              {
                farmId: f.id, date, time: t, preparedBy: userOf(f.id), idempotencyKey: key(),
                to: { kind: "outside", ms: pick(REPAIR_SHOPS), reason: "repair" },
                driverName: "", vehicleNo: "", lines: [{ itemId: id, qty: 1 }],
              },
              { at: at(date, t) },
            );
          }
        }
      }
    }
  }

  return state;
}
