// A1 dashboard and A11 audit log.

import type { Dashboard } from "@/lib/api/types";
import { daysBetween, today } from "@/lib/dates";
import { db } from "../db";
import { slipInclude, toAudit, toSlip } from "../mappers";

const IN_TRANSIT_ALERT_DAYS = 2;

export async function getDashboard(): Promise<Dashboard> {
  const day = today();
  const [todays, inTransit, shortfalls, corrections, itemRequests, farms, latest] = await Promise.all([
    db().slip.findMany({
      where: { date: day, status: { not: "cancelled" }, correctionOf: null },
      select: { farmId: true, type: true, time: true },
    }),
    db().transfer.findMany({ where: { status: "in_transit" }, select: { sentAt: true } }),
    db().transfer.count({ where: { status: "short", resolutionKind: null } }),
    db().correctionRequest.count({ where: { status: "open" } }),
    db().itemRequest.count({ where: { status: "pending" } }),
    db().farm.findMany({ where: { active: true }, orderBy: { seq: "asc" }, select: { id: true } }),
    db().slip.findMany({ where: { correctionOf: null }, include: slipInclude, orderBy: [{ date: "desc" }, { time: "desc" }], take: 20 }),
  ]);
  return {
    tiles: {
      slipsToday: todays.length,
      inTransit: inTransit.length,
      inTransitOld: inTransit.filter((t) => daysBetween(t.sentAt.slice(0, 10), day) > IN_TRANSIT_ALERT_DAYS).length,
      shortfalls,
      corrections,
      itemRequests,
    },
    farmsToday: farms.map((f) => {
      const mine = todays.filter((x) => x.farmId === f.id);
      return {
        farmId: f.id,
        igp: mine.filter((x) => x.type === "IGP").length,
        ogp: mine.filter((x) => x.type === "OGP").length,
        sis: mine.filter((x) => x.type === "SIS").length,
        dr: mine.filter((x) => x.type === "DR").length,
        lastSlipTime: mine.map((x) => x.time).sort().at(-1) ?? null,
      };
    }),
    latest: latest.map(toSlip),
  };
}

export async function listAudit(f: { farmId?: string } = {}) {
  const rows = await db().auditEntry.findMany({
    where: f.farmId ? { farmId: f.farmId } : {},
    orderBy: [{ at: "desc" }, { id: "desc" }],
  });
  return rows.map(toAudit);
}
