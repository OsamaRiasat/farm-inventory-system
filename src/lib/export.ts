"use client";

// Excel export without a backend: a CSV file that Excel opens directly.
// The byte-order mark makes Excel read it as UTF-8, so Urdu names come through.

type Cell = string | number | null | undefined;

function csvCell(value: Cell) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Downloads rows (first row = headings) as `<name>.csv`. */
export function downloadCsv(name: string, rows: Cell[][]) {
  const text = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^\w.-]+/g, "-")}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "Opened with ?print=1": print once the page's data has loaded, then drop the flag. */
export function takePrintFlag() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("print") !== "1") return false;
  url.searchParams.delete("print");
  window.history.replaceState(window.history.state, "", url);
  return true;
}
