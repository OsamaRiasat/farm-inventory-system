# T06 — Excel export: formatted .xlsx, items grouped by category

**Tracker:** T06 · **Priority:** Normal
**Decision (developer, 28 Nov 2026):** Excel downloads become real, formatted `.xlsx` files (today: CSV from `src/lib/export.ts`). In the stock report, items are **grouped by category**: each group starts with one row holding the category name, **cells merged across the whole row**, then that category's items — **no Category column**. Scope: farm stock report (Home + Stock screen), stock card, and wiring the Admin reports' Excel button (disabled today).

## Today
- `src/lib/export.ts` → `downloadCsv(name, rows)` (UTF-8 BOM CSV).
- `exportStock` in `src/features/farm/farm-stock.tsx` (used by F8 and `HomeExport` in `src/app/(farm)/farm/home-tools.tsx`): columns Item No., Item, Item (Urdu), Category, In stock, Unit.
- Stock card CSV in `src/features/stock-card/stock-card.tsx` (~line 55).
- Admin reports `src/features/admin/reports.tsx` ~line 115: disabled Excel button; data is `ReportResult` (`src/lib/api/types.ts`: columns, rows, totals).

## Change
1. Add **`exceljs`** (pin an exact version; `npm install --cache /tmp/npm-cache` if the npm cache errors). Load it with `await import("exceljs")` inside the click handler so it never lands in page bundles. Check the Next 16 docs in `node_modules/next/dist/docs/` if bundling complains.
2. `src/lib/export.ts`: `downloadXlsx(fileName, build: (wb: Workbook) => void)` + small helpers: title block (bold, larger), header row (bold, light fill, bottom border, frozen), thin borders, column widths, number format `#,##0.###` right-aligned, Urdu column right-aligned (`readingOrder: "rtl"`, font "Noto Nastaliq Urdu"), sheet print setup (A4, fit to width, repeat header row).
3. **Stock report** (`exportStock`):
   - Rows 1–2: farm name + "Stock on <date>" (merged across).
   - Header: `Item No. | Item | Item (Urdu) | In stock | Unit`.
   - Categories A–Z; per category one row, `mergeCells` across A:E, bold, shaded; then items by name.
   - Export exactly what the screen shows (current search / category / show-zero filter), as now.
4. **Stock card**: header block (item, Urdu name, unit, from–to), table `Date | No. | Type | In | Out | In stock`, opening row, bold total row. Bags column only if T03 has landed.
5. **Admin reports**: enable the button; `ReportResult` → header from `columns`, `rows`, bold `totals`. If a report has a category column, group it like the stock report. File name = report title + filters + date.
6. Remove `downloadCsv` when nothing uses it. Keep `takePrintFlag`.
7. Update the decision in `docs/progress.md` ("Excel export = CSV …" → superseded) and `docs/kb/06-states-and-print.md` if it mentions CSV.

## Tests
- Playwright: click Excel on F8 → `page.waitForEvent("download")` → open the file with exceljs in the test: has merged ranges for category rows, no "Category" header, item row count = rows on screen, a known item's stock matches.
- Stock card and one admin report download and open.

## Done when
Lint + e2e green; the developer opened a file in Excel (or Numbers) and the layout looks right — note it in the tracker `verify`.
