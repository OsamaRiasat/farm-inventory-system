import { Suspense } from "react";
import { FarmShell } from "@/components/layout/farm-shell";
import { SkeletonRows } from "@/components/ui/skeleton";
import { FarmSlipDetail } from "@/features/farm/farm-slip-detail";

// F7 — Slip detail (read-only, print, request correction).
export default function SlipDetailPage({ params, searchParams }: PageProps<"/farm/slips/[id]">) {
  return (
    <FarmShell active="slips">
      <Suspense fallback={<SkeletonRows rows={6} />}>
        <WithParams params={params} searchParams={searchParams} />
      </Suspense>
    </FarmShell>
  );
}

async function WithParams({ params, searchParams }: Pick<PageProps<"/farm/slips/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const { saved } = await searchParams;
  return <FarmSlipDetail slipId={decodeURIComponent(id)} justSaved={saved === "1"} />;
}
