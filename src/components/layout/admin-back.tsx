"use client";

import { usePathname } from "next/navigation";
import { BackLink } from "./back-link";

/** Where Back goes on an admin page opened directly: detail → its list, any other page → the dashboard. */
export function adminParent(path: string): string | null {
  if (path === "/admin" || path === "/admin/") return null;
  if (path.startsWith("/admin/slips/")) return "/admin/slips";
  if (path.startsWith("/admin/stock/")) return "/admin/stock";
  return "/admin";
}

/** Back on every admin page except the dashboard. Sits in the admin layout (inside <Suspense>). */
export function AdminBack() {
  const parent = adminParent(usePathname());
  if (!parent) return null;
  return <BackLink href={parent} className="mb-2 print:hidden" />;
}
