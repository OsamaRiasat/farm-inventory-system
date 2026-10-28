// A7 — the eight reports from the requirements, computed from the mock data.
// Quantities come from movements, so corrections and cancellations are always included.

import { daysBetween, today } from "@/lib/dates";
import { allBalances, farmBalances, stockCard } from "@/lib/stock";
import type { OGP, Slip } from "@/types/domain";
import type { ReportFilters, ReportResult, ReportRow, ReportType } from "../types";
import type { MockState } from "./engine";

export function buildReport(s: MockState, type: ReportType, f: ReportFilters): ReportResult {
  const inRange = (date: string) => (!f.from || date >= f.from) && (!f.to || date <= f.to);
  const farmOk = (farmId?: string) => !f.farmId || farmId === f.farmId;
  const itemOk = (itemId: string) => {
    if (f.itemId && itemId !== f.itemId) return false;
    if (f.category) return s.items.find((i) => i.id === itemId)?.category === f.category;
    return true;
  };
  const slipById = new Map(s.slips.map((x) => [x.id, x]));
  const byTime = (a: Slip, b: Slip) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
  // The version of each slip that counts: corrected originals are replaced by their correction.
  const effective = s.slips.filter((x) => x.status === "saved");

  switch (type) {
    case "stock-on-hand": {
      const items = s.items.filter((i) => i.active && itemOk(i.id));
      if (f.farmId) {
        const bal = farmBalances(s.movements, f.farmId);
        return {
          columns: [
            { key: "item", label: "line.item", kind: "item" },
            { key: "category", label: "stock.category", kind: "text" },
            { key: "qty", label: "card.balance", kind: "qty" },
            { key: "unit", label: "line.unit", kind: "unit" },
          ],
          rows: items.map((i) => ({ item: i.id, category: i.category, qty: bal.get(i.id) ?? 0, unit: i.unit })),
        };
      }
      const all = allBalances(s.movements);
      const transit = new Map<string, number>();
      for (const t of s.transfers.filter((x) => x.status === "in_transit")) {
        for (const l of (slipById.get(t.ogpId) as OGP).lines) transit.set(l.itemId, (transit.get(l.itemId) ?? 0) + l.qty);
      }
      return {
        columns: [
          { key: "item", label: "line.item", kind: "item" },
          { key: "category", label: "stock.category", kind: "text" },
          { key: "qty", label: "admin.allFarms", kind: "qty" },
          { key: "transit", label: "rep.inTransit", kind: "qty" },
          { key: "unit", label: "line.unit", kind: "unit" },
        ],
        rows: items.map((i) => ({
          item: i.id,
          category: i.category,
          qty: [...all.values()].reduce((n, farm) => n + (farm.get(i.id) ?? 0), 0),
          transit: transit.get(i.id) ?? 0,
          unit: i.unit,
        })),
      };
    }

    case "item-stock-card": {
      const columns: ReportResult["columns"] = [
        { key: "date", label: "slip.date", kind: "date" },
        { key: "ref", label: "col.no", kind: "slip" },
        { key: "in", label: "card.in", kind: "qty" },
        { key: "out", label: "card.out", kind: "qty" },
        { key: "balance", label: "card.balance", kind: "qty" },
      ];
      if (!f.farmId || !f.itemId) return { columns, rows: [], note: "rep.pickFarmItem" };
      return {
        columns,
        rows: stockCard(s.movements, f.farmId, f.itemId)
          .filter((m) => inRange(m.date))
          .map((m) => ({ date: m.date, ref: slipById.has(m.slipId) ? m.slipId : m.slipId === "opening" ? null : m.slipId, in: m.qtyIn || null, out: m.qtyOut || null, balance: m.balance })),
      };
    }

    case "consumption": {
      const used = new Map<string, number>();
      for (const m of s.movements) {
        const slip = slipById.get(m.slipId);
        if (slip?.type !== "SIS" || !inRange(m.date) || !farmOk(m.farmId) || !itemOk(m.itemId)) continue;
        const key = `${m.farmId}|${m.itemId}`;
        used.set(key, (used.get(key) ?? 0) + m.qtyOut - m.qtyIn);
      }
      return {
        columns: [
          { key: "farm", label: "col.farm", kind: "farm" },
          { key: "item", label: "line.item", kind: "item" },
          { key: "used", label: "rep.used", kind: "qty" },
          { key: "unit", label: "line.unit", kind: "unit" },
        ],
        rows: [...used]
          .filter(([, n]) => n !== 0)
          .map(([key, n]) => {
            const [farm, item] = key.split("|");
            return { farm, item, used: Math.round(n * 1000) / 1000, unit: s.items.find((i) => i.id === item)?.unit ?? "" };
          })
          .sort((a, b) => a.farm.localeCompare(b.farm) || b.used - a.used),
      };
    }

    case "feed-mortality": {
      const rows: ReportRow[] = [];
      const daily = new Map<string, Map<string, number>>();
      for (const slip of effective.filter((x) => x.type === "SIS" && inRange(x.date) && farmOk(x.farmId)).sort(byTime)) {
        if (slip.type !== "SIS") continue;
        const farm = s.farms.find((x) => x.id === slip.farmId);
        for (const r of slip.shedRows) {
          const shed = farm?.sheds.find((x) => x.id === r.shedId)?.name ?? r.shedId;
          rows.push({ date: slip.date, farm: slip.farmId, shed, feed: r.feedKg, male: r.mortMale, female: r.mortFemale });
          const series = daily.get(shed) ?? new Map<string, number>();
          series.set(slip.date, (series.get(slip.date) ?? 0) + r.mortMale + r.mortFemale);
          daily.set(shed, series);
        }
      }
      const sum = (k: string) => rows.reduce((n, r) => n + Number(r[k] ?? 0), 0);
      return {
        columns: [
          { key: "date", label: "slip.date", kind: "date" },
          { key: "farm", label: "col.farm", kind: "farm" },
          { key: "shed", label: "sis.shed", kind: "text" },
          { key: "feed", label: "sis.feedUsed", kind: "qty" },
          { key: "male", label: "sis.mortMale", kind: "qty" },
          { key: "female", label: "sis.mortFemale", kind: "qty" },
        ],
        rows,
        totals: { feed: sum("feed"), male: sum("male"), female: sum("female") },
        // One farm: a line per shed. All farms would be too many lines to read.
        series: f.farmId
          ? [...daily].map(([name, points]) => ({ name, points: [...points].map(([date, value]) => ({ date, value })) }))
          : undefined,
      };
    }

    case "gate-register":
      return {
        columns: [
          { key: "date", label: "slip.date", kind: "date" },
          { key: "time", label: "slip.time", kind: "text" },
          { key: "no", label: "col.no", kind: "slip" },
          { key: "type", label: "col.type", kind: "type" },
          { key: "farm", label: "col.farm", kind: "farm" },
          { key: "party", label: "rep.fromTo", kind: "text" },
          { key: "lines", label: "rep.lines", kind: "qty" },
          { key: "status", label: "col.status", kind: "status" },
        ],
        rows: s.slips
          .filter((x) => x.type !== "SIS" && !x.correctionOf && (!f.type || x.type === f.type) && inRange(x.date) && farmOk(x.farmId))
          .filter((x) => !f.itemId || x.lines.some((l) => l.itemId === f.itemId))
          .sort(byTime)
          .map((x) => ({ date: x.date, time: x.time, no: x.id, type: x.type, farm: x.farmId, party: partyOf(s, x), lines: x.lines.length, status: x.status })),
      };

    case "transfers":
      return {
        columns: [
          { key: "date", label: "slip.date", kind: "date" },
          { key: "ogp", label: "transfer.ogpNo", kind: "slip" },
          { key: "from", label: "transfer.fromFarm", kind: "farm" },
          { key: "to", label: "rep.toFarm", kind: "farm" },
          { key: "sent", label: "rep.sent", kind: "qty" },
          { key: "received", label: "rep.received", kind: "qty" },
          { key: "short", label: "rep.short", kind: "qty" },
          { key: "status", label: "col.status", kind: "status" },
        ],
        rows: s.transfers
          .filter((t) => (farmOk(t.fromFarmId) || farmOk(t.toFarmId)) && inRange(t.sentAt.slice(0, 10)))
          .map((t) => {
            const ogp = slipById.get(t.ogpId) as OGP;
            const igp = t.igpId ? slipById.get(t.igpId) : undefined;
            const sent = ogp.lines.reduce((n, l) => n + l.qty, 0);
            const received = igp?.type === "IGP" ? igp.lines.reduce((n, l) => n + l.qtyReceived, 0) : null;
            return {
              date: t.sentAt.slice(0, 10),
              ogp: ogp.id,
              from: t.fromFarmId,
              to: t.toFarmId,
              sent,
              received,
              short: received === null ? null : sent - received || null,
              status: t.status,
            };
          }),
      };

    case "out-for-repair":
      return {
        columns: [
          { key: "date", label: "slip.date", kind: "date" },
          { key: "no", label: "col.no", kind: "slip" },
          { key: "farm", label: "col.farm", kind: "farm" },
          { key: "ms", label: "rep.ms", kind: "text" },
          { key: "item", label: "line.item", kind: "item" },
          { key: "qty", label: "line.qty", kind: "qty" },
          { key: "days", label: "rep.daysOut", kind: "qty" },
        ],
        rows: effective
          .filter((x): x is OGP => x.type === "OGP" && x.to.kind === "outside" && x.to.reason === "repair" && farmOk(x.farmId) && inRange(x.date))
          .sort(byTime)
          .flatMap((x) =>
            x.lines
              .filter((l) => itemOk(l.itemId))
              .map((l) => ({ date: x.date, no: x.id, farm: x.farmId, ms: x.to.kind === "outside" ? (x.to.ms ?? "") : "", item: l.itemId, qty: l.qty, days: daysBetween(x.date, today()) })),
          ),
      };

    case "corrections":
      return {
        columns: [
          { key: "at", label: "rep.when", kind: "stamp" },
          { key: "farm", label: "col.farm", kind: "farm" },
          { key: "action", label: "rep.what", kind: "action" },
          { key: "record", label: "col.no", kind: "slip" },
          { key: "change", label: "rep.change", kind: "text" },
          { key: "reason", label: "detail.reason", kind: "text" },
          { key: "by", label: "rep.by", kind: "text" },
        ],
        rows: s.audit
          .filter((a) => ["correct", "cancel", "count", "resolve_shortfall"].includes(a.action) && farmOk(a.farmId) && inRange(a.at.slice(0, 10)))
          .sort((a, b) => b.at.localeCompare(a.at))
          .map((a) => ({
            at: a.at,
            farm: a.farmId ?? null,
            action: a.action,
            record: slipById.has(a.recordId) ? a.recordId : a.recordNo,
            change: a.old || a.new ? `${a.old ?? ""} → ${a.new ?? ""}` : "",
            reason: a.reason ?? "",
            by: a.user,
          })),
      };
  }
}

/** IGP: who it came from. OGP: where it went. */
export function partyOf(s: MockState, slip: Slip) {
  const farmName = (id?: string) => s.farms.find((f) => f.id === id)?.name ?? "";
  if (slip.type === "IGP") return slip.source.kind === "farm" ? farmName(slip.source.farmId) : (slip.source.ms ?? "");
  if (slip.type === "OGP") return slip.to.kind === "farm" ? farmName(slip.to.farmId) : (slip.to.ms ?? "");
  return "";
}
