"use client";

import { StockCard } from "@/features/stock-card/stock-card";
import { useFarms } from "@/lib/api/queries";

/** The admin's view of an item stock card at one farm. */
export function AdminStockCard({ farmId, itemId }: { farmId: string; itemId: string }) {
  const farm = useFarms().data?.find((f) => f.id === farmId);
  return (
    <div className="flex flex-col gap-3">
      <span className="font-semibold">{farm?.name}</span>
      <StockCard farmId={farmId} itemId={itemId} slipHrefBase="/admin/slips" />
    </div>
  );
}
