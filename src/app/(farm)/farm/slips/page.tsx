import { Suspense } from "react";
import { FarmShell } from "@/components/layout/farm-shell";
import { SkeletonRows } from "@/components/ui/skeleton";
import { MySlipsFromUrl } from "@/features/farm/my-slips";

// F6 — My slips. Reads ?q= / ?date= from Home's Find, so the list sits inside <Suspense>.
export default function MySlipsPage() {
  return (
    <FarmShell active="slips">
      <Suspense fallback={<SkeletonRows rows={6} />}>
        <MySlipsFromUrl />
      </Suspense>
    </FarmShell>
  );
}
