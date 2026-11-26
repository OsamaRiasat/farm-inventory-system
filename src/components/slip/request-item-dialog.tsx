"use client";

import { X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Bi } from "@/components/layout/bi";
import { api, ApiError } from "@/lib/api";
import { useApiMutation, useItems } from "@/lib/api/queries";
import { tInline, type MsgId } from "@/lib/i18n";
import { focusNext } from "@/lib/keyboard/focus";
import { UNITS, type ItemRequest, type Unit } from "@/types/domain";

/**
 * Client #30: a Farm User asks for an item that isn't in the list. The request waits for the Admin (A9 "Requested");
 * it is not added to item search until approved. Keyboard: Enter → next field, Ctrl/⌘+S or Enter on Send sends, Esc closes.
 * Rendered in a portal and stops key / submit events, so the slip form around it never sees them.
 */
export function RequestItemDialog({
  name,
  onClose,
}: {
  /** What was typed in item search; the dialog starts with it. */
  name: string;
  onClose: (sent?: ItemRequest) => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const items = useItems();
  const send = useApiMutation(api.requestItem);
  const [error, setError] = useState<MsgId | null>(null);
  const categories = useMemo(() => [...new Set((items.data ?? []).map((i) => i.category))].sort(), [items.data]);

  // React's autoFocus does nothing in a <dialog> opened later: focus after showModal().
  useEffect(() => {
    dialogRef.current?.showModal();
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (send.isPending) return;
    const data = new FormData(e.currentTarget);
    setError(null);
    try {
      const sent = await send.mutateAsync({
        name: String(data.get("name") ?? ""),
        nameUr: String(data.get("nameUr") ?? ""),
        category: String(data.get("category") ?? ""),
        unit: String(data.get("unit") ?? "") as Unit,
      });
      // Unmounting closes it; calling close() here would fire onClose a second time without the result.
      onClose(sent);
    } catch (err) {
      setError(err instanceof ApiError ? err.id : "err.notSaved");
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDialogElement>) {
    e.stopPropagation();
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "Enter")) {
      e.preventDefault();
      e.currentTarget.querySelector("form")?.requestSubmit();
      return;
    }
    const target = e.target;
    if (e.key === "Enter" && (target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      e.preventDefault();
      focusNext(target);
    }
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-line-strong bg-surface p-0 shadow-xl backdrop:bg-black/40"
      onKeyDown={onKeyDown}
      onClose={() => onClose()}
    >
      <form className="flex flex-col gap-3 p-4" onSubmit={onSubmit} autoComplete="off">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">
            <Bi id="itemReq.button" />
          </h2>
          <button type="button" className="btn min-h-10" aria-label={tInline("common.close")} onClick={() => dialogRef.current?.close()}>
            <X size={18} aria-hidden />
          </button>
        </div>
        <p className="text-sm text-muted">
          <Bi id="itemReq.hint" />
        </p>
        <label className="flex flex-col gap-1 text-sm font-medium">
          <Bi id="items.nameEn" />
          <input ref={nameRef} name="name" className="input" dir="auto" defaultValue={name} required />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          <Bi id="items.nameUr" />
          <input name="nameUr" className="input" lang="ur" dir="rtl" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          <Bi id="filter.category" />
          <select name="category" className="input" required defaultValue="">
            <option value="" disabled>
              {tInline("itemReq.pickCategory")}
            </option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          <Bi id="line.unit" />
          <select name="unit" className="input" defaultValue="QTY">
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {tInline(`unit.${u}`)}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            <Bi id={error} inline />
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={send.isPending}>
          <Bi id="itemReq.send" inline />
        </button>
      </form>
    </dialog>,
    document.body,
  );
}
