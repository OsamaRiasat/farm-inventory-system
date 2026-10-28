"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Bi } from "@/components/layout/bi";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import { QtyInput } from "@/components/slip/qty-input";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { filterItems } from "@/features/farm/farm-stock";
import { newIdempotencyKey } from "@/features/form-data";
import { api, ApiError } from "@/lib/api";
import { useApiMutation, useItems, useStock } from "@/lib/api/queries";
import { nowTime, today } from "@/lib/dates";
import { allowsDecimals, fmtQty, parseQty } from "@/lib/format";
import { t, tInline, type MsgId, type MsgValues } from "@/lib/i18n";
import { enterToNext } from "@/lib/keyboard/focus";
import { useSaveShortcut } from "@/lib/keyboard/use-shortcut";
import { setDirty } from "@/lib/leave-guard";
import type { StockCount } from "@/types/domain";

/**
 * F10 — physical count. Pick a category (or all), type the counted quantity for the items counted,
 * see the difference, give a reason, save. Stock then equals the count. Replaces "Adjust Quantity on Hand".
 */
export function StockCountForm() {
  const { farm, userName } = useCurrentFarm();
  const items = useItems();
  const stock = useStock(farm.id);
  const mutation = useApiMutation(api.saveStockCount);
  const key = useRef(newIdempotencyKey());
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState("");
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState<StockCount | null>(null);
  const [error, setError] = useState<{ id: MsgId; values?: MsgValues } | null>(null);

  useSaveShortcut(() => formRef.current?.requestSubmit());
  useEffect(() => () => setDirty(false), []);

  if (items.isError || stock.isError) return <LoadError onRetry={() => void Promise.all([items.refetch(), stock.refetch()])} />;
  if (!items.data || !stock.data) return <SkeletonRows rows={8} />;

  const categories = [...new Set(items.data.map((i) => i.category))].sort();
  const rows = filterItems(items.data, "", category);
  const system = (id: string) => stock.data.get(id) ?? 0;
  const entered = Object.entries(counted).flatMap(([itemId, text]) => {
    const n = parseQty(text);
    return n === null ? [] : [{ itemId, countedQty: n }];
  });
  const differing = entered.filter((l) => l.countedQty !== system(l.itemId)).length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mutation.isPending) return;
    if (entered.length === 0) return setError({ id: "err.noLines" });
    if (!reason.trim()) return setError({ id: "err.enterReason" });
    try {
      const count = await mutation.mutateAsync({
        farmId: farm.id,
        date: today(),
        time: nowTime(),
        preparedBy: userName,
        idempotencyKey: key.current,
        reason,
        lines: entered,
      });
      key.current = newIdempotencyKey();
      setDirty(false);
      setSaved(count);
      setCounted({});
      setReason("");
      setError(null);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ApiError && err.id !== "err.notSaved" ? { id: err.id, values: err.values } : { id: "err.notSaved" });
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      onKeyDown={enterToNext}
      onInput={() => {
        setDirty(true);
        setSaved(null);
      }}
      noValidate
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold">
          <Bi id="count.title" />
        </h1>
        <label className="flex flex-col gap-1 text-sm font-medium">
          <Bi id="stock.category" />
          <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{tInline("stock.allCategories")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {saved && (
        <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary bg-success-bg p-3">
          <span className="flex items-center gap-2 font-medium">
            <CircleCheck className="shrink-0 text-primary" aria-hidden />
            <Bi id="count.saved" values={{ no: saved.no }} />
          </span>
          <Link href="/farm/stock" className="btn min-h-10">
            <Bi id="nav.stock" inline />
          </Link>
        </div>
      )}

      <p className="mb-2 text-sm text-muted">
        <Bi id="count.hint" />
      </p>

      {/* Card per item on a phone, a row from 640px (same as the slip lines). */}
      <div className="card" style={{ "--count-cols": "1fr 9rem 10rem 6rem" } as CSSProperties}>
        <div className="hidden gap-3 border-b border-line px-4 py-2 text-xs text-muted sm:grid sm:[grid-template-columns:var(--count-cols)]">
          <Bi id="line.item" />
          <span className="text-right">
            <Bi id="count.system" />
          </span>
          <span className="text-right">
            <Bi id="count.counted" />
          </span>
          <span className="text-right">
            <Bi id="count.difference" />
          </span>
        </div>
        <ul className="divide-y divide-line">
          {rows.map((item) => {
            const n = parseQty(counted[item.id] ?? "");
            const diff = n === null ? 0 : n - system(item.id);
            return (
              <li
                key={item.id}
                className={clsx(
                  "grid grid-cols-[1fr_8rem] items-center gap-x-3 gap-y-1 px-4 py-2 sm:[grid-template-columns:var(--count-cols)]",
                  diff !== 0 && "bg-warning-bg",
                )}
              >
                <div className="col-span-2 sm:col-span-1">
                  <div className="font-medium">{item.name}</div>
                  <div lang="ur" dir="rtl" className="text-left text-sm text-muted">
                    {item.nameUr}
                  </div>
                </div>
                <div className="num text-sm sm:text-right sm:text-base">
                  <span className="text-muted sm:hidden">
                    <Bi id="count.system" inline />:{" "}
                  </span>
                  {fmtQty(system(item.id))} <span className="text-muted">{t(`unit.${item.unit}`).en}</span>
                </div>
                <div className="row-span-2 sm:row-span-1">
                  <QtyInput
                    value={counted[item.id] ?? ""}
                    onChange={(v) => {
                      setCounted((c) => ({ ...c, [item.id]: v }));
                      setError(null);
                    }}
                    decimals={allowsDecimals(item.unit)}
                    aria-label={`${item.name} — ${tInline("count.counted")}`}
                  />
                </div>
                <div className={clsx("num text-sm font-semibold sm:text-right sm:text-base", diff < 0 ? "text-danger" : diff > 0 ? "text-igp" : "text-muted")}>
                  {n === null ? "" : diff === 0 ? "0" : `${diff > 0 ? "+" : ""}${fmtQty(diff)}`}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex flex-col gap-2 border-t border-line bg-surface px-4 py-3">
        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm font-medium text-danger">
            <TriangleAlert size={16} aria-hidden />
            <Bi id={error.id} values={error.values} inline />
          </p>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm font-medium">
            <span className="flex gap-2">
              <Bi id="count.reason" />
              {differing > 0 && (
                <span className="text-warning">
                  <Bi id="count.changed" values={{ n: differing }} inline />
                </span>
              )}
            </span>
            <input dir="auto" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button type="submit" data-save className="btn btn-primary btn-lg sm:min-w-56" disabled={mutation.isPending}>
            {mutation.isPending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
            <Bi id="slip.save" inline />
          </button>
        </div>
      </div>
    </form>
  );
}
