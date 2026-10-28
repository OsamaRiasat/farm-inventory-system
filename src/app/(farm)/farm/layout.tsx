import { FarmGate } from "@/components/layout/farm-gate";

// Every Farm User screen sits behind the gate: signed-in farm + farm data loaded.
export default function FarmLayout({ children }: LayoutProps<"/farm">) {
  return <FarmGate>{children}</FarmGate>;
}
