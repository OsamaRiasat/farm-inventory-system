"use client";

import { clsx } from "clsx";
import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { Bi } from "@/components/layout/bi";
import { DataTable, type Column } from "@/components/ui/data-table";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { useApiMutation, useFarms, useUsers } from "@/lib/api/queries";
import { tInline, type MsgId } from "@/lib/i18n";
import { enterToNext } from "@/lib/keyboard/focus";
import { useSaveShortcut } from "@/lib/keyboard/use-shortcut";
import { useOnHide } from "@/lib/on-hide";
import type { Farm, User } from "@/types/domain";

type Draft = Omit<User, "id"> & { id?: string; password: string; confirm: string };

const toDraft = (u?: User): Draft =>
  u
    ? { ...u, password: "", confirm: "" }
    : { name: "", username: "", phone: "", role: "farm", farmId: "", active: true, password: "", confirm: "" };

/** A10 — every login: the Admin adds users, edits them and sets new passwords. Users are never deleted, only deactivated. */
export function UsersList() {
  const users = useUsers();
  const farms = useFarms().data ?? [];
  const [draft, setDraft] = useState<Draft | null>(null);
  useOnHide(() => setDraft(null));

  const columns: Column<User>[] = [
    { key: "name", header: <Bi id="farms.name" />, cell: (u) => <span className="font-medium">{u.name}</span>, sortValue: (u) => u.name },
    { key: "username", header: <Bi id="login.username" />, cell: (u) => <span className="num">{u.username}</span>, sortValue: (u) => u.username },
    { key: "phone", header: <Bi id="users.phone" />, cell: (u) => <span className="num">{u.phone}</span> },
    { key: "role", header: <Bi id="users.role" />, cell: (u) => <Bi id={u.role === "admin" ? "login.admin" : "login.farmUser"} inline />, sortValue: (u) => u.role },
    { key: "farm", header: <Bi id="col.farm" />, cell: (u) => farms.find((f) => f.id === u.farmId)?.name ?? "—", sortValue: (u) => u.farmId ?? "" },
    { key: "active", header: <Bi id="farms.active" />, cell: (u) => <Bi id={u.active ? "farms.active" : "farms.inactive"} inline />, sortValue: (u) => Number(u.active) },
  ];

  if (users.isError) return <LoadError onRetry={() => users.refetch()} />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          <Bi id="nav.users" />
        </h1>
        <button type="button" className="btn btn-primary" onClick={() => setDraft(toDraft())}>
          <Plus size={18} aria-hidden />
          <Bi id="users.add" inline />
        </button>
      </div>
      {!users.data ? (
        <SkeletonRows rows={6} />
      ) : (
        <DataTable rows={users.data} columns={columns} rowKey={(u) => u.id} onOpen={(u) => setDraft(toDraft(u))} />
      )}
      {draft && <UserDrawer key={draft.id ?? "new"} initial={draft} farms={farms} onClose={() => setDraft(null)} />}
    </div>
  );
}

function UserDrawer({ initial, farms, onClose }: { initial: Draft; farms: Farm[]; onClose: () => void }) {
  const titleId = useId();
  const [d, setD] = useState(initial);
  const [error, setError] = useState<MsgId | null>(null);
  const save = useApiMutation(api.saveUser);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const isNew = !d.id;

  async function submit() {
    if (save.isPending) return;
    if (isNew && d.password !== d.confirm) return setError("err.passwordMismatch");
    try {
      await save.mutateAsync({
        id: d.id,
        name: d.name,
        username: d.username,
        phone: d.phone,
        role: d.role,
        farmId: d.role === "farm" ? d.farmId : undefined,
        active: d.active,
        password: isNew ? d.password : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.id : "err.notSaved");
    }
  }
  useSaveShortcut(() => void submit());

  return (
    <aside
      role="dialog"
      aria-labelledby={titleId}
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col gap-3 overflow-y-auto border-l border-line bg-surface p-4 shadow-xl"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="flex items-center justify-between">
        <h2 id={titleId} className="text-lg font-semibold">
          <Bi id={isNew ? "users.add" : "users.edit"} />
        </h2>
        <button type="button" className="btn min-h-10" onClick={onClose} aria-label={tInline("common.close")}>
          <X size={18} aria-hidden />
        </button>
      </div>
      <form
        className="flex flex-col gap-3"
        onKeyDown={enterToNext}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          <Bi id="farms.name" />
          <input name="name" className="input" dir="auto" value={d.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          <Bi id="login.username" />
          <input
            name="username"
            className="input num"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            value={d.username}
            onChange={(e) => set({ username: e.target.value })}
          />
          <span className="text-xs font-normal text-muted">
            <Bi id="users.usernameHint" inline />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          <Bi id="users.phone" />
          <input name="phone" className="input num" type="tel" value={d.phone} onChange={(e) => set({ phone: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          <Bi id="users.role" />
          <select name="role" className="input" value={d.role} onChange={(e) => set({ role: e.target.value as User["role"] })}>
            <option value="farm">{tInline("login.farmUser")}</option>
            <option value="admin">{tInline("login.admin")}</option>
          </select>
        </label>
        {d.role === "farm" && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            <Bi id="col.farm" />
            <select name="farmId" className="input" value={d.farmId ?? ""} onChange={(e) => set({ farmId: e.target.value })}>
              <option value="">{tInline("users.pickFarm")}</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {isNew && <PasswordFields password={d.password} confirm={d.confirm} onChange={set} />}
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input name="active" type="checkbox" className="size-5" checked={d.active} onChange={(e) => set({ active: e.target.checked })} />
          <Bi id="farms.active" inline />
        </label>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            <Bi id={error} inline />
          </p>
        )}
        <button type="submit" className="btn btn-primary" data-save disabled={save.isPending}>
          <Bi id="slip.save" inline />
        </button>
      </form>
      {!isNew && <SetPassword userId={d.id!} />}
    </aside>
  );
}

function PasswordFields({
  password,
  confirm,
  onChange,
}: {
  password: string;
  confirm: string;
  onChange: (p: { password?: string; confirm?: string }) => void;
}) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm font-medium">
        <Bi id="login.password" />
        <input
          name="password"
          type="password"
          className="input"
          autoComplete="new-password"
          value={password}
          onChange={(e) => onChange({ password: e.target.value })}
        />
        <span className="text-xs font-normal text-muted">
          <Bi id="users.passwordHint" inline />
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        <Bi id="users.confirm" />
        <input
          name="confirm"
          type="password"
          className="input"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => onChange({ confirm: e.target.value })}
        />
      </label>
    </>
  );
}

/** Its own form and button, so editing a user's details never touches the password. */
function SetPassword({ userId }: { userId: string }) {
  const [p, setP] = useState({ password: "", confirm: "" });
  const [msg, setMsg] = useState<{ ok: boolean; id: MsgId } | null>(null);
  const change = useApiMutation(api.setUserPassword);

  return (
    <form
      className="flex flex-col gap-3 border-t border-line pt-3"
      data-set-password
      noValidate
      onKeyDown={enterToNext}
      onSubmit={async (e) => {
        e.preventDefault();
        if (p.password !== p.confirm) return setMsg({ ok: false, id: "err.passwordMismatch" });
        try {
          await change.mutateAsync({ id: userId, password: p.password });
          setP({ password: "", confirm: "" });
          setMsg({ ok: true, id: "users.passwordSet" });
        } catch (err) {
          setMsg({ ok: false, id: err instanceof ApiError ? err.id : "err.notSaved" });
        }
      }}
    >
      <h3 className="font-semibold">
        <Bi id="users.setPassword" />
      </h3>
      <PasswordFields password={p.password} confirm={p.confirm} onChange={(x) => setP((v) => ({ ...v, ...x }))} />
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={clsx("text-sm font-medium", !msg.ok && "text-danger")}>
          <Bi id={msg.id} inline />
        </p>
      )}
      <button type="submit" className="btn" disabled={change.isPending}>
        <Bi id="users.setPassword" inline />
      </button>
    </form>
  );
}
