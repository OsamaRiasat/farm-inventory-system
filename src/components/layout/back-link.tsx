"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ChevronLeft } from "lucide-react";
import { requestLeave } from "@/lib/leave-guard";
import { goBack } from "@/lib/nav-history";
import { Bi } from "./bi";

/**
 * Back on every screen except the two home pages: returns to the page you came from
 * (asks "Leave without saving?" first on a slip with typed data). Opened from a link or bookmark → `href`.
 */
export function BackLink({ href, className }: { href: string; className?: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      data-back
      className={clsx("-ml-2 flex min-h-12 w-fit items-center gap-1 px-2 text-primary", className)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        requestLeave(() => goBack(router, href));
      }}
    >
      <ChevronLeft size={22} aria-hidden />
      <Bi id="nav.back" />
    </Link>
  );
}
