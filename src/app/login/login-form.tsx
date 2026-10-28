"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Bi } from "@/components/layout/bi";
import { FarmPicker } from "@/components/ui/farm-picker";
import { LoadError, Skeleton } from "@/components/ui/skeleton";
import { useFarms } from "@/lib/api/queries";
import { setSession } from "@/lib/session";

/** S1 — pick a role (and farm). Phase 1 only: no password. */
export function LoginForm() {
  const router = useRouter();
  const farms = useFarms();
  const [farmId, setFarmId] = useState("aw02");

  function enterFarm(e: FormEvent) {
    e.preventDefault();
    const farm = farms.data?.find((f) => f.id === farmId);
    if (!farm) return;
    setSession({ role: "farm", farmId: farm.id, userName: `${farm.code} Store Keeper` });
    router.push("/farm");
  }

  function enterAdmin() {
    setSession({ role: "admin", userName: "Accounts Admin" });
    router.push("/admin");
  }

  return (
    <>
      <form onSubmit={enterFarm} className="card flex flex-col gap-3 p-4">
        <h2 className="font-semibold">
          <Bi id="login.farmUser" />
        </h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          <Bi id="login.pickFarm" />
          {farms.isError ? (
            <LoadError onRetry={() => farms.refetch()} />
          ) : farms.data ? (
            <FarmPicker farms={farms.data} value={farmId} onChange={setFarmId} autoFocus />
          ) : (
            <Skeleton className="h-12" />
          )}
        </label>
        <button type="submit" className="btn btn-primary btn-lg" disabled={!farms.data}>
          <Bi id="login.enter" inline />
        </button>
      </form>

      <div className="card flex flex-col gap-3 p-4">
        <h2 className="font-semibold">
          <Bi id="login.admin" />
        </h2>
        <button type="button" className="btn btn-lg" onClick={enterAdmin}>
          <Bi id="login.enter" inline />
        </button>
      </div>
    </>
  );
}
