"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { Boxes, FileText, House, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { MsgId } from "@/lib/i18n";
import { Bi } from "./bi";
import { useCurrentFarm } from "./farm-gate";
import { LangOrderToggle } from "./lang-order-toggle";

type Tab = "home" | "slips" | "stock";

const tabs: { tab: Tab; href: string; label: MsgId; icon: LucideIcon }[] = [
  { tab: "home", href: "/farm", label: "nav.home", icon: House },
  { tab: "slips", href: "/farm/slips", label: "nav.slips", icon: FileText },
  { tab: "stock", href: "/farm/stock", label: "nav.stock", icon: Boxes },
];

/** Farm User frame for Home, Slips and Stock: top bar + nav (bottom on phone, top from 640px). */
export function FarmShell({ active, children }: { active?: Tab; children: ReactNode }) {
  const { farm, userName } = useCurrentFarm();
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <div>
            <div className="font-semibold">{farm.name}</div>
            <div className="text-sm text-muted">{userName}</div>
          </div>
          <LangOrderToggle />
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface sm:static sm:border-t-0">
          <ul className="mx-auto flex max-w-3xl">
            {tabs.map(({ tab, href, label, icon: Icon }) => (
              <li key={tab} className="flex-1 sm:flex-none">
                <Link
                  href={href}
                  aria-current={active === tab ? "page" : undefined}
                  className={clsx(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 px-4 text-sm sm:flex-row sm:gap-2",
                    active === tab ? "font-semibold text-primary sm:border-b-2 sm:border-primary" : "text-muted",
                  )}
                >
                  <Icon size={22} aria-hidden />
                  <Bi id={label} className="items-center sm:items-start" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-4 pb-32 sm:pb-12">{children}</main>
    </>
  );
}
