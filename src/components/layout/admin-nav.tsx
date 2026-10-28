"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  Boxes,
  ChartColumn,
  FileText,
  LayoutDashboard,
  Package,
  PencilLine,
  ScrollText,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { tInline, type MsgId } from "@/lib/i18n";
import { Bi } from "./bi";

const links: { href: string; label: MsgId; icon: LucideIcon; group?: "setup" }[] = [
  { href: "/admin", label: "nav.dashboard", icon: LayoutDashboard },
  { href: "/admin/slips", label: "nav.slips", icon: FileText },
  { href: "/admin/stock", label: "nav.stock", icon: Boxes },
  { href: "/admin/transfers", label: "nav.transfers", icon: Truck },
  { href: "/admin/corrections", label: "nav.corrections", icon: PencilLine },
  { href: "/admin/reports/stock-on-hand", label: "nav.reports", icon: ChartColumn },
  { href: "/admin/setup/farms", label: "nav.farmsSheds", icon: Warehouse, group: "setup" },
  { href: "/admin/setup/items", label: "nav.items", icon: Package, group: "setup" },
  { href: "/admin/setup/users", label: "nav.users", icon: Users, group: "setup" },
  { href: "/admin/audit", label: "nav.audit", icon: ScrollText },
];

/** Admin sidebar; reads the URL for the active link. Wrap in <Suspense fallback={<AdminNavLinks />}>. */
export function AdminNav() {
  return <AdminNavLinks pathname={usePathname()} />;
}

/** Admin sidebar links; labels collapse to icons below 1024px. */
export function AdminNavLinks({ pathname }: { pathname?: string }) {
  const isActive = (href: string) =>
    pathname !== undefined &&
    (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href.replace(/\/stock-on-hand$/, "")));

  return (
    <ul className="flex flex-col gap-1">
      {links.map(({ href, label, icon: Icon, group }, i) => (
        <li key={href} className={clsx(group === "setup" && links[i - 1]?.group !== "setup" && "mt-4")}>
          <Link
            href={href}
            title={tInline(label)}
            aria-current={isActive(href) ? "page" : undefined}
            className={clsx(
              "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm",
              isActive(href) ? "bg-primary-soft font-semibold text-primary" : "text-ink hover:bg-surface-2",
            )}
          >
            <Icon size={22} className="shrink-0" aria-hidden />
            <Bi id={label} className="hidden lg:inline-flex" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
