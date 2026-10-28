"use client";

import { clsx } from "clsx";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { tInline } from "@/lib/i18n";
import { focusNext } from "@/lib/keyboard/focus";

type Props<T> = {
  search: (query: string) => T[];
  getKey: (option: T) => string;
  getText: (option: T) => string;
  renderOption: (option: T) => ReactNode;
  /** Called with the picked option, or null when the text is edited after a pick. */
  onPick: (option: T | null) => void;
  defaultText?: string;
  /** Options shown before anything is typed (e.g. recent items), with a heading. */
  initialOptions?: () => T[];
  initialHeading?: ReactNode;
  /** Shown when something is typed and nothing matches. */
  noResults?: ReactNode;
  /** Open the list as soon as the field gets focus. */
  openOnFocus?: boolean;
  /** Below 640px the open search takes the whole screen (C1 on phone). */
  sheetOnPhone?: boolean;
  /** Marks the input for line keyboard handling (data-kind). */
  kind?: string;
  limit?: number;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
};

/**
 * Keyboard-first search box: type to open, ↑ / ↓ to move, Enter to pick and jump to the next field,
 * Esc to close. Typed results pre-select the first match; initial options (recent items) need ↓ first,
 * so Enter in an empty field still falls through to the form (next field, or Save on an empty line).
 */
export function Combobox<T>({
  search,
  getKey,
  getText,
  renderOption,
  onPick,
  defaultText = "",
  initialOptions,
  initialHeading,
  noResults,
  openOnFocus,
  sheetOnPhone,
  kind,
  limit = 8,
  inputProps,
}: Props<T>) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(defaultText);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const query = text.trim();
  const results = !open ? [] : query ? search(query).slice(0, limit) : (initialOptions?.() ?? []).slice(0, limit);
  const showHeading = open && !query && results.length > 0 && initialHeading;
  const showNoResults = open && !!query && results.length === 0 && noResults;
  const sheet = sheetOnPhone && open;
  // -1 = nothing highlighted.
  const hasList = results.length > 0 || !!showNoResults;

  // A list opening near the bottom of the screen scrolls into view (above the sticky Save bar).
  useEffect(() => {
    if (hasList) listRef.current?.scrollIntoView({ block: "nearest" });
  }, [hasList]);

  const current = active < 0 || results.length === 0 ? -1 : Math.min(active, results.length - 1);

  function pick(option: T) {
    setText(getText(option));
    setOpen(false);
    onPick(option);
    if (inputRef.current) focusNext(inputRef.current);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive(Math.min(current + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(current - 1, 0));
    } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && current >= 0) {
      e.preventDefault();
      pick(results[current]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div
      className={clsx(
        "relative",
        sheet && "max-sm:fixed max-sm:inset-0 max-sm:z-50 max-sm:flex max-sm:flex-col max-sm:bg-surface max-sm:p-3",
      )}
    >
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={current >= 0 ? `${listId}-${current}` : undefined}
          autoComplete="off"
          enterKeyHint="next"
          dir="auto"
          className="input"
          data-kind={kind}
          {...inputProps}
          value={text}
          onFocus={() => {
            if (!openOnFocus) return;
            setOpen(true);
            setActive(-1);
          }}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(e.target.value.trim() ? 0 : -1);
            onPick(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setOpen(false)}
        />
        {sheet && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={tInline("common.close")}
            className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-line-strong sm:hidden"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setOpen(false);
              inputRef.current?.blur();
            }}
          >
            <X size={22} aria-hidden />
          </button>
        )}
      </div>
      {hasList && (
        <div
          ref={listRef}
          className={clsx(
            "absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-auto rounded-lg border border-line-strong bg-surface shadow-lg",
            sheet && "max-sm:static max-sm:mt-2 max-sm:max-h-none max-sm:flex-1 max-sm:border-0 max-sm:shadow-none",
          )}
        >
          {showHeading && <div className="border-b border-line px-3 py-1 text-xs text-muted">{initialHeading}</div>}
          {showNoResults && <div className="px-3 py-3 text-muted">{noResults}</div>}
          <ul id={listId} role="listbox">
            {results.map((option, i) => (
              <li
                key={getKey(option)}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === current}
                className={clsx("cursor-pointer border-b border-line px-3 py-2 last:border-b-0", i === current && "bg-primary-soft")}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(option);
                }}
              >
                {renderOption(option)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
