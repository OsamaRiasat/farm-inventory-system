"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { LoadError, Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { useFarms } from "@/lib/api/queries";
import { useSession } from "@/lib/session";
import type { Farm } from "@/types/domain";
import { GlobalShortcuts } from "./global-shortcuts";

type CurrentFarm = { farm: Farm; userName: string };

const FarmContext = createContext<CurrentFarm | null>(null);

/** The signed-in Farm User's farm. Only valid below <FarmGate>. */
export function useCurrentFarm(): CurrentFarm {
  const value = useContext(FarmContext);
  if (!value) throw new Error("useCurrentFarm must be used inside <FarmGate>");
  return value;
}

/** Waits for the session and the farm list; sends anyone who isn't a Farm User to the login. */
export function FarmGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const farms = useFarms();
  const isFarm = session?.role === "farm";

  useEffect(() => {
    if (session === null || (session && session.role !== "farm")) router.replace("/login");
  }, [session, router]);

  if (farms.isError) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <LoadError onRetry={() => farms.refetch()} />
      </div>
    );
  }

  const farm = isFarm ? farms.data?.find((f) => f.id === session.farmId) : undefined;
  if (!isFarm || !farm) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
        <Skeleton className="h-12" />
        <SkeletonRows rows={4} />
      </div>
    );
  }

  return (
    <CurrentFarmProvider farm={farm} userName={session.userName}>
      <GlobalShortcuts area="farm" />
      {children}
    </CurrentFarmProvider>
  );
}

/** Provides a farm without the gate — for the component review page. */
export function CurrentFarmProvider({ farm, userName, children }: CurrentFarm & { children: ReactNode }) {
  return <FarmContext.Provider value={{ farm, userName }}>{children}</FarmContext.Provider>;
}
