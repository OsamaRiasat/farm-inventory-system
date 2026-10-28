"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useState } from "react";
import { useAdminFarm } from "@/components/layout/admin-farm-filter";
import { Bi } from "@/components/layout/bi";
import { StatusChip, type Status } from "@/components/layout/status-chip";
import { TypeChip } from "@/components/layout/type-chip";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FilterBar, type Filters } from "@/components/ui/filter-bar";
import { LineChart } from "@/components/ui/line-chart";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import type { ReportColumn, ReportRow, ReportType } from "@/lib/api";
import { useFarms, useItemMap, useReport } from "@/lib/api/queries";
import { addDays, fmtDate, fmtStamp, today } from "@/lib/dates";
import { fmtQty } from "@/lib/format";
import { t, tInline, type MsgId } from "@/lib/i18n";
import type { SlipType } from "@/types/domain";
import { REPORTS } from "./report-list";


/** Which filters each report uses (the farm always comes from the top bar). */
const FIELDS: Record<ReportType, ("dates" | "item" | "type" | "category")[]> = {
  "stock-on-hand": ["category", "item"],
  "item-stock-card": ["item", "dates"],
  consumption: ["dates", "category", "item"],
  "feed-mortality": ["dates"],
  "gate-register": ["dates", "type", "item"],
  transfers: ["dates"],
  "out-for-repair": ["dates", "item"],
  corrections: ["dates"],
};

/** A7 — one page per report: same filter bar, a table, Print / PDF (Excel comes later). */
export function Reports({ type }: { type: ReportType }) {
  const router = useRouter();
  const farmId = useAdminFarm();
  const farms = useFarms().data ?? [];
  const items = useItemMap();
  const [filters, setFilters] = useState<Filters>(() => ({ from: addDays(today(), -14), to: today() }));
  const report = useReport(type, { ...filters, farmId: farmId || undefined });
  const fields = FIELDS[type];
  const usesDates = fields.includes("dates");

  function cell(col: ReportColumn, row: ReportRow) {
    const v = row[col.key];
    if (v === null || v === undefined || v === "") return "";
    switch (col.kind) {
      case "qty":
        return typeof v === "number" ? fmtQty(v) : v;
      case "date":
        return <span className="num whitespace-nowrap">{fmtDate(String(v))}</span>;
      case "stamp":
        return <span className="num whitespace-nowrap">{fmtStamp(String(v))}</span>;
      case "slip":
        return (
          <Link className="num whitespace-nowrap text-primary underline" href={`/admin/slips/${encodeURIComponent(String(v))}`} onClick={(e) => e.stopPropagation()}>
            {v}
          </Link>
        );
      case "type":
        return <TypeChip type={v as SlipType} />;
      case "status":
        return <StatusChip status={v as Status} />;
      case "action":
        return <Bi id={`audit.${v}` as MsgId} inline />;
      case "farm":
        return <span className="whitespace-nowrap">{farms.find((f) => f.id === v)?.code ?? v}</span>;
      case "item":
        return items.get(String(v))?.name ?? v;
      case "unit":
        return t(`unit.${v}` as MsgId).en;
      default:
        return <span dir="auto">{v}</span>;
    }
  }

  const columns: Column<ReportRow>[] = (report.data?.columns ?? []).map((col) => ({
    key: col.key,
    header: <Bi id={col.label} />,
    cell: (row) => cell(col, row),
    sortValue: (row) => (row[col.key] ?? "") as string | number,
    align: col.kind === "qty" ? "right" : undefined,
  }));

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold print:hidden">
        <Bi id="nav.reports" />
      </h1>
      <nav className="flex flex-wrap gap-2 print:hidden" aria-label={tInline("nav.reports")}>
        {REPORTS.map((r) => (
          <Link
            key={r}
            href={`/admin/reports/${r}`}
            aria-current={r === type ? "page" : undefined}
            className={clsx("btn min-h-10", r === type && "border-primary bg-primary-soft font-semibold text-primary")}
          >
            <Bi id={`report.${r}`} inline />
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-start gap-3 print:hidden">
        <div className="flex-1">
          <FilterBar value={filters} onChange={setFilters} fields={fields} />
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={() => window.print()}>
            <Printer size={18} aria-hidden />
            <Bi id="rep.printPdf" inline />
          </button>
          <button type="button" className="btn" disabled title={tInline("rep.excel")}>
            <FileSpreadsheet size={18} aria-hidden />
            <Bi id="rep.excel" inline />
          </button>
        </div>
      </div>

      <section className="print-area flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          <Bi id={`report.${type}`} inline />
          <span className="ml-2 text-sm font-normal text-muted">
            {farms.find((f) => f.id === farmId)?.name ?? tInline("admin.allFarms")}
            {usesDates && filters.from && ` · ${fmtDate(filters.from)} – ${fmtDate(filters.to ?? today())}`}
          </span>
        </h2>
        {report.isError ? (
          <LoadError onRetry={() => report.refetch()} />
        ) : !report.data ? (
          <SkeletonRows rows={8} />
        ) : report.data.note ? (
          <p className="card p-4 text-muted">
            <Bi id={report.data.note} />
          </p>
        ) : (
          <>
            {type === "feed-mortality" &&
              (report.data.series?.length ? (
                <LineChart series={report.data.series} label={tInline("rep.chartTitle")} />
              ) : (
                <p className="text-sm text-muted print:hidden">
                  <Bi id="rep.chartPickFarm" inline />
                </p>
              ))}
            {report.data.totals && (
              <p className="num flex flex-wrap gap-x-4 font-semibold">
                <Bi id="sis.total" inline />
                {report.data.columns
                  .filter((c) => report.data.totals?.[c.key] !== undefined)
                  .map((c) => (
                    <span key={c.key} className="flex gap-1">
                      <Bi id={c.label} inline /> {fmtQty(Number(report.data.totals?.[c.key]))}
                    </span>
                  ))}
              </p>
            )}
            <p className="text-sm text-muted print:hidden">
              <Bi id="rep.rows" values={{ n: report.data.rows.length }} inline />
            </p>
            <DataTable
              rows={report.data.rows}
              columns={columns}
              rowKey={(row) => JSON.stringify(row)}
              pageSize={100}
              maxHeight="none"
              onOpen={
                report.data.columns.some((c) => c.kind === "slip")
                  ? (row) => {
                      const slipCol = report.data!.columns.find((c) => c.kind === "slip")!;
                      const id = row[slipCol.key];
                      if (id) router.push(`/admin/slips/${encodeURIComponent(String(id))}`);
                    }
                  : undefined
              }
            />
          </>
        )}
      </section>
    </div>
  );
}
