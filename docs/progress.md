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

- 2026-11-03 — **Client issue list (Google Sheet "Simple_Issue_Correction_List", rows 1–16, 29–30 Oct 2026)** — UI + mock API only, contract docs updated
  - #1 #3 #9 #11 Paper slip No.: `No. IGP- / OGP- / SIS-` box in the slip header (required, first field, unique per farm + type). Farm screens, banners and prints show it; the system number stays for the admin (under the paper No.) and the QR code. `SlipBase.paperNo`, `slipNo()` in `src/lib/slips.ts`.
  - #7 #8 #11 Slip dates: "Posted on" (automatic, `SlipBase.postedAt`) + editable Arrival / Dispatch / Issue date (today − 30 … today, rule in `checkSlipBase`). IGP's lower date relabelled "D. Challan Dated".
  - #6 Empty slip on every visit: Next.js 16 keeps left pages alive with `<Activity>`; `SlipForm` resets itself in a `useLayoutEffect` cleanup.
- 2026-11-16 — **Client issue #18 (6 Nov 2026)**: slip date (Arrival / Dispatch / Issue) can be any earlier date, previous months included; still never after today. 30-day limit and `err.dateTooOld` removed (`checkSlipBase`, date field `min`).
  - #10 #16 Back: OGP save / receive replace the form in history; the print view's banner has New slip; slip Back links and `g h` go back instead of stacking Home again (`src/lib/nav-history.ts`); login replaces itself.
  - #12 SIS Feed & Mortality removed (`shedRows` optional, kept for old slips). #13 Qty 9 rem, Purpose wide, lines table from 768 px. #14 Ledger Folio typed per line (`lines[].ledgerFolio`).
  - #2 #5 Home Find (`/`, paper/system No., item, date → My slips; item searches show each slip's +/− qty). Today's slips = posted today, rows open the slip.
  - #4 #15 Excel (CSV with BOM, `src/lib/export.ts`) + PDF/print: full stock from Home and F8; item stock card with Last 7 days / This month / From–To, opening balance and totals.
  - Mock data version 2 (old demo data in browsers is replaced). Tests: 55, 3 runs green.

- 2026-11-05 — **Client's full item list in the demo** (`docs/source/All Inventory Items By Names.xlsx`)
  - `seed/items.json` = the 1,970 items in 18 categories, client spellings; Item No. = workbook position. Units guessed by name (VIAL / KG / LTR / BG / ROLL / QTY); Urdu names only on the ~60 everyday items, which keep their demo ids so the scripted history still runs. Feed Grower / Feed Layer Mash removed (not in the list); layers use Feed All.
  - Seed: every farm stocks the everyday items + ~6% of the rest; machines / furniture / scrap a handful each. `MOCK_VERSION` 3. Demo data in localStorage ≈ 0.8 MB.
  - Item search: an exact name / alias wins, then "starts with", shorter names first ("diesel" → Diesel Stock, not Diesel Motor 0.5HP). Items without Urdu show their category in search results and on F8.
  - F8: items at 0 hidden until searched for, a category is picked, or "Show N items at 0" (keeps the phone list ~150 rows instead of 1,970).
  - Tests: 56 green (search / keyboard cases moved to the client's names; new F8 test).
- 2026-11-21 — Qty boxes on IGP / OGP / SIS / receive were too narrow (1,000 showed as "00"): the unit suffix kept a fixed 3.5rem even with no unit. Suffix room now matches the unit's length, the suffix hides from 768 px where the Unit column shows it, qty / weight columns have minimum widths, slip screens widen to `max-w-5xl` on desktop. Test: `e2e/qty-width.spec.ts`.
- 2026-11-21 — **Back everywhere, forms never come back filled, Remarks.** `BackLink` on every farm and admin page except F1 / A1 (history back; direct open → up to the list, replacing). Admin layout tracks history too. `ResetOnHide` / `useOnHide` clear stock count, slip detail panels, A5 write-off, A6 reject, A8 / A9 editors when the page is hidden (`SlipForm` already did); slip forms `autocomplete="off"`. Optional **Remarks** (≤ 200, Urdu ok) on IGP, OGP and receive: after the lines, saved, on detail and print when filled. Tests: `e2e/navigation.spec.ts`, remarks rule in `rules.spec.ts`, OGP keyboard flow now goes empty item → Remarks → Save. 68 tests pass (3 runs).
- 2026-11-21 — **Admin enters slips for a farm (A12).** A2 has **New slip ▾** (IGP / OGP / SIS / Stock count) → `/admin/slips/new/[igp|ogp|sis|count]`. Top-bar farm preselected, otherwise "Which farm is this slip from?" first. Same forms via `CurrentFarmProvider` with `area="admin"` (saved-slip links go to A3, stock count to A4); Prepared by = admin. "Leave without saving?" moved out of `SlipScreen` into `LeavePrompt`. Print view's New slip returns admins to A12. Tests: `e2e/admin-entry.spec.ts` (4); 72 pass.
- 2026-11-21 — **Sheds hidden on A8.** Admin Farms page (now "Farms / فارمز") shows only name, code, type, active, Farm User; the shed list, Add shed, Rename / Deactivate shed are gone. Shed API (`addShed` / `updateShed`) and seeded sheds stay. Journey test now renames a farm instead of adding a shed. 72 pass.
- 2026-11-21 — **Return unused after an SIS** (client use case: 1,000 LTR diesel issued, 800 used → 200 back). "Return unused / بچا ہوا واپس" on a saved SIS (F7 farm, A3 admin): sheet with Qty returned per line (≤ issued − returned), Return date, Remarks, live stock preview; keyboard: Enter / Ctrl+S / Esc. The SIS stays as issued and shows Returned + Used columns and a "Returned unused" list (also printed). Stock up on the return date; stock card row "SIS-… Returned". Admin cancels a wrong return with a reason. Engine: `returnUnused`, `cancelReturn`, `returnsOf`; correction can't go below returned; SIS cancel reverses issued − returned. New `SISReturn` type, `MOCK_VERSION` 4 with one seeded return (AW-01). Consumption report counts returns. Tests: +4 rules, +1 journey, +1 phone; 78 pass.

- 2026-11-24 — **Backend: real database, login and server-side rules; mock removed.** Stack per `09-backend-architecture.md`, with Prisma instead of Drizzle.
  - PostgreSQL 17 (Docker Compose, port 5433) + Prisma 7 (`prisma/schema.prisma`, first migration adds an append-only trigger on `AuditEntry` and a unique paper-No. index). Dates stay text in Pakistan time; `today()` / `nowStamp()` use `Asia/Karachi` explicitly.
  - Engine ported to `src/server/services/` (slips, transfers, corrections / cancel, returns, stock counts, stock, reports, dashboard, setup). Every save: one transaction, advisory lock per farm touched, idempotency key, same Zod schema with a `RuleContext` loaded from the DB, number from `Counter`.
  - 34 route handlers under `src/app/api/`; `src/lib/api/http.ts` keeps the old function names, so screens didn't change. Permissions: a Farm User only reaches their own farm (+ the other side of a transfer); admin-only actions 404 for them; `preparedBy` / `by` / farm taken from the session.
  - Login: username + password (bcrypt), httpOnly session cookie, `GET /api/me`; S1 rebuilt (Enter → Password → sign in), Sign out on F1 and the admin top bar, `src/proxy.ts` redirects without a cookie. Messages added EN + UR.
  - Seed: `db:seed:base` (farms, 1,970 items, logins with random passwords) and `db:seed` (+ the old demo history, through the services; logins `demo1234`). `/dev` demo controls removed.
  - Bugs the network exposed: SIS summary sheet used 0 as "before" while stock was loading (blocked Confirm) — now fills in when stock arrives; F7 "Corrected on … by …" read the audit log, so a Farm User can read their own farm's entries.
  - Live data: refetch on focus + every 30 s on dashboard, slips, transfers, corrections (replaces the cross-tab event).
  - Tests: test DB reset + seeded before each run; rules on the services with a throwaway farm per test; `e2e/backend.spec.ts` (+9: races for the last stock, double receive, parallel retries, audit trigger, sign-in, farm scoping, error JSON). Journeys use one browser context per user. 87 pass, 3 runs green.
- 2026-11-24 — **Deployed with the backend on Vercel**: Neon Postgres (free, Singapore) via the Vercel Marketplace, functions in `sin1` (`vercel.json`), migrations + `db:seed:base` run once (no demo data). Logins handed to the developer once. See `docs/kb/09-backend-architecture.md` → Vercel.

- 2026-11-26 — **Client issues 20–30 (sheet rows of 24–25 Nov)** — tracker now in `docs/client-issues.md` (decisions + status per row, for parallel sessions).
  - #20 item search: the highlighted option is solid green (`.combo-option`) and scrolls into view with ↑ / ↓ (it was a faint tint, easy to miss). #22 Tab picks the highlighted option; typed text that isn't a picked item can't be left with Tab / Enter.
  - #21 decimals for every unit (0.5 Qty / ROLL): `QtyInput` always takes a dot; the server's whole-number rule is gone (`checkItemAndUnit` → `checkItem`, `allowsDecimals` removed).
  - #23 unit `MAUND` (من); Rice Husk BG → MAUND (seed + migration `20261126000001_rice_husk_maund`). Existing Rice Husk movements on the live DB keep their numbers, now read as Maund.
  - #24 IGP: received above challan → amber "n more than the challan — check the quantities" (warning only, developer's call).
  - #27 a new slip starts on the last saved slip's date in this tab (`src/lib/slip-date.ts`, sessionStorage per farm, cleared on sign out), amber "Not today's date".
  - #29 OGP saves like IGP / SIS: blank form + "saved" banner with Print / View / New slip; print view's just-saved banner and `?saved=1` removed.
  - #30 item requests: Farm User's "+" beside item search / Enter on "No item found" → Request a new item dialog (portal; Enter / Ctrl+S / Esc). `ItemRequest` table + `/api/item-requests` (+ `/[id]/approve`, `/[id]/reject`); approve creates the Item in the same transaction via the `saveItem` rules. A1 tile "New item requests" → A9 **Requested** tab (approve with edits / reject with reason). Audit `request_item` / `approve_item` / `reject_item`.
  - Skipped (developer): #25, #31. Waiting for the client: #26 (bag ↔ kg for feed), #28 (duplicate items).
  - Tests: `e2e/client-issues.spec.ts` (6) + item-request service test; whole-number test now a decimal test; OGP tests follow the banner's Print link; F8 count test reads the item count from the API. 94 pass, 3 runs green (one earlier run had 2 admin-entry saves time out once; not reproduced).
  - Deploy needs `prisma migrate deploy` on Neon (3 migrations).
- 2026-11-28 — **Tracker + T01** — `TRACKER.md` + `scripts/tracker.sh` for parallel sessions, one plan per task in `docs/plans/` (T01–T06 from the developer's list).
  - T01: "Request a new item" ("+" and Enter on "No item found") only on the IGP; `SlipLines` takes `allowRequest` (default off), only `igp-form.tsx` passes it. OGP / SIS / receive-transfer / admin entry don't offer it. Test: `e2e/client-issues.spec.ts` "T01 …"; the #30 farm-only test now uses the IGP. 95 pass.
## Next
- [ ] Client to confirm item units, Urdu names, duplicates / spelling variants, Discard & Scrap (open questions in `07`) — #26 / #28 in `client-issues.md`
- [ ] Item requests: show the farm its rejected requests + the Admin's note (now only the audit log has it)
- [ ] Stock count (F10) lists every item in the chosen category ("All" = 1,970 rows): consider counting by category only
- [ ] Client to check the new slip header (paper No. + dates) and the SIS without feed on their phone
- [ ] Admin reports: wire their Excel button to the same CSV export
- [ ] Client to confirm Return unused: no paper note for returns? Farm User allowed without the Admin? (defaults in `07`)
- [ ] Return unused: "Returned" chip on F6 / A2 slip cards (not built yet)
- [ ] Optional SIS shed chip on Purpose of Use
- [ ] Shared PDF file (react-pdf with the Urdu font) instead of sharing the print link
- [ ] Testing roadmap gaps: print/PDF checks, screenshot baselines, axe, performance budget, fixed test clock
- [ ] Then: Urdu review, real phone + printer, client demo
- [ ] **Hosting**: Dockerfile (`output: "standalone"`), AWS App Runner + RDS + Secrets Manager, `prisma migrate deploy` on release. The Vercel demo stops working without a database — point it at a hosted Postgres or move the demo to AWS
- [ ] Next.js reported a security advisory for 16.4.3 during `next build`: upgrade Next.js
- [ ] Opening balances: import the client's counts (CSV → movements `slipId: "opening"`), then the two-week pilot
- [ ] Users: change / reset password (A10), add / deactivate users; today only the seed creates logins
- [ ] Paging or date limits for `listSlips` and reports once there's a year of data
- [ ] Optional: server-sent events instead of 30 s polling

## Decisions log
- 2026-11-24 — Backend built: TypeScript route handlers in the same Next.js app + PostgreSQL with **Prisma 7** (chosen over Drizzle), full cutover, **mock removed** (one code path; the demo is a seeded database). Login = username + password with a DB session cookie (no Auth.js). Saves serialise per farm with Postgres advisory locks. Hosting (App Runner) still to do.
- 2026-11-24 — Backend proposal written (`docs/kb/09-backend-architecture.md`): TypeScript in the same Next.js app (reuses engine + Zod schemas) over FastAPI; PostgreSQL; one container on AWS App Runner (moving off Vercel).
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
- 2026-11-03 — Paper slip No. typed by the farm and shown everywhere on the farm side; the automatic system number is kept (unique across farms, used in URLs, QR, transfers, admin). Repeats refused per farm + type.
- 2026-11-03 — Slip date changeable up to 30 days back, never future (**superseded 2026-11-16**: no lower limit, client #18); stock is checked against today's stock regardless of the date. Posted-on stamp kept separately.
- 2026-11-03 — SIS Feed & Mortality removed (client: mortality isn't stock, feed is an item). API still accepts and shows old shed rows.
- 2026-11-03 — No slip drafts: a slip left without saving starts empty next time (replaces the planned sessionStorage draft).
- 2026-11-03 — Excel export = CSV generated in the browser (no backend, no extra library).
- 2026-11-05 — Demo uses the client's 1,970 items as written; units and missing Urdu names are our defaults until the client confirms.
- 2026-11-21 — Back = browser history back (was: "up" to a fixed parent). A page opened directly has no in-app history, so Back goes up and replaces itself. Admin list pages get Back too (→ Dashboard), per "Back everywhere except Home".
- 2026-11-21 — Remarks: one optional note per IGP / OGP (not per line), label "Remarks / ریمارکس", after the lines. Not on SIS (it has Purpose of Use per line). The paper slips' field lists show no remarks box — confirm label and position with the client.
- 2026-11-21 — Admin slip entry: only for paper slips already received from a farm, so the paper No. stays required. Receiving a transfer is not offered to the admin (stays with the receiving farm). Farm is fixed once the form opens; the OGP print's New slip asks for the farm again when the top bar is on All farms.
- 2026-11-21 — Sheds not handled separately for now: hidden from the admin Farms page (A8). Data and API kept so they can come back.
- 2026-11-21 — Leftover after an SIS is a **return linked to the SIS**, not a correction (correction needs the Admin, changes the paper figure and puts stock back on the issue date) and not an IGP (would look like a purchase). Farm User can do it; only the Admin cancels one. No paper No. (`AW02-SIS-0484-R1`). Saved straight from the sheet with a live stock preview instead of a separate summary sheet: a return only adds stock.
- 2026-11-16 — Slip date has no lower limit (client #18: "enable all dates, including previous months"). Back-dated slips are still checked against today's stock, not stock on that date.
