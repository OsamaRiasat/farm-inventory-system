import { FarmShell } from "@/components/layout/farm-shell";
import { MySlips } from "@/features/farm/my-slips";

// F6 — My slips.
export default function MySlipsPage() {
  return (
    <FarmShell active="slips">
      <MySlips />
    </FarmShell>
  );
}
