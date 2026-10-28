"use client";

import { clsx } from "clsx";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Bi } from "@/components/layout/bi";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { useApiMutation, useFarms, useUsers } from "@/lib/api/queries";
import { tInline, type MsgId } from "@/lib/i18n";
import type { Farm, Shed } from "@/types/domain";

const BY = "Accounts Admin";
const TYPES: Farm["type"][] = ["breeder", "layer", "hatchery"];

/** A8 — farms with their Farm User and sheds. Add, rename, deactivate; nothing is ever deleted. */
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
              <FarmCard farm={f} userName={users.find((u) => u.farmId === f.id)?.name} />
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
  const [newShed, setNewShed] = useState("");
  const [error, setError] = useState<MsgId | null>(null);
  const update = useApiMutation(api.updateFarm);
  const add = useApiMutation(api.addShed);

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

      <div>
        <h3 className="mb-1 text-sm font-semibold">
          <Bi id="farms.sheds" inline />
        </h3>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {farm.sheds.map((s) => (
            <ShedRow key={s.id} shed={s} onError={setError} />
          ))}
        </ul>
        <form
          className="mt-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await add.mutateAsync({ farmId: farm.id, name: newShed, by: BY });
              setNewShed("");
              setError(null);
            } catch (err) {
              fail(err);
            }
          }}
        >
          <input className="input min-h-10" placeholder={tInline("farms.shedName")} aria-label={tInline("farms.shedName")} value={newShed} onChange={(e) => setNewShed(e.target.value)} />
          <button type="submit" className="btn min-h-10 shrink-0" disabled={add.isPending}>
            <Plus size={16} aria-hidden />
            <Bi id="farms.addShed" inline />
          </button>
        </form>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          <Bi id={error} inline />
        </p>
      )}
    </section>
  );
}

function ShedRow({ shed, onError }: { shed: Shed; onError: (id: MsgId | null) => void }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(shed.name);
  const update = useApiMutation(api.updateShed);

  async function save(next: { name: string; active: boolean }) {
    try {
      await update.mutateAsync({ id: shed.id, ...next, by: BY });
      setRenaming(false);
      onError(null);
    } catch (e) {
      onError(e instanceof ApiError ? e.id : "err.notSaved");
    }
  }

  return (
    <li className={clsx("flex items-center gap-2 px-3 py-1.5 text-sm", !shed.active && "text-muted")}>
      {renaming ? (
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save({ name, active: shed.active });
          }}
        >
          <input className="input min-h-10" value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label={tInline("farms.name")} />
          <button type="submit" className="btn min-h-10">
            <Bi id="slip.save" inline />
          </button>
        </form>
      ) : (
        <>
          <span className="flex-1">
            {shed.name}
            {!shed.active && (
              <span className="ml-2 text-xs">
                (<Bi id="farms.inactive" inline />)
              </span>
            )}
          </span>
          <button type="button" className="btn min-h-9 px-2 text-xs" onClick={() => setRenaming(true)}>
            <Bi id="farms.rename" inline />
          </button>
          <button type="button" className="btn min-h-9 px-2 text-xs" onClick={() => void save({ name: shed.name, active: !shed.active })}>
            <Bi id={shed.active ? "farms.deactivate" : "farms.activate"} inline />
          </button>
        </>
      )}
    </li>
  );
}
