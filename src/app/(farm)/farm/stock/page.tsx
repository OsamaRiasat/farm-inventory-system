import { FarmShell } from "@/components/layout/farm-shell";
import { FarmStock } from "@/features/farm/farm-stock";

// F8 — Farm stock.
export default function FarmStockPage() {
  return (
    <FarmShell active="stock">
      <FarmStock />
    </FarmShell>
  );
}
