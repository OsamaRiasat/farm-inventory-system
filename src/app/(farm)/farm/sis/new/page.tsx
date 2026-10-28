import { SlipScreen } from "@/components/layout/slip-screen";
import { SisForm } from "@/features/sis/sis-form";

// F5 — New Stock Issue Slip.
export default function NewSisPage() {
  return (
    <SlipScreen>
      <SisForm />
    </SlipScreen>
  );
}
