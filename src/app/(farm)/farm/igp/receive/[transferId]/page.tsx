import { Suspense } from "react";
import { SlipScreen } from "@/components/layout/slip-screen";
import { SkeletonRows } from "@/components/ui/skeleton";
import { ReceiveTransfer } from "@/features/igp/receive-transfer";

// F3 — Receive transfer.
export default function ReceiveTransferPage({ params }: PageProps<"/farm/igp/receive/[transferId]">) {
  return (
    <SlipScreen>
      <Suspense fallback={<SkeletonRows rows={4} />}>
        <WithTransferId params={params} />
      </Suspense>
    </SlipScreen>
  );
}

async function WithTransferId({ params }: { params: Promise<{ transferId: string }> }) {
  const { transferId } = await params;
  return <ReceiveTransfer transferId={decodeURIComponent(transferId)} />;
}
