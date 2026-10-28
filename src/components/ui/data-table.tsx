"use client";

import { clsx } from "clsx";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Bi } from "@/components/layout/bi";
import { tInline } from "@/lib/i18n";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Makes the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  className?: string;
};

type Sort = { key: string; dir: "asc" | "desc" };

/**
 * C10 admin table: sortable columns, sticky header and first column, 50 rows a page.
 * Keys: ↑ / ↓ move between rows, Enter opens, [ / ] previous / next page.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onOpen,
  pageSize = 50,
  initialSort,
  stickyFirstColumn = true,
  maxHeight = "70vh",
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onOpen?: (row: T) => void;
  pageSize?: number;
  initialSort?: Sort;
  stickyFirstColumn?: boolean;
  maxHeight?: string;
  empty?: ReactNode;
}) {
  const [sort, setSort] = useState<Sort | undefined>(initialSort);
  const [page, setPage] = useState(0);
  const [active, setActive] = useState(0);
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  const sortCol = columns.find((c) => c.key === sort?.key);
  const sorted = sortCol?.sortValue
    ? [...rows].sort((a, b) => {
        const va = sortCol.sortValue!(a);
        const vb = sortCol.sortValue!(b);
        const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
        return sort!.dir === "asc" ? cmp : -cmp;
      })
    : rows;

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * pageSize, (current + 1) * pageSize);
  const activeRow = Math.min(active, Math.max(visible.length - 1, 0));

  function focusRow(i: number) {
    setActive(i);
    bodyRef.current?.querySelectorAll<HTMLElement>("tr")[i]?.focus();
  }

  function goToPage(p: number) {
    setPage(Math.max(0, Math.min(p, pages - 1)));
    setActive(0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTableSectionElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusRow(Math.min(activeRow + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusRow(Math.max(activeRow - 1, 0));
    } else if (e.key === "Enter" && onOpen && visible[activeRow]) {
      e.preventDefault();
      onOpen(visible[activeRow]);
    } else if (e.key === "]") {
      e.preventDefault();
      goToPage(current + 1);
    } else if (e.key === "[") {
      e.preventDefault();
      goToPage(current - 1);
    }
  }

  function toggleSort(key: string) {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(0);
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="table">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th
                  key={c.key}
                  aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  className={clsx(
                    "sticky top-0 z-10 bg-surface",
                    i === 0 && stickyFirstColumn && "left-0 z-20",
                    c.align === "right" && "text-right",
                    c.className,
                  )}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={clsx("inline-flex items-end gap-1", c.align === "right" && "flex-row-reverse")}
                    >
                      {c.header}
                      {sort?.key !== c.key ? (
                        <ArrowUpDown size={14} aria-hidden className="mb-1 shrink-0 opacity-50" />
                      ) : sort.dir === "asc" ? (
                        <ArrowUp size={14} aria-hidden className="mb-1 shrink-0" />
                      ) : (
                        <ArrowDown size={14} aria-hidden className="mb-1 shrink-0" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={bodyRef} onKeyDown={onKeyDown}>
            {visible.map((row, i) => (
              <tr
                key={rowKey(row)}
                tabIndex={i === activeRow ? 0 : -1}
                onFocus={() => setActive(i)}
                onClick={() => onOpen?.(row)}
                className={clsx("bg-surface focus:bg-primary-soft focus:outline-none", onOpen && "cursor-pointer hover:bg-surface-2")}
              >
                {columns.map((c, ci) => (
                  <td
                    key={c.key}
                    className={clsx(
                      ci === 0 && stickyFirstColumn && "sticky left-0 bg-inherit",
                      c.align === "right" && "num text-right",
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-muted">{empty ?? <Bi id="table.empty" />}</p>}
      </div>

      {rows.length > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2 text-sm">
          <span className="num text-muted">
            <Bi
              id="table.range"
              values={{
                from: current * pageSize + 1,
                to: Math.min((current + 1) * pageSize, rows.length),
                total: rows.length,
              }}
              inline
            />
          </span>
          <div className="flex gap-2">
            <button type="button" className="btn min-h-10" disabled={current === 0} onClick={() => goToPage(current - 1)} aria-label={tInline("table.prev")}>
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button type="button" className="btn min-h-10" disabled={current >= pages - 1} onClick={() => goToPage(current + 1)} aria-label={tInline("table.next")}>
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
