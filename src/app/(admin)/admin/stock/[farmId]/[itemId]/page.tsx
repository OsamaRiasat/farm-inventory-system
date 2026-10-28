import { Suspense } from "react";
import { SkeletonRows } from "@/components/ui/skeleton";
import { AdminStockCard } from "@/features/admin/admin-stock-card";

// A4 → stock card of one item at one farm.
export default function AdminStockCardPage({ params }: PageProps<"/admin/stock/[farmId]/[itemId]">) {
  return (
    <Suspense fallback={<SkeletonRows rows={6} />}>
      <WithParams params={params} />
    </Suspense>
  );
}

async function WithParams({ params }: Pick<PageProps<"/admin/stock/[farmId]/[itemId]">, "params">) {
  const { farmId, itemId } = await params;
  return <AdminStockCard farmId={decodeURIComponent(farmId)} itemId={decodeURIComponent(itemId)} />;
}
