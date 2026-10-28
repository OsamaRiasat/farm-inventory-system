import { Suspense } from "react";
import { SkeletonRows } from "@/components/ui/skeleton";
import { PrintView } from "@/features/print/print-view";

// S2 — print view of any slip, for the Farm User and the Accounts Admin.
export default function PrintPage({ params, searchParams }: PageProps<"/print/[slipId]">) {
  return (
    <Suspense fallback={<SkeletonRows rows={6} className="p-4" />}>
      <WithParams params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function WithParams({ params, searchParams }: Pick<PageProps<"/print/[slipId]">, "params" | "searchParams">) {
  const { slipId } = await params;
  const { saved } = await searchParams;
  return <PrintView slipId={decodeURIComponent(slipId)} justSaved={saved === "1"} />;
}
