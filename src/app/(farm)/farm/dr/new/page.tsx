import { SlipScreen } from "@/components/layout/slip-screen";
import { DrForm } from "@/features/daily-report/dr-form";

// New Daily Report (T07): eggs and trays for one date.
export default function NewDrPage() {
  return (
    <SlipScreen>
      <DrForm />
    </SlipScreen>
  );
}
