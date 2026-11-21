"use client";

import { clsx } from "clsx";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { Bi } from "@/components/layout/bi";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { useApiMutation, useFarms, useUsers } from "@/lib/api/queries";
import { tInline, type MsgId } from "@/lib/i18n";
import type { Farm } from "@/types/domain";
import { ResetOnHide } from "@/lib/on-hide";

const BY = "Accounts Admin";
const TYPES: Farm["type"][] = ["breeder", "layer", "hatchery"];

/** A8 — farms with their Farm User. Rename, change type, deactivate; nothing is ever deleted.
 *  Sheds are hidden for now (not handled separately yet); the API (`addShed`/`updateShed`) stays. */
export function FarmsSetup() {
  const farms = useFarms();
  const users = useUsers().data ?? [];

  if (farms.isError) return <LoadError onRetry={() => farms.refetch()} />;
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">
        <Bi id="nav.farmsSheds" />
      </h1>
      <p className="text-sm text-muted">
        <Bi id="farms.neverDeleted" inline />
      </p>
      {!farms.data ? (
        <SkeletonRows rows={6} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {farms.data.map((f) => (
            <li key={f.id}>
              <ResetOnHide>
                <FarmCard farm={f} userName={users.find((u) => u.farmId === f.id)?.name} />
              </ResetOnHide>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FarmCard({ farm, userName }: { farm: Farm; userName?: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(farm.name);
  const [type, setType] = useState(farm.type);
  const [active, setActive] = useState(farm.active);
  const [error, setError] = useState<MsgId | null>(null);
  const update = useApiMutation(api.updateFarm);

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.id : "err.notSaved");

  return (
    <section className={clsx("card flex flex-col gap-3 p-4", !farm.active && "opacity-70")}>
      {editing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await update.mutateAsync({ id: farm.id, name, type, active, by: BY });
              setEditing(false);
              setError(null);
            } catch (err) {
              fail(err);
            }
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-medium">
            <Bi id="farms.name" />
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            <Bi id="farms.type" />
            <select className="input" value={type} onChange={(e) => setType(e.target.value as Farm["type"])}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {tInline(`farms.${t}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" className="size-5" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <Bi id="farms.active" inline />
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={() => setEditing(false)}>
              <Bi id="common.close" inline />
            </button>
            <button type="submit" className="btn btn-primary" disabled={update.isPending}>
              <Bi id="slip.save" inline />
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">{farm.name}</div>
            <div className="text-sm text-muted">
              <span className="num">{farm.code}</span> · <Bi id={`farms.${farm.type}`} inline /> ·{" "}
              <Bi id={farm.active ? "farms.active" : "farms.inactive"} inline />
            </div>
            {userName && (
              <div className="text-sm">
                <Bi id="login.farmUser" inline />: {userName}
              </div>
            )}
          </div>
          <button type="button" className="btn min-h-10" onClick={() => setEditing(true)}>
            <Pencil size={16} aria-hidden />
            <Bi id="farms.edit" inline />
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          <Bi id={error} inline />
        </p>
      )}
    </section>
  );
}
