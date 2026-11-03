"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Bi } from "@/components/layout/bi";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import { StatusChip } from "@/components/layout/status-chip";
import { TypeChip } from "@/components/layout/type-chip";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { useItemMap, useSlips } from "@/lib/api/queries";
import { fmtDate } from "@/lib/dates";
import { fmtQty, normalizeSearch } from "@/lib/format";
import { t, tInline } from "@/lib/i18n";
import { slipItemIds, slipLineCount, slipNo } from "@/lib/slips";
import type { Item, Slip, SlipType } from "@/types/domain";

const PAGE = 50;

/** F6 opened from Home's Find: ?q= and ?date= start the search (a new search starts the list afresh). */
export function MySlipsFromUrl() {
  const params = useSearchParams();
  return <MySlips key={params.toString()} initialQuery={params.get("q") ?? ""} initialDate={params.get("date") ?? ""} />;
}

/** How much of the item each slip moved: + in (IGP), − out (OGP, SIS). */
function qtyOf(slip: Slip, itemId: string) {
  switch (slip.type) {
    case "IGP":
      return slip.lines.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.qtyReceived, 0);
    case "OGP":
      return -slip.lines.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.qty, 0);
    case "SIS":
      return -(
        slip.lines.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.qty, 0) +
        slip.shedRows.filter((r) => r.feedItemId === itemId).reduce((n, r) => n + r.feedKg, 0)
      );
  }
}

/**
 * F6 — every slip of this farm: search by No. (paper or system) or item, type chips, date.
 * Searching an item shows how much of it each slip brought in (IGP), sent out (OGP) or issued (SIS).
 */
export function MySlips({ initialQuery = "", initialDate = "" }: { initialQuery?: string; initialDate?: string }) {
  const { farm } = useCurrentFarm();
  const slips = useSlips({ farmId: farm.id });
  const items = useItemMap();
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<SlipType | "">("");
  const [date, setDate] = useState(initialDate);
  const [limit, setLimit] = useState(PAGE);

  const q = normalizeSearch(query);
  const matchesItem = (item: Item | undefined) =>
    !!item && normalizeSearch(`${item.name} ${item.nameUr} ${item.aliases.join(" ")}`).includes(q);
  const filtered = (slips.data ?? []).filter((s) => {
    if (type && s.type !== type) return false;
    if (date && s.date !== date) return false;
    if (!q) return true;
    if (normalizeSearch(`${s.no} ${s.paperNo}`).includes(q)) return true;
    return slipItemIds(s).some((id) => matchesItem(items.get(id)));
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
              const found = q ? ids.map((id) => items.get(id)).filter((i): i is Item => matchesItem(i)) : [];
              return (
                <li key={s.id}>
                  <Link href={`/farm/slips/${encodeURIComponent(s.id)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <TypeChip type={s.type} />
                    <div className="min-w-0 flex-1">
                      <div className="num font-medium">{slipNo(s)}</div>
                      <div className="truncate text-sm text-muted">
                        {items.get(ids[0] ?? "")?.name}
                        {ids.length > 1 && (
                          <>
                            {" "}
                            <Bi id="home.andMore" values={{ n: ids.length - 1 }} inline />
                          </>
                        )}
                      </div>
                      {found.map((item) => {
                        const n = qtyOf(s, item.id);
                        return (
                          <div key={item.id} className={clsx("num text-sm font-semibold", n >= 0 ? "text-igp" : "text-ogp")}>
                            {item.name}: {n >= 0 ? "+" : "−"}
                            {fmtQty(Math.abs(n))} {t(`unit.${item.unit}`).en}
                          </div>
                        );
                      })}
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
