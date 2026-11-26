import { Suspense } from "react";
import { SkeletonRows } from "@/components/ui/skeleton";
import { PrintView } from "@/features/print/print-view";

// S2 — print view of any slip, for the Farm User and the Accounts Admin.
export default function PrintPage({ params }: PageProps<"/print/[slipId]">) {
  return (
    <Suspense fallback={<SkeletonRows rows={6} className="p-4" />}>
      <WithParams params={params} />
    </Suspense>
  );
}

async function WithParams({ params }: Pick<PageProps<"/print/[slipId]">, "params">) {
  const { slipId } = await params;
  return <PrintView slipId={decodeURIComponent(slipId)} />;
}
