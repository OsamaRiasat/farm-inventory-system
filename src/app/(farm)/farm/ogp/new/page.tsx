import { SlipScreen } from "@/components/layout/slip-screen";
import { OgpForm } from "@/features/ogp/ogp-form";

// F4 — New Outward Gate Pass.
export default function NewOgpPage() {
  return (
    <SlipScreen>
      <OgpForm />
    </SlipScreen>
  );
}
