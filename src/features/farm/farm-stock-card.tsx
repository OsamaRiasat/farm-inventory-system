"use client";

import { useCurrentFarm } from "@/components/layout/farm-gate";
import { StockCard } from "@/features/stock-card/stock-card";

/** F9 — stock card of one item at this farm. */
export function FarmStockCard({ itemId }: { itemId: string }) {
  const { farm } = useCurrentFarm();
  return <StockCard farmId={farm.id} itemId={itemId} slipHrefBase="/farm/slips" />;
}
