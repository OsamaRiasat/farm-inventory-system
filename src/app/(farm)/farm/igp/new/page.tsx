import { SlipScreen } from "@/components/layout/slip-screen";
import { IgpForm } from "@/features/igp/igp-form";

// F2 — New Inward Gate Pass.
export default function NewIgpPage() {
  return (
    <SlipScreen>
      <IgpForm />
    </SlipScreen>
  );
}
