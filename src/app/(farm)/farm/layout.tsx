import { Suspense } from "react";
import { FarmGate } from "@/components/layout/farm-gate";
import { NavTracker } from "@/lib/nav-history";

// Every Farm User screen sits behind the gate: signed-in farm + farm data loaded.
export default function FarmLayout({ children }: LayoutProps<"/farm">) {
  return (
    <>
      <FarmGate>{children}</FarmGate>
      <Suspense fallback={null}>
        <NavTracker />
      </Suspense>
    </>
  );
}
