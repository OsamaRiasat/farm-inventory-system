"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useSession } from "@/lib/session";
import { GlobalShortcuts } from "./global-shortcuts";

/** Sends anyone who isn't the Accounts Admin to the login. */
export function AdminGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session === null || (session && session.role !== "admin")) router.replace("/login");
  }, [session, router]);

  if (session?.role !== "admin") return <SkeletonRows rows={5} className="p-4" />;
  return (
    <>
      <GlobalShortcuts area="admin" />
      {children}
    </>
  );
}
