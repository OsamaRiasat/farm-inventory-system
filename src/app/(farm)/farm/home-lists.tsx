"use client";

import Link from "next/link";
import { ChevronLeft, Truck } from "lucide-react";
import { Bi } from "@/components/layout/bi";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import { StatusChip } from "@/components/layout/status-chip";
import { TypeChip } from "@/components/layout/type-chip";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { useFarms, useItemMap, useSlips, useWaitingTransfers } from "@/lib/api/queries";
import { fmtDate, today } from "@/lib/dates";
import { slipItemIds } from "@/lib/slips";

/** F1 "Waiting to receive": transfers sent to this farm. Hidden when empty. */
export function WaitingToReceive() {
  const { farm } = useCurrentFarm();
  const waiting = useWaitingTransfers(farm.id);
  const farms = useFarms().data ?? [];

  if (waiting.isError) return <LoadError onRetry={() => waiting.refetch()} />;
  if (!waiting.data) return <SkeletonRows rows={1} className="mt-6" />;
  if (waiting.data.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="mb-2 font-semibold">
        <Bi id="home.waiting" />
      </h2>
      <ul className="card divide-y divide-line">
        {waiting.data.map(({ transfer, ogp }) => (
          <li key={transfer.id}>
            <Link href={`/farm/igp/receive/${transfer.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3">
              <Truck size={24} className="shrink-0 text-igp" aria-hidden />
              <div className="flex-1">
                <div className="font-medium">
                  {farms.find((f) => f.id === transfer.fromFarmId)?.name} · <span className="num">{ogp.no}</span>
                </div>
                <div className="text-sm text-muted">
                  <Bi id="home.waitingRow" values={{ n: ogp.lines.length, date: fmtDate(ogp.date) }} inline />
                </div>
              </div>
              <ChevronLeft size={20} className="rotate-180 text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** F1 "Today's slips": No., type chip, time, first item + "and N more". */
export function TodaySlips() {
  const { farm } = useCurrentFarm();
  const day = today();
  const slips = useSlips({ farmId: farm.id, from: day, to: day });
  const items = useItemMap();

  return (
    <section className="mt-6">
      <h2 className="mb-2 font-semibold">
        <Bi id="home.today" />
      </h2>
      {slips.isError ? (
        <LoadError onRetry={() => slips.refetch()} />
      ) : !slips.data ? (
        <SkeletonRows rows={3} />
      ) : slips.data.length === 0 ? (
        <p className="card p-4 text-muted">
          <Bi id="home.todayEmpty" />
        </p>
      ) : (
        <ul className="card divide-y divide-line">
          {slips.data.map((s) => {
            const ids = slipItemIds(s);
            const first = ids[0];
            const more = Math.max(ids.length - 1, 0);
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <TypeChip type={s.type} />
                <div className="flex-1">
                  <div className="num font-medium">{s.no}</div>
                  <div className="text-sm text-muted">
                    {first ? items.get(first)?.name : null}
                    {more > 0 && (
                      <>
                        {" "}
                        <Bi id="home.andMore" values={{ n: more }} inline />
                      </>
                    )}
                  </div>
                  {s.status !== "saved" && <StatusChip status={s.status} className="mt-1" />}
                </div>
                <span className="num text-sm text-muted">{s.time}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
