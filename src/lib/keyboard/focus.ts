// Focus order for keyboard-first entry — docs/kb/05-keyboard-entry.md.

const SELECTOR = "input:not([type=hidden]), select, textarea, button";

/** Elements reachable with Tab, in DOM order. A radio group counts once (its checked radio). */
export function focusables(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter((el) => {
    if ((el as HTMLInputElement).disabled || el.tabIndex < 0) return false;
    if (el.getClientRects().length === 0) return false;
    if (el instanceof HTMLInputElement && el.type === "radio" && !el.checked) {
      const group = Array.from(root.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${CSS.escape(el.name)}"]`));
      return !group.some((r) => r.checked) && group[0] === el;
    }
    return true;
  });
}

/** Moves focus to the next field in the same form (or page). */
export function focusNext(from: HTMLElement) {
  const root = (from as HTMLInputElement).form ?? document;
  const list = focusables(root);
  list[list.indexOf(from) + 1]?.focus();
}

/** Form-level onKeyDown: Enter in a field moves to the next field instead of submitting. */
export function enterToNext(e: React.KeyboardEvent<HTMLFormElement>) {
  if (e.defaultPrevented || e.key !== "Enter") return;
  if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
  const target = e.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  e.preventDefault();
  focusNext(target);
}

/** True when the key event came from a place where the user is typing. */
export function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el?.closest("input, textarea, select, [contenteditable=true]");
}
