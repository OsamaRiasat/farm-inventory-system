import { Suspense } from "react";
import { SkeletonRows } from "@/components/ui/skeleton";
import { SlipDetail } from "@/features/slip-detail/slip-detail";

// A3 — Slip detail for the Accounts Admin: as F7, plus Correct and Cancel.
export default function AdminSlipPage({ params, searchParams }: PageProps<"/admin/slips/[id]">) {
  return (
    <Suspense fallback={<SkeletonRows rows={6} />}>
      <WithParams params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function WithParams({ params, searchParams }: Pick<PageProps<"/admin/slips/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const { request } = await searchParams;
  return <SlipDetail slipId={decodeURIComponent(id)} mode="admin" requestId={typeof request === "string" ? request : undefined} />;
}
