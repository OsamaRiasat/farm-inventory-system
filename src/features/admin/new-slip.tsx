"use client";

import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAdminFarm } from "@/components/layout/admin-farm-filter";
import { Bi } from "@/components/layout/bi";
import { CurrentFarmProvider } from "@/components/layout/farm-gate";
import { LeavePrompt } from "@/components/layout/leave-prompt";
import { FarmPicker } from "@/components/ui/farm-picker";
import { LoadError, SkeletonRows } from "@/components/ui/skeleton";
import { IgpForm } from "@/features/igp/igp-form";
import { OgpForm } from "@/features/ogp/ogp-form";
import { SisForm } from "@/features/sis/sis-form";
import { DrForm } from "@/features/daily-report/dr-form";
import { StockCountForm } from "@/features/stock-count/stock-count-form";
import { useFarms } from "@/lib/api/queries";
import { tInline, type MsgId } from "@/lib/i18n";
import { requestLeave } from "@/lib/leave-guard";
import { useOnHide } from "@/lib/on-hide";
import { useSession } from "@/lib/session";
import type { Farm } from "@/types/domain";

// The Accounts Admin enters a slip received from a farm, on that farm's behalf: the same forms and rules
// as the farm's own screens, with the admin as "Prepared by".

export type NewSlipType = "igp" | "ogp" | "sis" | "dr" | "count";

const kinds: { type: NewSlipType; title: MsgId }[] = [
  { type: "igp", title: "slip.IGP" },
  { type: "ogp", title: "slip.OGP" },
  { type: "sis", title: "slip.SIS" },
  { type: "dr", title: "slip.DR" },
  { type: "count", title: "count.title" },
];

const forms = { igp: IgpForm, ogp: OgpForm, sis: SisForm, dr: DrForm, count: StockCountForm };

export function newSlipHref(type: NewSlipType) {
  return `/admin/slips/new/${type}`;
}

/** "New slip ▾" above the A2 table: IGP / OGP / SIS / Daily Report / Stock count. ↑/↓ move, Esc closes. */
export function NewSlipMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const links = () => [...(rootRef.current?.querySelectorAll<HTMLAnchorElement>("[role=menuitem]") ?? [])];

  useEffect(() => {
    if (!open) return;
    links()[0]?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function onKeyDown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const all = links();
      const at = all.indexOf(document.activeElement as HTMLAnchorElement);
      all[(at + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length]?.focus();
    }
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-primary min-h-10"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Plus size={18} aria-hidden />
        <Bi id="slip.newSlip" inline />
        <ChevronDown size={18} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 z-20 mt-1 flex min-w-64 flex-col p-1">
          {kinds.map((k) => (
            <Link
              key={k.type}
              role="menuitem"
              href={newSlipHref(k.type)}
              className="flex min-h-12 items-center rounded-md px-3 hover:bg-surface-2 focus:bg-surface-2"
              onClick={() => setOpen(false)}
            >
              <Bi id={k.title} inline />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A12 — New slip for a farm. The farm picked in the top bar is used straight away; otherwise the admin
 * picks it first. Once the form is open the farm stays fixed ("Change farm" clears the form).
 */
export function AdminNewSlip({ type }: { type: NewSlipType }) {
  const session = useSession();
  const farms = useFarms();
  const topFarm = useAdminFarm();
  // null = not decided yet (follow the top bar); "" = admin asked to choose another farm.
  const [picked, setPicked] = useState<string | null>(null);
  useOnHide(() => setPicked(null));

  const active = (farms.data ?? []).filter((f) => f.active);
  const farm = active.find((f) => f.id === (picked ?? topFarm));
  // Fix the farm once the form opens, so changing the top bar later can't swap it under typed lines.
  if (picked === null && farm) setPicked(farm.id);

  if (farms.isError) return <LoadError onRetry={() => farms.refetch()} />;
  if (!farms.data || session?.role !== "admin") return <SkeletonRows rows={4} />;

  const title = kinds.find((k) => k.type === type)!.title;
  if (!farm) return <ChooseFarm title={title} farms={active} onPick={setPicked} />;

  const Form = forms[type];
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-strong bg-surface-2 px-4 py-2">
        <span className="flex flex-wrap items-center gap-x-3">
          <Bi id="admin.enteringFor" className="text-sm text-muted" />
          <span className="font-semibold" data-testid="entry-farm">
            {farm.name}
          </span>
        </span>
        <button type="button" className="btn min-h-10" onClick={() => requestLeave(() => setPicked(""))}>
          <Bi id="admin.changeFarm" inline />
        </button>
      </div>
      <CurrentFarmProvider key={farm.id} farm={farm} userName={session.userName} area="admin">
        <Form />
      </CurrentFarmProvider>
      <LeavePrompt />
    </div>
  );
}

/** Which farm the paper slip came from. Enter on the list continues. */
function ChooseFarm({ title, farms, onPick }: { title: MsgId; farms: Farm[]; onPick: (farmId: string) => void }) {
  const [value, setValue] = useState("");
  const selectRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    selectRef.current?.querySelector("select")?.focus();
  }, []);

  return (
    <form
      className="card mx-auto flex max-w-xl flex-col gap-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (value) onPick(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLSelectElement && !e.defaultPrevented) {
          e.preventDefault();
          e.currentTarget.requestSubmit();
        }
      }}
    >
      <h1 className="text-xl font-semibold">
        <Bi id={title} />
      </h1>
      <label ref={selectRef} className="flex flex-col gap-1 font-medium">
        <Bi id="admin.chooseFarm" />
        <FarmPicker
          farms={farms}
          value={value}
          onChange={setValue}
          placeholder={tInline("admin.chooseFarmPlaceholder")}
          name="entryFarm"
          aria-label={tInline("admin.chooseFarm")}
        />
      </label>
      <button type="submit" className="btn btn-primary btn-lg" disabled={!value}>
        <Bi id="admin.continue" inline />
      </button>
    </form>
  );
}
