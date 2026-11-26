import { Suspense } from "react";
import { SkeletonRows } from "@/components/ui/skeleton";
import { ItemsSetup } from "@/features/admin/items-setup";

// A9 — Items. Reads ?show=requested, so it sits in a Suspense boundary (Cache Components).
export default function Page() {
  return (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <ItemsSetup />
    </Suspense>
  );
}
