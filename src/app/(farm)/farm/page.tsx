import Link from "next/link";
import { clsx } from "clsx";
import { Bi } from "@/components/layout/bi";
import { FarmShell } from "@/components/layout/farm-shell";
import { slipTypeStyle } from "@/components/layout/type-chip";
import type { SlipType } from "@/types/domain";
import { TodaySlips, WaitingToReceive } from "./home-lists";
import { HomeShortcuts } from "./home-shortcuts";

const slipButtons: { type: SlipType; href: string; key: string }[] = [
  { type: "IGP", href: "/farm/igp/new", key: "1" },
  { type: "OGP", href: "/farm/ogp/new", key: "2" },
  { type: "SIS", href: "/farm/sis/new", key: "3" },
];

// F1 — Farm home: three slip buttons, waiting to receive, today's slips.
export default function FarmHomePage() {
  return (
    <FarmShell active="home">
      <HomeShortcuts />

      <nav className="grid gap-3">
        {slipButtons.map(({ type, href, key }) => {
          const { icon: Icon, text, border } = slipTypeStyle[type];
          return (
            <Link
              key={type}
              href={href}
              className={clsx("card flex min-h-20 items-center gap-4 border-l-8 px-4 py-3", border)}
            >
              <Icon size={32} className={clsx("shrink-0", text)} aria-hidden />
              <Bi id={`slip.${type}`} className="flex-1 text-lg font-semibold" />
              <kbd className="hidden lg:inline">{key}</kbd>
            </Link>
          );
        })}
      </nav>
      <p className="mt-2 hidden text-sm text-muted lg:block">
        <Bi id="home.keys" inline />
      </p>

      <WaitingToReceive />
      <TodaySlips />
    </FarmShell>
  );
}
