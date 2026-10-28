# Progress

Update this file at the end of each work session: what's done, what's next, decisions made.

## Done
- 2026-10-27 — Project scaffolded (Next.js 16, TypeScript, Tailwind 4, App Router, `src/`). Folder skeleton for all 23 routes. Knowledge base in `docs/kb/`. `CLAUDE.md` written.
- 2026-10-27 — **Week 1**
  - Design tokens in `src/app/globals.css` (`@theme`), Inter + Noto Nastaliq Urdu via `next/font`, focus ring, input/button/card/table base styles.
  - Bilingual setup: `src/messages/en.json` + `ur.json`, typed `t()` / `tInline()` in `src/lib/i18n.ts` (values wrapped in LTR isolates inside Urdu), `<Bi>` (C5), "Urdu first" toggle saved in localStorage and applied before first paint.
  - Domain types `src/types/domain.ts` (from the spec).
  - Keyboard: `src/lib/keyboard/` — Enter → next field, Ctrl/⌘+S and Ctrl/⌘+Enter save, single-key page shortcuts.
  - Early components: Combobox + ItemPicker (C1 basic), QtyInput (C2), SlipLines (C3), SlipHeader (C4), TypeChip (C6), SlipForm with sticky Save + summary sheet (C9), Segmented, Field.
  - Wireframe screens with static sample data (`src/lib/wireframe-sample.ts`): S1 login, F1 farm home, F2 new IGP, F3 receive transfer, F4 new OGP, F5 new SIS (+ summary sheet), A1 dashboard + admin shell. Other routes show "built in a later week".
  - Checked: build, tsc, lint clean; screenshots at 360 px and desktop; scripted keyboard test in headless Chrome passed all 20 checks: item search, Enter flow, add/remove line, over-stock, over-sent, shortfall, Ctrl+S summary, Esc, home shortcut. (The test script is not in the repo yet.)

- 2026-10-27 — **Week 2**
  - Mock backend: `src/lib/api/mock/` (engine with all slip rules, deterministic seed of ~250 slips over two weeks ending today, localStorage store with copy-on-write, cross-tab refresh), typed API `src/lib/api/index.ts` with 27 functions, TanStack Query hooks `src/lib/api/queries.ts`. `wireframe-sample.ts` removed.
  - Seed: 11 farms with sheds, 63 real items with Urdu names + aliases; Patoki opening stock and the real slips from the recording (Hatchery OGP-46 → Patoki IGP-1662, OGP-1366 drill machine, SIS-203: Feed 23,739 → 14,941, Diesel 2,550 → 2,465); transfers in transit / > 2 days / short; one corrected, one cancelled slip; one open correction request; three farms missing today's SIS.
  - `src/lib/stock.ts` balances, matrix and stock card from movements.
  - Zod schemas for IGP, receive, OGP, SIS, stock count (`src/features/*/schema.ts`), shared with the engine; messages are ids, errors carry values.
  - Mock login per tab (`src/lib/session.ts`), `FarmGate` / `AdminGate`; all week-1 screens now read live data with skeleton / error / empty states.
  - Components: C1 full (Fuse.js + exact word match, Urdu normalisation, recent items, full-screen sheet on phone, "no item found"), C7 status chip, C8 farm picker, C10 data table (sort, sticky header + first column, 50 per page, ↑ ↓ Enter [ ]), C11 filter bar, C12 print frame (A5/A4, stamp, print CSS). `/dev` page shows C1–C12 on live data + demo controls (reset, latency, failing saves).
  - Keyboard: `?` shortcut list, `/` search, `g h / g s / g k`. Recent items in C1 need `↓` before Enter (Enter in an empty field still moves on).
  - Fixes: base `.input` / `.btn` styles moved into `@layer components` (utilities like `w-28` were being ignored); `scroll-padding-bottom` keeps focused fields clear of the sticky Save bar.
  - Tests: Playwright, `npm run test:e2e` — 32 tests (engine rules, keyboard flows, 10 search cases, seeded data, 360 px phone). Passed 3× in a row (96/96).

- 2026-10-27 — **All screens (weeks 3–6 of the plan, done early at the developer's request, before the backend)**
  - Real saving on F2 IGP, F3 receive, F4 OGP, F5 SIS: per-slip client forms in `src/features/*/…-form.tsx` turn the form into the API input; `SlipForm` shows Saved (real number + Print / View / New slip), Not saved (everything kept) and field errors (banner + under the line / field, mapped back to the row on screen). One idempotency key per slip. OGP → print view; receive → slip detail.
  - Leave without saving? dialog (Back link, `g` shortcuts) + browser unload warning: `src/lib/leave-guard.ts`.
  - S2 print view `/print/[id]`: paper layout via `SlipBody` + `PrintFrame`, A5 / A4 (remembered), QR code (OGP to a farm → the waiting receipt), share (Web Share or copy link).
  - Farm: F6 my slips (search No. / item, type chips, date), F7 slip detail (history banners, request correction), F8 farm stock, F9 item stock card, F10 stock count (card per item on phone).
  - Admin: top-bar farm filter for every screen; A2 all slips; A3 detail + Correct (before → after, reason, pre-filled from A6) + Cancel; A4 farm × item matrix (+ admin stock card); A5 transfers with sent vs received + write-off; A6 correction requests (approve / reject with note); A7 the 8 reports (+ daily mortality chart per shed, Print / PDF, Excel disabled); A8 farms & sheds; A9 items with edit drawer; A10 users (read-only); A11 audit log.
  - Mock API: setup functions, typed report results, local timestamps.
  - Fixes found by tests / screenshots: correction pre-fill raced the request load; React `autoFocus` doesn't work inside `<dialog>` opened later (focus explicitly); bilingual label CSS moved into `@layer components` (sidebar labels never hid below 1024 px, chips wrapped); slip paper keeps its width on phone and scrolls sideways.
  - Tests: 45 Playwright tests, 135/135 over 3 runs. See `docs/kb/08-testing-roadmap.md`.

## Next
- [ ] Draft kept in sessionStorage across a reload (the leave prompt is done)
- [ ] Optional SIS shed chip on Purpose of Use; default feed = last one used per shed
- [ ] Shared PDF file (react-pdf with the Urdu font) instead of sharing the print link
- [ ] Admin entering slips for any farm (the requirements allow it; not in the screen list)
- [ ] Testing roadmap gaps: print/PDF checks, screenshot baselines, axe, performance budget, fixed test clock
- [ ] Then: Urdu review, real phone + printer, client demo — and the backend

## Decisions log
- 2026-10-27 — Frontend only for now. Very simple visual design. Keyboard-first data entry (see `docs/kb/05-keyboard-entry.md`).
- 2026-10-27 — F2 IGP header follows the **paper** order (Bilty No., Truck No., Driver Name, then M/s, then Demand No., D. Challan No., Dated); the spec's field table lists M/s first.
- 2026-10-27 — Slip type chips show the code (IGP / OGP / SIS) in English only, like slip numbers.
- 2026-10-27 — Bilingual strings use a small typed helper, not next-intl (both languages always render together).
- 2026-10-27 — Storybook deferred: `/dev` review page instead (live data, no extra tooling).
- 2026-10-27 — Mock login lives per browser tab, so a demo can run a farm and the admin side by side; saves in one tab refresh the other.
- 2026-10-27 — Corrections are new slips with a `-C1` suffix that point to the original; stock moves by the difference only.
- 2026-10-27 — Transfer status gains "cancelled"; transfers get an optional shortfall resolution. Added to the API contract for A5/A6/A11.
- 2026-10-27 — Forms keep their own light state (no React Hook Form): it works well with the keyboard rules; the Zod schemas are the single source of the rules.
- 2026-10-27 — After saving: IGP / SIS clear for the next slip; OGP opens the print view; receive opens the saved slip.
- 2026-10-27 — Reports are typed tables from the API (`ReportResult`), so one screen shows all eight.
- 2026-10-27 — Admin stock card added at `/admin/stock/[farmId]/[itemId]` (A4's "link to each item's stock card").
