import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Bi } from "@/components/layout/bi";
import { LangOrderToggle } from "@/components/layout/lang-order-toggle";
import { DevGallery } from "./dev-gallery";

// Component review (C1–C12) and demo controls. Not part of the product; no login needed.
export default function DevPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 pb-24">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Link href="/login" className="-ml-2 flex min-h-12 items-center gap-1 px-2 text-primary">
          <ChevronLeft size={22} aria-hidden />
          <Bi id="login.title" />
        </Link>
        <LangOrderToggle />
      </div>
      <h1 className="text-2xl font-semibold">
        <Bi id="dev.title" />
      </h1>
      <DevGallery />
    </main>
  );
}
