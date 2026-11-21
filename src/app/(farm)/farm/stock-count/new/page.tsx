import { SlipScreen } from "@/components/layout/slip-screen";
import { StockCountForm } from "@/features/stock-count/stock-count-form";
import { ResetOnHide } from "@/lib/on-hide";

// F10 — Stock count.
export default function StockCountPage() {
  return (
    <SlipScreen backHref="/farm/stock">
      <ResetOnHide>
        <StockCountForm />
      </ResetOnHide>
    </SlipScreen>
  );
}
