# 05 · Keyboard-first entry

**Project decision (from the developer, Oct 2026):** data entry must be fast from the keyboard. A slip should be fillable start to finish **without touching the mouse** on the office PC, and with the phone's on-screen keyboard "Next" key on mobile. This sits on top of the spec, which only covers touch.

## Core behaviour on every slip form
| Key | Effect |
| --- | --- |
| `Tab` / `Shift+Tab` | Natural order = paper order (header → lines → footer). Never a positive `tabIndex` |
| `Enter` in a text/number field | Move to the next field (like Tab). Never submits the form by accident |
| `Enter` in the **last field of a line** | Add a new empty line and focus its Item search |
| `Enter` in an **empty** Item search on a new line | Leave the lines, jump to Save |
| `Ctrl/⌘ + Enter` or `Ctrl/⌘ + S` | Save (opens the Summary sheet on SIS) |
| `Alt + N` | Add line |
| `Alt + Backspace` | Remove current line (if not the only one) |
| `Esc` | Close the open sheet/dropdown; otherwise nothing (no accidental leave) |

On mobile, set `enterKeyHint="next"` on fields and `enterKeyHint="done"` on the last one so the soft keyboard shows the right key.

## Item search (C1)
- Opens on focus with this farm's **recent items** (nothing highlighted — press `↓` to choose one), and on typing with the first result pre-highlighted.
- So `Enter` in an empty item field never picks a recent item by accident: it moves on (or jumps to Save on an empty new line).
- `↑` / `↓` move, `Enter` selects and moves focus to the line's first quantity field, `Esc` closes and keeps the typed text.
- Unit fills in instantly; focus never lands on Unit (not editable, `tabIndex={-1}`).

## Quantity input (C2)
- Numbers only; separators added on blur, not while typing (cursor must not jump).
- Errors ("Only 6 in stock") show under the field immediately, but don't steal focus.

## Summary sheet (C9) and dialogs
- Focus lands on the primary button ("Confirm and save"). `Enter` confirms, `Esc` = "Back to edit" and returns focus to where the user was.
- Leave-without-saving dialog: focus on **Stay**.

## Segmented controls and chips
Radio-group semantics: `←` / `→` switch, `Space` selects. One Tab stop per group.

## Global shortcuts
| Key | Effect |
| --- | --- |
| `/` | Focus the screen's search box |
| `g h` / `g s` / `g k` | Farm: Home / Slips / Stock |
| `1` `2` `3` on Farm home | New IGP / New OGP / New SIS |
| `?` | Show the shortcut list (bilingual) |

Global single-key shortcuts are ignored while focus is in an input.

Implemented in week 2: `?` (list, both areas), `/` (focuses the element marked `data-search`), `g h / g s / g k` (farm). See `src/components/layout/global-shortcuts.tsx`.

## Admin tables (C10)
`↑` / `↓` move the row highlight, `Enter` opens the row, `/` focuses search, `[` / `]` previous / next page.

## After saving
Focus moves to the saved banner's primary action ("New slip"), so the next slip can start with `Enter`. OGP goes to Print view; `Ctrl/⌘ + P` prints.

## Implementation notes
- Put the shared logic in `src/lib/keyboard/` (e.g. `useEnterToNext`, `useShortcut`, a slip-form focus manager). Don't scatter `onKeyDown` handlers.
- Visible focus ring always (2 px primary outline). Never `outline: none` without a replacement.
- Every keyboard path must also work by touch — keyboard is an addition, never a requirement.
