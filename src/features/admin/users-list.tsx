"use client";

import { Bi } from "@/components/layout/bi";
import { DataTable, type Column } from "@/components/ui/data-table";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { useFarms, useUsers } from "@/lib/api/queries";
import type { User } from "@/types/domain";

/** A10 — one Farm User per farm and the Accounts Admin. Phase 1: demo data, read-only. */
export function UsersList() {
  const users = useUsers();
  const farms = useFarms().data ?? [];

  const columns: Column<User>[] = [
    { key: "name", header: <Bi id="farms.name" />, cell: (u) => <span className="font-medium">{u.name}</span>, sortValue: (u) => u.name },
    { key: "phone", header: <Bi id="users.phone" />, cell: (u) => <span className="num">{u.phone}</span> },
    { key: "role", header: <Bi id="users.role" />, cell: (u) => <Bi id={u.role === "admin" ? "login.admin" : "login.farmUser"} inline />, sortValue: (u) => u.role },
    { key: "farm", header: <Bi id="col.farm" />, cell: (u) => farms.find((f) => f.id === u.farmId)?.name ?? "—", sortValue: (u) => u.farmId ?? "" },
    { key: "active", header: <Bi id="farms.active" />, cell: (u) => <Bi id={u.active ? "farms.active" : "farms.inactive"} inline /> },
  ];

  if (users.isError) return <LoadError onRetry={() => users.refetch()} />;
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">
        <Bi id="nav.users" />
      </h1>
      <p className="text-sm text-muted">
        <Bi id="users.note" inline />
      </p>
      {!users.data ? <SkeletonRows rows={6} /> : <DataTable rows={users.data} columns={columns} rowKey={(u) => u.id} />}
    </div>
  );
}
