"use client";

import Link from "next/link";
import { Bi } from "@/components/layout/bi";
import { TypeChip } from "@/components/layout/type-chip";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { useItemMap, useStockCard } from "@/lib/api/queries";
import { fmtDate } from "@/lib/dates";
import { fmtQty } from "@/lib/format";
import { t } from "@/lib/i18n";

/**
 * F9 (and the admin's view of it) — every movement of one item at one farm with the running balance.
 * Replaces the Ledger Folio. Newest first; the last balance is the stock on hand.
 */
export function StockCard({ farmId, itemId, slipHrefBase }: { farmId: string; itemId: string; slipHrefBase: string }) {
  const card = useStockCard(farmId, itemId);
  const items = useItemMap();
  const item = items.get(itemId);

  if (card.isError) return <LoadError onRetry={() => card.refetch()} />;
  if (!card.data || !item) return <SkeletonRows rows={8} />;

  const rows = [...card.data].reverse();
  const balance = card.data.at(-1)?.balance ?? 0;
  const unit = t(`unit.${item.unit}`).en;

  return (
    <div className="flex flex-col gap-3">
      <div className="card flex flex-wrap items-end justify-between gap-3 p-4">
        <div>
          <h1 className="text-xl font-semibold">{item.name}</h1>
          <div lang="ur" dir="rtl" className="text-left text-lg">
            {item.nameUr}
          </div>
          <div className="text-sm text-muted">
            <Bi id="line.ledgerFolio" inline /> <span className="num">{item.number}</span> · {item.category}
          </div>
        </div>
        <div className="text-right">
          <Bi id="card.balance" className="text-sm text-muted" />
          <div className="num text-3xl font-semibold">
            {fmtQty(balance)} <span className="text-base text-muted">{unit}</span>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="card p-4 text-muted">
          <Bi id="card.empty" />
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
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
