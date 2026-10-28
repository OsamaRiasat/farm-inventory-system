"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminFarm } from "@/components/layout/admin-farm-filter";
import { Bi } from "@/components/layout/bi";
import { StatusChip } from "@/components/layout/status-chip";
import { DataTable, type Column } from "@/components/ui/data-table";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { api, ApiError, type TransferView } from "@/lib/api";
import { useApiMutation, useFarms, useItemMap, useTransfers } from "@/lib/api/queries";
import { daysBetween, fmtDate, today } from "@/lib/dates";
import { fmtQty } from "@/lib/format";
import { tInline, type MsgId } from "@/lib/i18n";
import type { Transfer } from "@/types/domain";

const sent = (v: TransferView) => v.ogp.lines.reduce((n, l) => n + l.qty, 0);
const received = (v: TransferView) => v.igp?.lines.reduce((n, l) => n + l.qtyReceived, 0) ?? null;
const shortfall = (v: TransferView) => {
  const r = received(v);
  return r === null ? 0 : sent(v) - r;
};
/** In transit: days since sent. Otherwise: days it took. */
const age = (v: TransferView) => daysBetween(v.transfer.sentAt.slice(0, 10), v.transfer.receivedAt?.slice(0, 10) ?? today());

/** A5 — every OGP between farms with status and shortfall. A row opens sent vs received, with Resolve for shortfalls. */
export function Transfers() {
  const farmId = useAdminFarm();
  const transfers = useTransfers({ farmId: farmId || undefined });
  const farms = useFarms().data ?? [];
  const [status, setStatus] = useState<Transfer["status"] | "">("");
  const [openId, setOpenId] = useState<string | null>(null);
  const code = (id: string) => farms.find((f) => f.id === id)?.code ?? id;

  const columns: Column<TransferView>[] = [
    { key: "ogp", header: <Bi id="transfer.ogpNo" />, cell: (v) => <span className="num font-medium whitespace-nowrap">{v.ogp.no}</span>, sortValue: (v) => v.ogp.no },
    { key: "from", header: <Bi id="transfer.fromFarm" />, cell: (v) => code(v.transfer.fromFarmId), sortValue: (v) => code(v.transfer.fromFarmId) },
    { key: "to", header: <Bi id="rep.toFarm" />, cell: (v) => code(v.transfer.toFarmId), sortValue: (v) => code(v.transfer.toFarmId) },
    { key: "sentAt", header: <Bi id="transfer.dateSent" />, cell: (v) => <span className="num whitespace-nowrap">{fmtDate(v.ogp.date)}</span>, sortValue: (v) => v.transfer.sentAt },
    { key: "sent", header: <Bi id="rep.sent" />, cell: (v) => fmtQty(sent(v)), sortValue: sent, align: "right" },
    { key: "received", header: <Bi id="rep.received" />, cell: (v) => (received(v) === null ? "—" : fmtQty(received(v)!)), sortValue: (v) => received(v) ?? -1, align: "right" },
    {
      key: "status",
      header: <Bi id="col.status" />,
      cell: (v) => (
        <span className="flex flex-col items-start gap-1">
          <StatusChip status={v.transfer.status} />
          {v.transfer.resolution && (
            <span className="text-xs text-muted">
              <Bi id="transfers.writtenOff" values={{ reason: v.transfer.resolution.reason }} inline />
            </span>
          )}
        </span>
      ),
      sortValue: (v) => v.transfer.status,
    },
    { key: "short", header: <Bi id="rep.short" />, cell: (v) => (shortfall(v) ? <strong className="text-warning">{fmtQty(shortfall(v))}</strong> : ""), sortValue: shortfall, align: "right" },
    {
      key: "age",
      header: <Bi id="transfers.age" />,
      cell: (v) => <span className={v.transfer.status === "in_transit" && age(v) > 2 ? "font-semibold text-warning" : undefined}>{age(v)}</span>,
      sortValue: age,
      align: "right",
    },
  ];

  if (transfers.isError) return <LoadError onRetry={() => transfers.refetch()} />;
  const rows = (transfers.data ?? []).filter((v) => !status || v.transfer.status === status);
  const open = rows.find((v) => v.transfer.id === openId);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">
        <Bi id="nav.transfers" />
      </h1>
      <div className="card flex flex-wrap items-end gap-3 p-3 text-sm">
        <label className="flex w-48 flex-col gap-1">
          <Bi id="filter.status" />
          <select className="input min-h-10" value={status} onChange={(e) => setStatus(e.target.value as Transfer["status"] | "")}>
            <option value="">{tInline("filter.allStatuses")}</option>
            {(["in_transit", "received", "short", "cancelled"] as const).map((s) => (
              <option key={s} value={s}>
                {tInline(`status.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!transfers.data ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="grid gap-4 2xl:grid-cols-[1fr_28rem]">
          <DataTable rows={rows} columns={columns} rowKey={(v) => v.transfer.id} onOpen={(v) => setOpenId(v.transfer.id)} initialSort={{ key: "sentAt", dir: "desc" }} />
          {open ? (
            <TransferDetail view={open} />
          ) : (
            <p className="card p-4 text-sm text-muted">
              <Bi id="transfers.pick" />
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TransferDetail({ view }: { view: TransferView }) {
  const items = useItemMap();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<MsgId | null>(null);
  const resolve = useApiMutation(api.resolveShortfall);
  const { transfer, ogp, igp } = view;
  const canResolve = transfer.status === "short" && !transfer.resolution;

  return (
    <section className="card flex flex-col gap-3 p-4" aria-live="polite">
      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="text-primary underline" href={`/admin/slips/${encodeURIComponent(ogp.id)}`}>
          <Bi id="transfers.ogp" inline /> {ogp.no}
        </Link>
        {igp ? (
          <Link className="text-primary underline" href={`/admin/slips/${encodeURIComponent(igp.id)}`}>
            <Bi id="transfers.igp" inline /> {igp.no}
          </Link>
        ) : (
          <span className="text-muted">
            <Bi id="transfers.notReceived" inline />
          </span>
        )}
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>
              <Bi id="line.item" />
            </th>
            <th className="text-right">
              <Bi id="rep.sent" />
            </th>
            <th className="text-right">
              <Bi id="rep.received" />
            </th>
            <th className="text-right">
              <Bi id="rep.short" />
            </th>
          </tr>
        </thead>
        <tbody>
          {ogp.lines.map((l, i) => {
            const got = igp?.lines[i]?.qtyReceived;
            const short = got === undefined ? 0 : l.qty - got;
            return (
              <tr key={i} className={short > 0 ? "bg-warning-bg" : undefined}>
                <td>{items.get(l.itemId)?.name}</td>
                <td className="num text-right">{fmtQty(l.qty)}</td>
                <td className="num text-right">{got === undefined ? "—" : fmtQty(got)}</td>
                <td className="num text-right font-semibold text-warning">{short > 0 ? fmtQty(short) : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {canResolve && (
        <form
          className="flex flex-col gap-2 border-t border-line pt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!reason.trim()) return setError("err.enterReason");
            try {
              await resolve.mutateAsync({ transferId: transfer.id, reason, by: "Accounts Admin" });
              setReason("");
            } catch (err) {
              setError(err instanceof ApiError ? err.id : "err.notSaved");
            }
          }}
        >
          <p className="text-sm text-muted">
            <Bi id="transfers.resolveHint" />
          </p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            <Bi id="detail.reason" />
            <input
              dir="auto"
              className="input"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              <Bi id={error} inline />
            </p>
          )}
          <button type="submit" className="btn btn-primary self-start" disabled={resolve.isPending}>
            <Bi id="transfers.resolve" inline />
          </button>
        </form>
      )}
      {transfer.resolution && (
        <p className="text-sm text-muted">
          <Bi id="transfers.writtenOff" values={{ reason: transfer.resolution.reason }} inline />
        </p>
      )}
    </section>
  );
}
