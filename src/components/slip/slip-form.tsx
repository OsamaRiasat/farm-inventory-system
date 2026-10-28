"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Bi } from "@/components/layout/bi";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import { isBlank, newIdempotencyKey, readSlipForm } from "@/features/form-data";
import { ApiError } from "@/lib/api";
import { useApiMutation, useItemMap, useStock } from "@/lib/api/queries";
import { today } from "@/lib/dates";
import { fmtQty, parseQty } from "@/lib/format";
import { t } from "@/lib/i18n";
import { enterToNext, focusables } from "@/lib/keyboard/focus";
import { useSaveShortcut } from "@/lib/keyboard/use-shortcut";
import { setDirty } from "@/lib/leave-guard";
import type { FieldError } from "@/lib/validation";
import type { Item, Slip, SlipType } from "@/types/domain";
import { SlipErrorsContext, toFormErrors } from "./slip-errors";

export type SlipFormData = ReturnType<typeof readSlipForm>;
export type BaseInput = { farmId: string; date: string; time: string; preparedBy: string; idempotencyKey: string };
/** The API input, plus which screen row each input line / shed row came from. */
export type BuiltInput = { input: unknown; lineRows: number[]; shedRows?: number[] };

type Summary = { rows: { item: Item; before: number; used: number }[]; mortMale: number; mortFemale: number };

/**
 * Wraps a slip's fields: Enter moves to the next field, Ctrl/⌘+S saves, sticky Save + Prepared by,
 * the C9 summary sheet (SIS), and the saved / not saved / field-error states.
 * After saving: "next" clears the form for another slip, "print" opens the print view (OGP),
 * "detail" opens the saved slip (receive transfer).
 */
export function SlipForm({
  slipType,
  withSummary,
  build,
  save,
  afterSave = "next",
  children,
}: {
  slipType: SlipType;
  withSummary?: boolean;
  build: (form: SlipFormData, base: BaseInput) => BuiltInput;
  save: (input: unknown) => Promise<Slip>;
  afterSave?: "next" | "print" | "detail";
  children: ReactNode;
}) {
  const router = useRouter();
  const { farm, userName: preparedBy } = useCurrentFarm();
  const items = useItemMap();
  const stock = useStock(withSummary ? farm.id : undefined).data;
  const mutation = useApiMutation(save);
  const titleId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const pending = useRef<FormData | null>(null);
  const idempotencyKey = useRef(newIdempotencyKey());
  const [saved, setSaved] = useState<Slip | null>(null);
  const [problem, setProblem] = useState<"notSaved" | "errors" | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [formKey, setFormKey] = useState(0);
  const saving = mutation.isPending;

  useSaveShortcut(() => {
    if (!dialogRef.current?.open) formRef.current?.requestSubmit();
  });

  // Desktop: start typing straight away. (Not on phones: it would pop the keyboard over the slip.)
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) focusFirstField(formRef.current);
    return () => setDirty(false);
  }, []);

  useEffect(() => {
    if (saved || problem) bannerRef.current?.focus();
  }, [saved, problem]);

  // After the sheet renders: focus Confirm, or Back to edit when saving is blocked.
  useEffect(() => {
    if (!summary || !dialogRef.current?.open) return;
    (confirmRef.current?.disabled ? backRef : confirmRef).current?.focus();
  }, [summary]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const data = new FormData(e.currentTarget);
    if (withSummary) {
      pending.current = data;
      setSummary(buildSummary(readSlipForm(data), items, stock ?? new Map()));
      dialogRef.current?.showModal();
    } else {
      void doSave(data);
    }
  }

  async function doSave(data: FormData) {
    dialogRef.current?.close();
    const form = readSlipForm(data);
    const base: BaseInput = {
      farmId: farm.id,
      date: today(),
      time: form.fields.time,
      preparedBy,
      idempotencyKey: idempotencyKey.current,
    };
    const { input, lineRows, shedRows } = build(form, base);
    setProblem(null);
    setErrors([]);
    try {
      const slip = await mutation.mutateAsync(input);
      setDirty(false);
      idempotencyKey.current = newIdempotencyKey();
      if (afterSave === "print") return router.push(`/print/${encodeURIComponent(slip.id)}?saved=1`);
      if (afterSave === "detail") return router.push(`/farm/slips/${encodeURIComponent(slip.id)}?saved=1`);
      setSaved(slip);
      setFormKey((k) => k + 1);
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err instanceof ApiError && err.id !== "err.notSaved") {
        const fieldErrors = err.fieldErrors.length ? err.fieldErrors : [{ path: [], id: err.id, values: err.values }];
        setErrors(toFormErrors(fieldErrors, lineRows, shedRows));
        setProblem("errors");
      } else {
        setProblem("notSaved");
      }
      window.scrollTo({ top: 0 });
    }
  }

  function startNew() {
    setSaved(null);
    focusFirstField(formRef.current);
  }

  const blocked = !summary || summary.rows.length === 0 || summary.rows.some((r) => r.used > r.before);

  return (
    <SlipErrorsContext.Provider value={errors}>
      {saved && (
        <div
          ref={bannerRef}
          tabIndex={-1}
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary bg-success-bg p-3"
        >
          <span className="flex items-center gap-2 font-medium">
            <CircleCheck className="shrink-0 text-primary" aria-hidden />
            <Bi id="slip.saved" values={{ type: slipType, no: saved.no }} />
          </span>
          <span className="flex flex-wrap gap-2">
            <Link href={`/print/${encodeURIComponent(saved.id)}`} className="btn min-h-10">
              <Bi id="slip.print" inline />
            </Link>
            <Link href={`/farm/slips/${encodeURIComponent(saved.id)}`} className="btn min-h-10">
              <Bi id="slip.view" inline />
            </Link>
            <button type="button" className="btn btn-primary min-h-10" onClick={startNew}>
              <Bi id="slip.newSlip" inline />
            </button>
          </span>
        </div>
      )}

      {problem && (
        <div ref={bannerRef} tabIndex={-1} role="alert" className="mb-4 rounded-lg border border-danger bg-danger-bg p-3 text-danger">
          <p className="flex items-start gap-2 font-medium">
            <TriangleAlert className="mt-1 shrink-0" size={20} aria-hidden />
            <Bi id={problem === "notSaved" ? "err.notSaved" : "slip.fixErrors"} />
          </p>
          {problem === "errors" && (
            <ul className="mt-2 flex flex-col gap-1 pl-7 text-sm">
              {errors.map((e, i) => (
                <li key={i} className="flex flex-wrap gap-x-2">
                  {e.path[0] === "lines" && typeof e.path[1] === "number" && (
                    <span className="font-semibold">
                      <Bi id="slip.lineN" values={{ n: e.path[1] + 1 }} inline />
                    </span>
                  )}
                  <Bi id={e.id} values={e.values} inline />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form
        ref={formRef}
        key={formKey}
        onKeyDown={enterToNext}
        onSubmit={onSubmit}
        onInput={() => {
          setDirty(true);
          if (problem === "errors") {
            setProblem(null);
            setErrors([]);
          }
        }}
        noValidate
      >
        {children}
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-line bg-surface px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <Bi id="slip.preparedBy" className="text-muted" />
              <div className="font-medium">{preparedBy}</div>
            </div>
            <button type="submit" data-save className="btn btn-primary btn-lg flex-1 sm:max-w-72" disabled={saving}>
              {saving ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden />
                  <Bi id="slip.saving" inline />
                </>
              ) : (
                <Bi id="slip.save" inline />
              )}
            </button>
          </div>
          <p className="mt-1 hidden text-right text-xs text-muted lg:block">
            <Bi id="slip.saveHint" inline />
          </p>
        </div>
      </form>

      {withSummary && (
        <dialog ref={dialogRef} className="sheet" aria-labelledby={titleId}>
          <div className="p-4">
            <h2 id={titleId} className="text-lg font-semibold">
              <Bi id="summary.title" />
            </h2>
            {summary?.rows.length === 0 && (
              <p className="mt-3 text-muted">
                <Bi id="summary.empty" />
              </p>
            )}
            <ul className="mt-3 divide-y divide-line">
              {summary?.rows.map(({ item, before, used }) => {
                const after = before - used;
                return (
                  <li key={item.id} className="flex items-start justify-between gap-3 py-2">
                    <span>
                      <span className="block">{item.name}</span>
                      <span lang="ur" dir="rtl" className="block text-left text-sm text-muted">
                        {item.nameUr}
                      </span>
                    </span>
                    <span className={clsx("num pt-0.5 text-right whitespace-nowrap", after < 0 && "font-semibold text-danger")}>
                      {fmtQty(before)} → {fmtQty(after)} {t(`unit.${item.unit}`).en}
                    </span>
                  </li>
                );
              })}
            </ul>
            {summary && (summary.mortMale > 0 || summary.mortFemale > 0) && (
              <p className="mt-2 border-t border-line pt-2 text-sm text-muted">
                <Bi id="summary.mortality" values={{ m: summary.mortMale, f: summary.mortFemale }} />
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button ref={backRef} type="button" className="btn" onClick={() => dialogRef.current?.close()}>
                <Bi id="summary.back" inline />
              </button>
              <button
                ref={confirmRef}
                type="button"
                className="btn btn-primary"
                onClick={() => pending.current && void doSave(pending.current)}
                disabled={blocked || saving}
              >
                <Bi id="summary.confirm" inline />
              </button>
            </div>
          </div>
        </dialog>
      )}
    </SlipErrorsContext.Provider>
  );
}

/** First input or select of the slip (skips buttons such as "change" time). */
function focusFirstField(form: HTMLFormElement | null) {
  if (!form) return;
  focusables(form)
    .find((el) => el.tagName !== "BUTTON")
    ?.focus();
}

/** Adds up feed and item quantities by item: the "before → after" the farm used to work out by hand. */
function buildSummary(form: SlipFormData, items: Map<string, Item>, stock: Map<string, number>): Summary {
  const used = new Map<string, number>();
  const add = (itemId: string | undefined, qty: string | undefined) => {
    const n = parseQty(qty ?? "");
    if (itemId && n) used.set(itemId, (used.get(itemId) ?? 0) + n);
  };

  let mortMale = 0;
  let mortFemale = 0;
  for (const [, row] of form.shed) {
    if (isBlank(row, ["feedKg", "mortMale", "mortFemale"])) continue;
    add(row.feedItem, row.feedKg);
    mortMale += parseQty(row.mortMale ?? "") ?? 0;
    mortFemale += parseQty(row.mortFemale ?? "") ?? 0;
  }
  for (const [, row] of form.lines) add(row.item, row.qty);

  const rows = [...used].flatMap(([id, n]) => {
    const item = items.get(id);
    return item ? [{ item, before: stock.get(id) ?? 0, used: n }] : [];
  });
  return { rows, mortMale, mortFemale };
}
