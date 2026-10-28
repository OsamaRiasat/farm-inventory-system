import { Suspense } from "react";
import { FarmShell } from "@/components/layout/farm-shell";
import { SkeletonRows } from "@/components/ui/skeleton";
import { FarmStockCard } from "@/features/farm/farm-stock-card";

// F9 — Item stock card.
export default function StockCardPage({ params }: PageProps<"/farm/stock/[itemId]">) {
  return (
    <FarmShell active="stock">
      <Suspense fallback={<SkeletonRows rows={6} />}>
        <WithParams params={params} />
      </Suspense>
    </FarmShell>
  );
}

async function WithParams({ params }: Pick<PageProps<"/farm/stock/[itemId]">, "params">) {
  const { itemId } = await params;
  return <FarmStockCard itemId={decodeURIComponent(itemId)} />;
}
