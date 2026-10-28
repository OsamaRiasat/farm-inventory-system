"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, RotateCcw } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Bi } from "@/components/layout/bi";
import { CurrentFarmProvider } from "@/components/layout/farm-gate";
import { StatusChip, type Status } from "@/components/layout/status-chip";
import { TypeChip } from "@/components/layout/type-chip";
import { ItemPicker } from "@/components/slip/item-picker";
import { PrintFrame } from "@/components/slip/print-frame";
import { QtyInput } from "@/components/slip/qty-input";
import { SlipHeader } from "@/components/slip/slip-header";
import { SlipLines, type LineCol } from "@/components/slip/slip-lines";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FarmPicker } from "@/components/ui/farm-picker";
import { FilterBar, type Filters } from "@/components/ui/filter-bar";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useFarms, useItemMap, useSlips, useStock } from "@/lib/api/queries";
import { fmtDate } from "@/lib/dates";
import { fmtQty } from "@/lib/format";
import type { MsgId } from "@/lib/i18n";
import { enterToNext } from "@/lib/keyboard/focus";
import type { Item, SIS, Slip } from "@/types/domain";

const SAMPLE_FARM = "aw02";
const DEFAULT_OPTIONS = { latencyMs: 300, failSaves: false };

const lineCols: LineCol[] = [
  { key: "item", label: "line.description", kind: "item", width: "2fr", required: true },
  { key: "unit", label: "line.unit", kind: "unit", width: "4.5rem" },
  { key: "qty", label: "line.qty", kind: "qty", width: "1fr", required: true },
  { key: "weight", label: "line.weight", kind: "weight", width: "0.8fr" },
];

/** Component review page (replaces Storybook for now) + demo controls. Uses Patoki's live mock data. */
export function DevGallery() {
  const farms = useFarms();
  const farm = farms.data?.find((f) => f.id === SAMPLE_FARM);

  if (farms.isError) return <LoadError onRetry={() => farms.refetch()} />;
  if (!farm) return <SkeletonRows rows={6} />;

  return (
    <CurrentFarmProvider farm={farm} userName={`${farm.code} Store Keeper`}>
      <p className="text-sm text-muted">
        <Bi id="dev.sampleFarm" values={{ farm: farm.name }} inline />
      </p>
      <DemoControls />
      <ItemSearchDemo />
      <Section title="dev.c2">
        <div className="grid max-w-md grid-cols-2 gap-3">
          <QtyDemo unit="KG" decimals />
          <QtyDemo unit="Qty" />
        </div>
      </Section>
      <Section title="dev.c3">
        <form onKeyDown={enterToNext} onSubmit={(e) => e.preventDefault()}>
          <SlipLines cols={lineCols} showStock rules={{ maxStock: true }} />
        </form>
      </Section>
      <Section title="dev.c4">
        <SlipHeader type="SIS" />
      </Section>
      <ChipsDemo />
      <SlipsTableDemo />
      <PrintDemo />
    </CurrentFarmProvider>
  );
}

function Section({ title, children }: { title: MsgId; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold">
        <Bi id={title} />
      </h2>
      {children}
    </section>
  );
}

function DemoControls() {
  const client = useQueryClient();
  const options = useSyncExternalStore(api.subscribeMockOptions, api.getMockOptions, () => DEFAULT_OPTIONS);
  const [resetting, setResetting] = useState(false);
  const change = (next: Partial<typeof options>) => api.setMockOptions(next);

  return (
    <Section title="dev.demo">
      <div className="card flex flex-wrap items-end gap-4 p-4 text-sm">
        <button
          type="button"
          className="btn"
          disabled={resetting}
          onClick={async () => {
            setResetting(true);
            await api.resetDemo();
            await client.invalidateQueries();
            setResetting(false);
          }}
        >
          <RotateCcw size={18} aria-hidden />
          <Bi id="dev.reset" inline />
        </button>
        <label className="flex flex-col gap-1">
          <Bi id="dev.latency" />
          <select className="input min-h-10 w-40" value={options.latencyMs} onChange={(e) => change({ latencyMs: Number(e.target.value) })}>
            {[0, 300, 1500].map((ms) => (
              <option key={ms} value={ms}>
                {ms} ms
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-10 items-center gap-2">
          <input type="checkbox" className="size-5" checked={options.failSaves} onChange={(e) => change({ failSaves: e.target.checked })} />
          <Bi id="dev.failSaves" />
        </label>
      </div>
    </Section>
  );
}

function ItemSearchDemo() {
  const stock = useStock(SAMPLE_FARM).data;
  const [item, setItem] = useState<Item | null>(null);
  return (
    <Section title="dev.c1">
      <div className="card flex max-w-xl flex-col gap-2 p-4">
        <p className="text-sm text-muted">
          <Bi id="dev.searchTry" />
        </p>
        <ItemPicker name="demoItem" item={item} onPick={setItem} farmId={SAMPLE_FARM} stock={stock} />
      </div>
    </Section>
  );
}

function QtyDemo({ unit, decimals }: { unit: string; decimals?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{unit}</span>
      <QtyInput value={value} onChange={setValue} suffix={unit} decimals={decimals} />
    </label>
  );
}

function ChipsDemo() {
  const farms = useFarms().data ?? [];
  const [farmId, setFarmId] = useState("");
  const statuses: Status[] = ["saved", "corrected", "cancelled", "in_transit", "received", "short"];
  return (
    <Section title="dev.c5to8">
      <div className="card flex flex-col gap-4 p-4">
        <Bi id="slip.IGP" className="text-lg" />
        <div className="flex flex-wrap gap-2">
          <TypeChip type="IGP" />
          <TypeChip type="OGP" />
          <TypeChip type="SIS" />
        </div>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <StatusChip key={s} status={s} />
          ))}
        </div>
        <div className="max-w-sm">
          <FarmPicker farms={farms} includeAll value={farmId} onChange={setFarmId} />
        </div>
      </div>
    </Section>
  );
}

function SlipsTableDemo() {
  const [filters, setFilters] = useState<Filters>({});
  const [opened, setOpened] = useState<string | null>(null);
  const farms = useFarms().data ?? [];
  const items = useItemMap();
  const slips = useSlips(filters);

  const columns: Column<Slip>[] = [
    { key: "no", header: <Bi id="col.no" />, cell: (s) => <span className="num font-medium whitespace-nowrap">{s.no}</span>, sortValue: (s) => s.no },
    { key: "type", header: <Bi id="col.type" />, cell: (s) => <TypeChip type={s.type} />, sortValue: (s) => s.type },
    { key: "farm", header: <Bi id="col.farm" />, cell: (s) => farms.find((f) => f.id === s.farmId)?.code, sortValue: (s) => s.farmId },
    { key: "date", header: <Bi id="slip.date" />, cell: (s) => <span className="num whitespace-nowrap">{fmtDate(s.date)} {s.time}</span>, sortValue: (s) => `${s.date}T${s.time}` },
    {
      key: "first",
      header: <Bi id="col.firstItem" />,
      cell: (s) => items.get(s.lines[0]?.itemId ?? (s.type === "SIS" ? (s.shedRows[0]?.feedItemId ?? "") : ""))?.name ?? "—",
    },
    { key: "lines", header: <Bi id="line.items" />, cell: (s) => s.lines.length, sortValue: (s) => s.lines.length, align: "right" },
    { key: "status", header: <Bi id="col.status" />, cell: (s) => <StatusChip status={s.status} />, sortValue: (s) => s.status },
  ];

  return (
    <Section title="dev.c10">
      <div className="flex flex-col gap-3">
        <FilterBar value={filters} onChange={setFilters} farms={farms} />
        {opened && (
          <p className="text-sm" role="status">
            <Bi id="dev.opened" values={{ no: opened }} inline />
          </p>
        )}
        {slips.isError ? (
          <LoadError onRetry={() => slips.refetch()} />
        ) : !slips.data ? (
          <SkeletonRows rows={6} />
        ) : (
          <DataTable
            rows={slips.data}
            columns={columns}
            rowKey={(s) => s.id}
            onOpen={(s) => setOpened(s.no)}
            initialSort={{ key: "date", dir: "desc" }}
            maxHeight="28rem"
          />
        )}
      </div>
    </Section>
  );
}

function PrintDemo() {
  const [size, setSize] = useState<"A5" | "A4">("A5");
  const slip = useQuery({ queryKey: ["slip", "AW02-SIS-0203"], queryFn: () => api.getSlip("AW02-SIS-0203") });
  const farms = useFarms().data ?? [];
  const items = useItemMap();
  const farm = farms.find((f) => f.id === slip.data?.farmId);

  return (
    <Section title="dev.c12">
      <div className="mb-3 flex gap-2">
        <select className="input min-h-10 w-28" value={size} onChange={(e) => setSize(e.target.value as "A5" | "A4")}>
          <option value="A5">A5</option>
          <option value="A4">A4</option>
        </select>
        <button type="button" className="btn min-h-10" onClick={() => window.print()}>
          <Printer size={18} aria-hidden />
          <Bi id="dev.print" inline />
        </button>
      </div>
      {slip.isError && <LoadError onRetry={() => slip.refetch()} />}
      {slip.data?.type === "SIS" && farm && (
        <div className="overflow-x-auto bg-surface-2 py-4">
          <div className="w-fit shadow-lg">
            <PrintFrame farm={farm} type="SIS" no={slip.data.no} date={slip.data.date} time={slip.data.time} preparedBy={slip.data.preparedBy} status={slip.data.status} size={size}>
              <SisPrintTable slip={slip.data} items={items} shedName={(id) => farm.sheds.find((s) => s.id === id)?.name ?? ""} />
            </PrintFrame>
          </div>
        </div>
      )}
    </Section>
  );
}

/** The SIS body as on paper: feed and mortality on the first lines, then items. */
function SisPrintTable({ slip, items, shedName }: { slip: SIS; items: Map<string, Item>; shedName: (id: string) => string }) {
  const unit = (id: string) => items.get(id)?.unit ?? "";
  let n = 0;
  return (
    <table>
      <thead>
        <tr>
          <th>S. No.</th>
          <th>Name of Item</th>
          <th className="text-right">Quantity</th>
          <th>Ledger Folio</th>
          <th>Purpose of Use</th>
        </tr>
      </thead>
      <tbody>
        {slip.shedRows.map((r) => (
          <tr key={r.shedId}>
            <td>{++n}</td>
            <td>
              {items.get(r.feedItemId)?.name} — {shedName(r.shedId)}
            </td>
            <td className="num text-right">{fmtQty(r.feedKg)} KG</td>
            <td>{items.get(r.feedItemId)?.number}</td>
            <td className="num">
              Mort M {r.mortMale} · F {r.mortFemale}
            </td>
          </tr>
        ))}
        {slip.lines.map((l, i) => (
          <tr key={i}>
            <td>{++n}</td>
            <td>
              {items.get(l.itemId)?.name}{" "}
              <span lang="ur" dir="rtl">
                {items.get(l.itemId)?.nameUr}
              </span>
            </td>
            <td className="num text-right">
              {fmtQty(l.qty)} {unit(l.itemId)}
            </td>
            <td>{items.get(l.itemId)?.number}</td>
            <td dir="auto">{l.purpose}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
