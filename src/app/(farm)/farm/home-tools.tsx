"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Printer, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Bi } from "@/components/layout/bi";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import { exportStock, stockRows } from "@/features/farm/farm-stock";
import { useItems, useStock } from "@/lib/api/queries";
import { tInline } from "@/lib/i18n";

/** F1 Find: gate pass No., item or date → My slips with that search. "/" focuses it. */
export function HomeFind() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (date) params.set("date", date);
    router.push(`/farm/slips${params.size ? `?${params}` : ""}`);
  }

  return (
    <form role="search" onSubmit={onSubmit} className="card mb-4 flex flex-col gap-2 p-3">
      <label htmlFor="home-find" className="text-sm font-medium">
        <Bi id="home.find" />
      </label>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search size={20} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
          <input
            id="home-find"
            type="search"
            data-search
            dir="auto"
            enterKeyHint="search"
            className="input pl-10"
            placeholder={tInline("home.findHint")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <input
          type="date"
          className="input num w-auto"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label={tInline("slip.date")}
        />
        <button type="submit" className="btn btn-primary">
          <Bi id="home.findButton" inline />
        </button>
      </div>
    </form>
  );
}

/** F1 Export: the whole stock report to Excel or PDF; one item's report is on its stock card. */
export function HomeExport() {
  const { farm } = useCurrentFarm();
  const items = useItems();
  const stock = useStock(farm.id);
  const loaded = !!items.data && !!stock.data;

  return (
    <section className="mt-6">
      <h2 className="mb-2 font-semibold">
        <Bi id="home.export" />
      </h2>
      <div className="card flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Bi id="home.exportStock" className="flex-1 font-medium" />
          <button
            type="button"
            className="btn"
            disabled={!loaded}
            onClick={() => exportStock(farm, stockRows((items.data ?? []).filter((i) => i.active), stock.data))}
          >
            <FileSpreadsheet size={18} aria-hidden />
            <Bi id="export.excel" inline />
          </button>
          <Link href="/farm/stock?print=1" className="btn">
            <Printer size={18} aria-hidden />
            <Bi id="export.pdf" inline />
          </Link>
        </div>
        <p className="text-sm text-muted">
          <Bi id="home.exportItem" />{" "}
          <Link href="/farm/stock" className="text-primary underline">
            <Bi id="nav.stock" inline />
          </Link>
        </p>
      </div>
    </section>
  );
}
