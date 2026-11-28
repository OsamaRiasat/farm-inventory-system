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
import { addTableSheet, downloadXlsx, groupByCategory, type XlsxCell, type XlsxColumn, type XlsxRow } from "@/lib/export";
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
  "daily-reports": ["dates"],
};

/** Excel column width per cell kind. */
const WIDTH: Record<ReportColumn["kind"], number> = {
  text: 22, qty: 13, date: 12, stamp: 18, slip: 22, type: 7, status: 12, action: 18, farm: 12, item: 32, unit: 8,
};

/** A7 — one page per report: same filter bar, a table, Print / PDF and Excel (.xlsx). */
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

  /** A cell as Excel shows it: numbers stay numbers, the rest as on screen (English). */
  function excelCell(col: ReportColumn, row: ReportRow): XlsxCell {
    const v = row[col.key];
    if (v === null || v === undefined || v === "") return "";
    switch (col.kind) {
      case "qty":
        return typeof v === "number" ? v : String(v);
      case "date":
        return fmtDate(String(v));
      case "stamp":
        return fmtStamp(String(v));
      case "status":
        return t(`status.${v}` as MsgId).en;
      case "action":
        return t(`audit.${v}` as MsgId).en;
      case "farm":
        return farms.find((f) => f.id === v)?.code ?? String(v);
      case "item":
        return items.get(String(v))?.name ?? String(v);
      case "unit":
        return t(`unit.${v}` as MsgId).en;
      default:
        return String(v);
    }
  }

  function exportExcel() {
    const data = report.data;
    if (!data || data.note) return;
    const title = t(`report.${type}`).en;
    const farmName = farms.find((f) => f.id === farmId)?.name ?? "All farms";
    const range = usesDates && filters.from ? `${fmtDate(filters.from)} – ${fmtDate(filters.to ?? today())}` : "";
    // A report with a category column is grouped like the stock report: merged category rows, no Category column.
    const grouped = data.columns.some((c) => c.key === "category");
    const cols = data.columns.filter((c) => !(grouped && c.key === "category"));
    const cells = (row: ReportRow) => cols.map((c) => excelCell(c, row));
    const rows: XlsxRow[] = grouped ? groupByCategory(data.rows, (r) => String(r.category ?? ""), cells) : data.rows.map(cells);
    if (data.totals) {
      rows.push({ total: cols.map((c, i) => (data.totals?.[c.key] !== undefined ? excelCell(c, data.totals) : i === 0 ? "Total" : "")) });
    }
    const columns: XlsxColumn[] = cols.map((c) => ({ header: t(c.label).en, width: WIDTH[c.kind], kind: c.kind === "qty" ? "qty" : "text" }));
    const filtersText = [filters.category, filters.itemId && items.get(filters.itemId)?.name, filters.type].filter(Boolean).join(" · ");
    void downloadXlsx([title, farmName, filtersText, filters.from && usesDates ? `${filters.from} to ${filters.to ?? today()}` : today()].filter(Boolean).join(" "), (wb) =>
      addTableSheet(wb, title, {
        title: [title, [farmName, range, filtersText].filter(Boolean).join(" · ")],
        columns,
        rows,
      }),
    );
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
          <button type="button" className="btn" disabled={!report.data || !!report.data.note} onClick={exportExcel}>
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
