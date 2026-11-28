"use client";

import type { Workbook, Worksheet } from "exceljs";

// Excel export: a real, formatted .xlsx built in the browser. exceljs is loaded on click only,
// so it never lands in a page's bundle.

export type XlsxCell = string | number | null | undefined;

export type XlsxColumn = {
  header: string;
  /** Excel column width in characters. */
  width: number;
  /** qty: number, thousands separators, right-aligned. urdu: right-to-left, Nastaliq font. */
  kind?: "text" | "qty" | "urdu";
};

/** A data row, a category row (one merged cell across the table), or a bold total row. */
export type XlsxRow = XlsxCell[] | { group: string } | { total: XlsxCell[] };

export type XlsxTable = {
  /** Lines above the table: the first is the title (bold, larger), the rest smaller. */
  title: string[];
  columns: XlsxColumn[];
  rows: XlsxRow[];
};

const BORDER = { style: "thin", color: { argb: "FF9CA3AF" } } as const;
const STRONG = { style: "medium", color: { argb: "FF374151" } } as const;
const BOX = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } } as const;
const GROUP_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } } as const;
const URDU_FONT = "Noto Nastaliq Urdu";

/** Whole numbers without a trailing dot, decimals up to 3 places (KG / LTR). */
const numFmt = (n: number) => (Number.isInteger(n) ? "#,##0" : "#,##0.###");

/** Builds a workbook and downloads it as `<fileName>.xlsx`. */
export async function downloadXlsx(fileName: string, build: (wb: Workbook) => void) {
  const mod = await import("exceljs");
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = "AW Farms Inventory";
  wb.created = new Date();
  build(wb);
  const data = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName.replace(/[^\w.-]+/g, "-")}.xlsx`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One sheet holding a titled table: header row frozen and repeated on every printed page, A4, fit to width. */
export function addTableSheet(wb: Workbook, name: string, table: XlsxTable): Worksheet {
  const { columns } = table;
  const n = columns.length;
  const ws = wb.addWorksheet(name.replace(/[*?:\\/[\]]/g, " ").slice(0, 31));
  ws.columns = columns.map((c) => ({ width: c.width }));

  table.title.forEach((line, i) => {
    const row = ws.addRow([line]);
    ws.mergeCells(row.number, 1, row.number, n);
    row.getCell(1).font = i === 0 ? { bold: true, size: 14 } : { size: 11 };
  });
  if (table.title.length) ws.addRow([]);

  const header = ws.addRow(columns.map((c) => c.header));
  header.eachCell((cell, i) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.border = { ...BOX, bottom: STRONG };
    cell.alignment = { vertical: "middle", horizontal: columns[i - 1]?.kind === "qty" ? "right" : "left", wrapText: true };
  });
  ws.views = [{ state: "frozen", ySplit: header.number }];

  for (const r of table.rows) {
    if (!Array.isArray(r) && "group" in r) {
      const row = ws.addRow([r.group]);
      ws.mergeCells(row.number, 1, row.number, n);
      const cell = row.getCell(1);
      cell.font = { bold: true };
      cell.fill = GROUP_FILL;
      cell.border = BOX;
      continue;
    }
    const total = !Array.isArray(r);
    const values = total ? r.total : r;
    const row = ws.addRow(values.map((v) => v ?? ""));
    // Nastaliq is tall: Excel doesn't grow the row for it, so give Urdu rows room.
    if (columns.some((c, i) => c.kind === "urdu" && values[i])) row.height = 24;
    for (let i = 1; i <= n; i++) {
      const cell = row.getCell(i);
      const kind = columns[i - 1]?.kind ?? "text";
      cell.border = total ? { ...BOX, top: STRONG } : BOX;
      cell.alignment = { vertical: "middle" };
      if (kind === "qty") {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        if (typeof cell.value === "number") cell.numFmt = numFmt(cell.value);
      } else if (kind === "urdu") {
        cell.alignment = { vertical: "middle", horizontal: "right", readingOrder: "rtl" };
        cell.font = { name: URDU_FONT };
      }
      if (total) cell.font = { ...cell.font, bold: true };
    }
  }

  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    printTitlesRow: `${header.number}:${header.number}`,
  };
  return ws;
}

/** Category rows A–Z, each followed by its rows (kept in the order given). */
export function groupByCategory<T>(rows: T[], categoryOf: (row: T) => string, toCells: (row: T) => XlsxCell[]): XlsxRow[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const c = categoryOf(row) || "—";
    const list = groups.get(c);
    if (list) list.push(row);
    else groups.set(c, [row]);
  }
  return [...groups.keys()]
    .sort((a, b) => a.localeCompare(b))
    .flatMap((c) => [{ group: c }, ...groups.get(c)!.map(toCells)]);
}

/** "Opened with ?print=1": print once the page's data has loaded, then drop the flag. */
export function takePrintFlag() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("print") !== "1") return false;
  url.searchParams.delete("print");
  window.history.replaceState(window.history.state, "", url);
  return true;
}
