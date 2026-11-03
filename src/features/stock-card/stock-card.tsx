"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useState } from "react";
import { Bi } from "@/components/layout/bi";
import { TypeChip } from "@/components/layout/type-chip";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { useItemMap, useStockCard } from "@/lib/api/queries";
import { addDays, fmtDate, today } from "@/lib/dates";
import { downloadCsv } from "@/lib/export";
import { fmtQty } from "@/lib/format";
import { t, type MsgId } from "@/lib/i18n";

type Range = { from: string; to: string };

/** Quick ranges: last 7 days, this month (1st to today), everything. */
function presets(): { id: MsgId; range: Range }[] {
  const day = today();
  return [
    { id: "card.week", range: { from: addDays(day, -6), to: day } },
    { id: "card.month", range: { from: `${day.slice(0, 8)}01`, to: day } },
    { id: "card.all", range: { from: "", to: "" } },
  ];
}

/**
 * F9 (and the admin's view of it) — every movement of one item at one farm with the running balance.
 * Newest first; the last balance is the stock on hand. A date range (week / month / any) shows the
 * opening balance on its first day; Excel and PDF take what the range shows.
 */
export function StockCard({ farmId, itemId, slipHrefBase }: { farmId: string; itemId: string; slipHrefBase: string }) {
  const card = useStockCard(farmId, itemId);
  const items = useItemMap();
  const item = items.get(itemId);
  const [range, setRange] = useState<Range>({ from: "", to: "" });

  if (card.isError) return <LoadError onRetry={() => card.refetch()} />;
  if (!card.data || !item) return <SkeletonRows rows={8} />;

  const all = card.data;
  const balance = all.at(-1)?.balance ?? 0;
  const unit = t(`unit.${item.unit}`).en;
  const inRange = all.filter((m) => (!range.from || m.date >= range.from) && (!range.to || m.date <= range.to));
  const before = range.from ? all.filter((m) => m.date < range.from) : [];
  const opening = range.from ? (before.at(-1)?.balance ?? 0) : null;
  const rows = [...inRange].reverse();
  const totalIn = inRange.reduce((n, m) => n + m.qtyIn, 0);
  const totalOut = inRange.reduce((n, m) => n + m.qtyOut, 0);

  function exportExcel() {
    if (!item) return;
    const label = (m: (typeof all)[number]) => (m.kind === "OPENING" ? "Opening balance" : m.ref);
    downloadCsv(`${farmId} ${item.name} ${range.from || "start"} to ${range.to || today()}`, [
      ["Item", item.name, item.nameUr, unit],
      ["From", range.from ? fmtDate(range.from) : "", "To", range.to ? fmtDate(range.to) : fmtDate(today())],
      [],
      ["Date", "No.", "Type", "In", "Out", "In stock"],
      ...(opening !== null ? [[fmtDate(range.from), "Opening balance", "", "", "", opening]] : []),
      ...inRange.map((m) => [fmtDate(m.date), label(m), m.kind, m.qtyIn || "", m.qtyOut || "", m.balance]),
      ["", "Total", "", totalIn, totalOut, ""],
    ]);
  }

  return (
    <div className="print-area flex w-full flex-col gap-3">
      <div className="card flex flex-wrap items-end justify-between gap-3 p-4">
        <div>
          <h1 className="text-xl font-semibold">{item.name}</h1>
          <div lang="ur" dir="rtl" className="text-left text-lg">
            {item.nameUr}
          </div>
          <div className="text-sm text-muted">
            <Bi id="card.itemNo" inline /> <span className="num">{item.number}</span> · {item.category}
          </div>
        </div>
        <div className="text-right">
          <Bi id="card.balance" className="text-sm text-muted" />
          <div className="num text-3xl font-semibold">
            {fmtQty(balance)} <span className="text-base text-muted">{unit}</span>
          </div>
        </div>
      </div>

      <div className="card flex flex-wrap items-end gap-2 p-3 print:hidden">
        <div className="flex w-full flex-wrap gap-2">
          {presets().map((p) => {
            const active = p.range.from === range.from && p.range.to === range.to;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => setRange(p.range)}
                className={clsx("btn min-h-10 rounded-full px-4", active && "border-primary bg-primary-soft font-semibold text-primary")}
              >
                <Bi id={p.id} inline />
              </button>
            );
          })}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <Bi id="filter.from" />
          <input
            type="date"
            className="input num min-h-10 w-auto"
            value={range.from}
            max={range.to || undefined}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <Bi id="filter.to" />
          <input
            type="date"
            className="input num min-h-10 w-auto"
            value={range.to}
            min={range.from || undefined}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </label>
        <span className="flex-1" />
        <button type="button" className="btn" onClick={exportExcel}>
          <FileSpreadsheet size={18} aria-hidden />
          <Bi id="export.excel" inline />
        </button>
        <button type="button" className="btn" onClick={() => window.print()}>
          <Printer size={18} aria-hidden />
          <Bi id="export.pdf" inline />
        </button>
      </div>
      {(range.from || range.to) && (
        <p className="num hidden text-sm print:block">
          {range.from ? fmtDate(range.from) : "…"} – {fmtDate(range.to || today())}
        </p>
      )}

      {rows.length === 0 && opening === null ? (
        <p className="card p-4 text-muted">
          <Bi id={all.length ? "card.emptyRange" : "card.empty"} />
        </p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <Bi id="slip.date" />
                </th>
                <th>
                  <Bi id="col.no" />
                </th>
                <th className="text-right">
                  <Bi id="card.in" />
                </th>
                <th className="text-right">
                  <Bi id="card.out" />
                </th>
                <th className="text-right">
                  <Bi id="card.balance" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="num whitespace-nowrap">{fmtDate(m.date)}</td>
                  <td>
                    {m.kind === "OPENING" ? (
                      <Bi id="card.opening" inline />
                    ) : m.kind === "COUNT" ? (
                      <span className="num">{m.ref}</span>
                    ) : (
                      <Link href={`${slipHrefBase}/${encodeURIComponent(m.slipId)}`} className="flex items-center gap-2 text-primary underline">
                        <TypeChip type={m.kind} />
                        <span className="num whitespace-nowrap">{m.ref}</span>
                      </Link>
                    )}
                  </td>
                  <td className="num text-right text-igp">{m.qtyIn ? `+${fmtQty(m.qtyIn)}` : ""}</td>
                  <td className="num text-right text-ogp">{m.qtyOut ? `−${fmtQty(m.qtyOut)}` : ""}</td>
                  <td className="num text-right font-semibold">{fmtQty(m.balance)}</td>
                </tr>
              ))}
              {opening !== null && (
                <tr>
                  <td className="num whitespace-nowrap">{fmtDate(range.from)}</td>
                  <td>
                    <Bi id="card.opening" inline />
                  </td>
                  <td />
                  <td />
                  <td className="num text-right font-semibold">{fmtQty(opening)}</td>
                </tr>
              )}
            </tbody>
            {(range.from || range.to) && (
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={2}>
                    <Bi id="card.total" inline />
                  </td>
                  <td className="num text-right text-igp">{totalIn ? `+${fmtQty(totalIn)}` : ""}</td>
                  <td className="num text-right text-ogp">{totalOut ? `−${fmtQty(totalOut)}` : ""}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
