"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdminFarm } from "@/components/layout/admin-farm-filter";
import { Bi } from "@/components/layout/bi";
import { StatusChip } from "@/components/layout/status-chip";
import { TypeChip } from "@/components/layout/type-chip";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FilterBar, type Filters } from "@/components/ui/filter-bar";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { useFarms, useSlips } from "@/lib/api/queries";
import { fmtDate } from "@/lib/dates";
import { slipLineCount, slipParty } from "@/lib/slips";
import type { Slip } from "@/types/domain";

/** A2 — every slip from every farm (or the farm picked in the top bar), with filters. Rows open A3. */
export function AllSlips() {
  const router = useRouter();
  const farmId = useAdminFarm();
  const farms = useFarms().data ?? [];
  const [filters, setFilters] = useState<Filters>({});
  const slips = useSlips({ ...filters, farmId: farmId || undefined });

  const columns: Column<Slip>[] = [
    { key: "no", header: <Bi id="col.no" />, cell: (s) => <span className="num font-medium whitespace-nowrap">{s.no}</span>, sortValue: (s) => s.no },
    { key: "type", header: <Bi id="col.type" />, cell: (s) => <TypeChip type={s.type} />, sortValue: (s) => s.type },
    { key: "farm", header: <Bi id="col.farm" />, cell: (s) => <span className="whitespace-nowrap">{farms.find((f) => f.id === s.farmId)?.code}</span>, sortValue: (s) => s.farmId },
    {
      key: "date",
      header: <Bi id="slip.date" />,
      cell: (s) => (
        <span className="num whitespace-nowrap">
          {fmtDate(s.date)} {s.time}
        </span>
      ),
      sortValue: (s) => `${s.date}T${s.time}`,
    },
    { key: "party", header: <Bi id="rep.fromTo" />, cell: (s) => <span dir="auto">{slipParty(s, farms) || "—"}</span>, sortValue: (s) => slipParty(s, farms) },
    { key: "lines", header: <Bi id="rep.lines" />, cell: (s) => slipLineCount(s), sortValue: slipLineCount, align: "right" },
    { key: "by", header: <Bi id="slip.preparedBy" />, cell: (s) => <span className="whitespace-nowrap">{s.preparedBy}</span>, sortValue: (s) => s.preparedBy },
    { key: "status", header: <Bi id="col.status" />, cell: (s) => <StatusChip status={s.status} />, sortValue: (s) => s.status },
  ];

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">
        <Bi id="nav.slips" />
      </h1>
      <FilterBar value={filters} onChange={setFilters} fields={["no", "type", "dates", "item", "status"]} />
      {slips.isError ? (
        <LoadError onRetry={() => slips.refetch()} />
      ) : !slips.data ? (
        <SkeletonRows rows={8} />
      ) : (
        <>
          <p className="text-sm text-muted">
            <Bi id="rep.rows" values={{ n: slips.data.length }} inline />
          </p>
          <DataTable
            rows={slips.data}
            columns={columns}
            rowKey={(s) => s.id}
            onOpen={(s) => router.push(`/admin/slips/${encodeURIComponent(s.id)}`)}
            initialSort={{ key: "date", dir: "desc" }}
          />
        </>
      )}
    </div>
  );
}
