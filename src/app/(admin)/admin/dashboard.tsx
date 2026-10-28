"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { Check, TriangleAlert } from "lucide-react";
import { useAdminFarm } from "@/components/layout/admin-farm-filter";
import { Bi } from "@/components/layout/bi";
import { TypeChip } from "@/components/layout/type-chip";
import { LoadError, Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { useDashboard, useFarms, useItemMap } from "@/lib/api/queries";
import type { Dashboard } from "@/lib/api";
import type { MsgId } from "@/lib/i18n";

/** A1 — count tiles, farms today, latest slips across all farms. */
export function AdminDashboard() {
  const dashboard = useDashboard();
  const farmFilter = useAdminFarm();
  const farms = useFarms().data ?? [];
  const items = useItemMap();

  if (dashboard.isError) return <LoadError onRetry={() => dashboard.refetch()} />;
  if (!dashboard.data) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <SkeletonRows rows={8} />
      </div>
    );
  }

  const { tiles } = dashboard.data;
  // The top-bar farm filter narrows the tables; the tiles always count every farm.
  const farmsToday = dashboard.data.farmsToday.filter((r) => !farmFilter || r.farmId === farmFilter);
  const latest = dashboard.data.latest.filter((s) => !farmFilter || s.farmId === farmFilter);
  const farmName = (id: string) => farms.find((f) => f.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tileList(tiles).map((tile) => {
          const flagged = tile.alert && tile.value > 0;
          return (
            <li key={tile.label}>
              <Link href={tile.href} className={clsx("card flex h-full flex-col gap-1 p-4", flagged && "border-warning bg-warning-bg")}>
                <span className={clsx("num flex items-center gap-2 text-3xl font-semibold", flagged && "text-warning")}>
                  {flagged && <TriangleAlert size={22} aria-hidden />}
                  {tile.value}
                </span>
                <Bi id={tile.label} className="text-sm text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card overflow-x-auto">
          <h2 className="px-3 pt-3 font-semibold">
            <Bi id="dash.farmsToday" />
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th>
                  <Bi id="col.farm" />
                </th>
                <th className="text-right">IGP</th>
                <th className="text-right">OGP</th>
                <th>SIS</th>
                <th className="text-right">
                  <Bi id="dash.lastSlip" />
                </th>
              </tr>
            </thead>
            <tbody>
              {farmsToday.map((row) => (
                <tr key={row.farmId}>
                  <td className="font-medium whitespace-nowrap">{farmName(row.farmId)}</td>
                  <td className="num text-right">{row.igp}</td>
                  <td className="num text-right">{row.ogp}</td>
                  <td>
                    {row.sis > 0 ? (
                      <span className="flex items-center gap-1 text-primary">
                        <Check size={16} aria-hidden />
                        <Bi id="dash.saved" inline />
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 font-medium text-warning">
                        <TriangleAlert size={14} aria-hidden />
                        <Bi id="dash.missing" inline />
                      </span>
                    )}
                  </td>
                  <td className="num text-right text-muted">{row.lastSlipTime ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card overflow-x-auto">
          <h2 className="px-3 pt-3 font-semibold">
            <Bi id="dash.latest" />
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th>
                  <Bi id="col.time" />
                </th>
                <th>
                  <Bi id="col.farm" />
                </th>
                <th>
                  <Bi id="col.no" />
                </th>
                <th>
                  <Bi id="col.type" />
                </th>
                <th>
                  <Bi id="col.firstItem" />
                </th>
              </tr>
            </thead>
            <tbody>
              {latest.map((s) => {
                const first = s.lines[0]?.itemId ?? (s.type === "SIS" ? s.shedRows[0]?.feedItemId : undefined);
                return (
                  <tr key={s.id}>
                    <td className="num whitespace-nowrap text-muted">
                      {s.time}
                      <div className="text-xs">{s.date.slice(5)}</div>
                    </td>
                    <td className="whitespace-nowrap">{farms.find((f) => f.id === s.farmId)?.code}</td>
                    <td className="num font-medium whitespace-nowrap">{s.no}</td>
                    <td>
                      <TypeChip type={s.type} />
                    </td>
                    <td>{first ? items.get(first)?.name : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function tileList(tiles: Dashboard["tiles"]): { label: MsgId; value: number; href: string; alert?: boolean }[] {
  return [
    { label: "dash.slipsToday", value: tiles.slipsToday, href: "/admin/slips" },
    { label: "dash.inTransit", value: tiles.inTransit, href: "/admin/transfers" },
    { label: "dash.inTransitOld", value: tiles.inTransitOld, href: "/admin/transfers", alert: true },
    { label: "dash.shortfalls", value: tiles.shortfalls, href: "/admin/transfers", alert: true },
    { label: "dash.corrections", value: tiles.corrections, href: "/admin/corrections", alert: true },
  ];
}
