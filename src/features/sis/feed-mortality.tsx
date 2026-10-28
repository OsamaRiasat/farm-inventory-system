"use client";

import { useId, useState, type CSSProperties } from "react";
import { Bi } from "@/components/layout/bi";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import { QtyInput } from "@/components/slip/qty-input";
import { rowErrors, useSlipErrors } from "@/components/slip/slip-errors";
import { Skeleton } from "@/components/ui/skeleton";
import { useItems, useStock } from "@/lib/api/queries";
import { fmtQty, parseQty } from "@/lib/format";
import type { MsgId } from "@/lib/i18n";

type ShedRow = { feedItem: string; feedKg: string; mortMale: string; mortFemale: string };
type NumKey = "feedKg" | "mortMale" | "mortFemale";

const numCols: { key: NumKey; label: MsgId; suffix?: string; decimals?: boolean }[] = [
  { key: "feedKg", label: "sis.feedUsed", suffix: "KG", decimals: true },
  { key: "mortMale", label: "sis.mortMale" },
  { key: "mortFemale", label: "sis.mortFemale" },
];

/** SIS "Feed and Mortality": one row per shed of this farm; empty rows are skipped on save. */
export function FeedMortality() {
  const uid = useId();
  const { farm } = useCurrentFarm();
  const sheds = farm.sheds.filter((s) => s.active);
  const items = useItems();
  const stock = useStock(farm.id).data;
  const saveErrors = useSlipErrors();
  const [rows, setRows] = useState<ShedRow[]>(() =>
    sheds.map(() => ({ feedItem: "", feedKg: "", mortMale: "", mortFemale: "" })),
  );

  if (sheds.length === 0) return null;

  const feedItems = (items.data ?? []).filter((i) => i.isFeed && i.active);
  // Default feed: the one this farm has in stock (later: the last one used).
  const defaultFeed = feedItems.find((i) => (stock?.get(i.id) ?? 0) > 0)?.id ?? feedItems[0]?.id ?? "";
  const sum = (key: NumKey) => rows.reduce((total, r) => total + (parseQty(r[key]) ?? 0), 0);

  function set(index: number, patch: Partial<ShedRow>) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <section className="card mb-4 p-4" style={{ "--shed-cols": "6rem 1.4fr 1fr 1fr 1fr" } as CSSProperties}>
      <h2 className="mb-3 font-semibold">
        <Bi id="sis.feedMort" />
      </h2>

      <div className="hidden gap-2 border-b border-line px-2 pb-2 text-xs text-muted sm:grid sm:[grid-template-columns:var(--shed-cols)]">
        <Bi id="sis.shed" />
        <Bi id="sis.feed" />
        {numCols.map((c) => (
          <span key={c.key} className="flex justify-end">
            <Bi id={c.label} />
          </span>
        ))}
      </div>

      <ol className="flex flex-col gap-3 sm:gap-0">
        {rows.map((row, i) => {
          const errs = rowErrors(saveErrors, "shed", i);
          return (
          <li
            key={sheds[i].id}
            className="grid grid-cols-3 items-end gap-x-3 gap-y-2 rounded-lg border border-line p-3 sm:items-start sm:gap-2 sm:rounded-none sm:border-0 sm:border-b sm:px-2 sm:[grid-template-columns:var(--shed-cols)]"
          >
            <div className="col-span-3 font-semibold sm:col-span-1 sm:pt-3">
              {sheds[i].name}
              <input type="hidden" name={`shed.${i}.shedId`} value={sheds[i].id} />
            </div>
            <div className="col-span-3 sm:col-span-1">
              <span id={`${uid}-${i}-feed`} className="mb-1 block text-sm font-medium sm:hidden">
                <Bi id="sis.feed" />
              </span>
              {items.data ? (
                <select
                  name={`shed.${i}.feedItem`}
                  className="input"
                  value={row.feedItem || defaultFeed}
                  onChange={(e) => set(i, { feedItem: e.target.value })}
                  aria-labelledby={`${uid}-${i}-feed`}
                >
                  {feedItems.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} / {f.nameUr}
                    </option>
                  ))}
                </select>
              ) : (
                <Skeleton className="h-12" />
              )}
            </div>
            {numCols.map((c) => (
              <div key={c.key}>
                <span id={`${uid}-${i}-${c.key}`} className="mb-1 block text-sm font-medium sm:hidden">
                  <Bi id={c.label} />
                </span>
                <QtyInput
                  name={`shed.${i}.${c.key}`}
                  value={row[c.key]}
                  onChange={(v) => set(i, { [c.key]: v })}
                  suffix={c.suffix}
                  decimals={c.decimals}
                  aria-labelledby={`${uid}-${i}-${c.key}`}
                  invalid={errs.keys.has(c.key)}
                />
              </div>
            ))}
            {errs.errors.length > 0 && (
              <div className="col-span-full text-sm font-medium text-danger">
                {errs.errors.map((e, k) => (
                  <Bi key={k} id={e.id} values={e.values} />
                ))}
              </div>
            )}
          </li>
          );
        })}
      </ol>

      <p className="num mt-3 flex flex-wrap gap-x-4 font-semibold">
        <Bi id="sis.total" inline />
        <span>{fmtQty(sum("feedKg"))} KG</span>
        <span className="flex gap-1">
          <Bi id="sis.mortMale" inline /> {sum("mortMale")}
        </span>
        <span className="flex gap-1">
          <Bi id="sis.mortFemale" inline /> {sum("mortFemale")}
        </span>
      </p>
    </section>
  );
}
