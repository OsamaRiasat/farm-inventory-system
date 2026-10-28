"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminFarm } from "@/components/layout/admin-farm-filter";
import { Bi } from "@/components/layout/bi";
import { DataTable, type Column } from "@/components/ui/data-table";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { useAudit, useFarms } from "@/lib/api/queries";
import { fmtStamp } from "@/lib/dates";
import { tInline } from "@/lib/i18n";
import type { AuditEntry } from "@/types/domain";

/** A11 — who did what, when, old → new, reason. Read-only: nobody can edit or remove the log. */
export function AuditLog() {
  const farmId = useAdminFarm();
  const audit = useAudit({ farmId: farmId || undefined });
  const farms = useFarms().data ?? [];
  const [user, setUser] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  if (audit.isError) return <LoadError onRetry={() => audit.refetch()} />;
  const users = [...new Set((audit.data ?? []).map((a) => a.user))].sort();
  const rows = (audit.data ?? []).filter((a) => (!user || a.user === user) && (!from || a.at.slice(0, 10) >= from) && (!to || a.at.slice(0, 10) <= to));
  const isSlip = (a: AuditEntry) => ["save", "receive", "correct", "cancel", "request_correction", "reject_correction"].includes(a.action);

  const columns: Column<AuditEntry>[] = [
    { key: "at", header: <Bi id="rep.when" />, cell: (a) => <span className="num whitespace-nowrap">{fmtStamp(a.at)}</span>, sortValue: (a) => a.at },
    { key: "user", header: <Bi id="audit.user" />, cell: (a) => <span className="whitespace-nowrap">{a.user}</span>, sortValue: (a) => a.user },
    { key: "farm", header: <Bi id="col.farm" />, cell: (a) => farms.find((f) => f.id === a.farmId)?.code ?? "—", sortValue: (a) => a.farmId ?? "" },
    { key: "action", header: <Bi id="rep.what" />, cell: (a) => <Bi id={`audit.${a.action}`} inline />, sortValue: (a) => a.action },
    {
      key: "record",
      header: <Bi id="audit.record" />,
      cell: (a) =>
        isSlip(a) ? (
          <Link className="num whitespace-nowrap text-primary underline" href={`/admin/slips/${encodeURIComponent(a.recordId)}`} onClick={(e) => e.stopPropagation()}>
            {a.recordNo}
          </Link>
        ) : (
          <span className="num whitespace-nowrap">{a.recordNo}</span>
        ),
      sortValue: (a) => a.recordNo,
    },
    { key: "change", header: <Bi id="rep.change" />, cell: (a) => (a.old || a.new ? <span className="num">{`${a.old ?? ""} → ${a.new ?? ""}`}</span> : "") },
    { key: "reason", header: <Bi id="detail.reason" />, cell: (a) => <span dir="auto">{a.reason}</span> },
  ];

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">
        <Bi id="nav.audit" />
      </h1>
      <p className="text-sm text-muted">
        <Bi id="audit.readOnly" inline />
      </p>
      <div className="card flex flex-wrap items-end gap-3 p-3 text-sm">
        <label className="flex w-56 flex-col gap-1">
          <Bi id="audit.user" />
          <select className="input min-h-10" value={user} onChange={(e) => setUser(e.target.value)}>
            <option value="">{tInline("audit.allUsers")}</option>
            {users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <Bi id="filter.from" />
          <input type="date" className="input num min-h-10" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <Bi id="filter.to" />
          <input type="date" className="input num min-h-10" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {!audit.data ? <SkeletonRows rows={8} /> : <DataTable rows={rows} columns={columns} rowKey={(a) => a.id} initialSort={{ key: "at", dir: "desc" }} />}
    </div>
  );
}
