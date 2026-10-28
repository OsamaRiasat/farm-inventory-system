"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Bi } from "@/components/layout/bi";
import { StockCard } from "@/features/stock-card/stock-card";
import { useFarms } from "@/lib/api/queries";

/** The admin's view of an item stock card at one farm. */
export function AdminStockCard({ farmId, itemId }: { farmId: string; itemId: string }) {
  const farm = useFarms().data?.find((f) => f.id === farmId);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Link href="/admin/stock" className="btn min-h-10">
          <ChevronLeft size={18} aria-hidden />
          <Bi id="nav.stock" inline />
        </Link>
        <span className="font-semibold">{farm?.name}</span>
      </div>
      <StockCard farmId={farmId} itemId={itemId} slipHrefBase="/admin/slips" />
    </div>
  );
}
