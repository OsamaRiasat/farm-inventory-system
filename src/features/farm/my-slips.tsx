"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { Search } from "lucide-react";
import { useState } from "react";
import { Bi } from "@/components/layout/bi";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import { StatusChip } from "@/components/layout/status-chip";
import { TypeChip } from "@/components/layout/type-chip";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { useItemMap, useSlips } from "@/lib/api/queries";
import { fmtDate } from "@/lib/dates";
import { normalizeSearch } from "@/lib/format";
import { tInline } from "@/lib/i18n";
import { slipItemIds, slipLineCount } from "@/lib/slips";
import type { SlipType } from "@/types/domain";

const PAGE = 50;

/** F6 — every slip of this farm: search by No. or item, type chips, date. */
export function MySlips() {
  const { farm } = useCurrentFarm();
  const slips = useSlips({ farmId: farm.id });
  const items = useItemMap();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SlipType | "">("");
  const [date, setDate] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const q = normalizeSearch(query);
  const filtered = (slips.data ?? []).filter((s) => {
    if (type && s.type !== type) return false;
    if (date && s.date !== date) return false;
    if (!q) return true;
    if (normalizeSearch(s.no).includes(q)) return true;
    return slipItemIds(s).some((id) => {
      const item = items.get(id);
      return item && normalizeSearch(`${item.name} ${item.nameUr} ${item.aliases.join(" ")}`).includes(q);
    });
  });

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">
        <Bi id="slips.title" />
      </h1>
      <div className="relative">
        <Search size={20} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          data-search
          dir="auto"
          className="input pl-10"
          placeholder={tInline("slips.search")}
          aria-label={tInline("slips.search")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(["", "IGP", "OGP", "SIS"] as const).map((t) => (
          <button
            key={t || "all"}
            type="button"
            aria-pressed={type === t}
            onClick={() => setType(t)}
            className={clsx("btn min-h-10 rounded-full px-4", type === t && "border-primary bg-primary-soft font-semibold text-primary")}
          >
            {t || <Bi id="slips.all" inline />}
          </button>
        ))}
        <input
          type="date"
          className="input num min-h-10 w-auto"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label={tInline("slip.date")}
        />
      </div>

      {slips.isError ? (
        <LoadError onRetry={() => slips.refetch()} />
      ) : !slips.data ? (
        <SkeletonRows rows={6} />
      ) : filtered.length === 0 ? (
        <p className="card p-4 text-muted">
          <Bi id="slips.empty" />
        </p>
      ) : (
        <>
          <ul className="card divide-y divide-line">
            {filtered.slice(0, limit).map((s) => {
              const ids = slipItemIds(s);
              return (
                <li key={s.id}>
                  <Link href={`/farm/slips/${encodeURIComponent(s.id)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <TypeChip type={s.type} />
                    <div className="min-w-0 flex-1">
                      <div className="num font-medium">{s.no}</div>
                      <div className="truncate text-sm text-muted">
                        {items.get(ids[0] ?? "")?.name}
                        {ids.length > 1 && (
                          <>
                            {" "}
                            <Bi id="home.andMore" values={{ n: ids.length - 1 }} inline />
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                      <span className="num text-muted">
                        {fmtDate(s.date)} {s.time}
                      </span>
                      <span className="text-muted">
                        <Bi id="slips.lines" values={{ n: slipLineCount(s) }} inline />
                      </span>
                      {s.status !== "saved" && <StatusChip status={s.status} />}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          {filtered.length > limit && (
            <button type="button" className="btn" onClick={() => setLimit((l) => l + PAGE)}>
              <Bi id="slips.showMore" inline />
            </button>
          )}
        </>
      )}
    </div>
  );
}
