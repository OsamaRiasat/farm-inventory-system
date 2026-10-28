import { SlipScreen } from "@/components/layout/slip-screen";
import { StockCountForm } from "@/features/stock-count/stock-count-form";

// F10 — Stock count.
export default function StockCountPage() {
  return (
    <SlipScreen backHref="/farm/stock">
      <StockCountForm />
    </SlipScreen>
  );
}
