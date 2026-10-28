@AGENTS.md

# AW Farms Inventory — Frontend (Phase 1)

Web app replacing paper slips + QuickBooks re-typing for 11 poultry farms. Each farm's one data-entry person fills in **the same three paper slips** — Inward Gate Pass (IGP), Outward Gate Pass (OGP), Stock Issue Slip (SIS) — and stock updates on save. One Accounts Admin sees all farms live. **Quantities only, never money.**

**Current scope: frontend only**, running on a mock API in the browser. No backend, DB or real auth (login = mock role + farm picker).

## Knowledge base — read before building a feature
`docs/README.md` indexes everything. Key files:
- `docs/kb/01-domain.md` — glossary + **hard rules** (no negative stock, auto slip numbers, nothing deleted…)
- `docs/kb/02-screens.md` — all 23 screens, routes, field-by-field slip specs
- `docs/kb/03-data-and-api.md` — types + API contract + mock seed
- `docs/kb/04-design-system.md` — tokens, bilingual rules, components C1–C12
- `docs/kb/05-keyboard-entry.md` — **keyboard-first entry rules**
- `docs/kb/06-states-and-print.md` — states/messages, print layout
- `docs/kb/07-roadmap-and-open-questions.md` — build order, open questions + defaults
- `docs/kb/08-testing-roadmap.md` — what to test each week; update its rule map and coverage when tests land
- `docs/progress.md` — **update at the end of every session** (done / next / decisions)

Originals in `docs/source/` (requirements.md, design spec PDF with paper slip photos). Source wins over KB.

## Non-negotiables
1. **Very simple design.** Plain, high-contrast, looks like the paper slip. No decoration or animation. Fast entry beats pretty.
2. **Keyboard-first.** Every slip fillable without the mouse: Enter → next field, Enter on last line field → new line, ↑/↓/Enter in item search, Ctrl/⌘+S or Ctrl/⌘+Enter to save, Esc closes sheets. Also works fully by touch on a 360 px phone. See `docs/kb/05-keyboard-entry.md`.
3. **Client's words everywhere** — Inward Gate Pass, M/s, Bilty No., Qty As Per Delivery Challan, Ledger Folio, Purpose of Use, Mort Male/Female… No accounting jargon in Farm UI.
4. **Bilingual EN + UR on every label/button/title** via `<Bi>`; strings only in `src/messages/en.json` / `ur.json`, never hard-coded. Page stays LTR; Urdu elements get `dir="rtl" lang="ur"`; free text `dir="auto"`; digits always 0–9. No fixed heights around Urdu (Nastaliq is tall).
5. **Screens only call `src/lib/api`** — through the hooks in `src/lib/api/queries.ts`. Never import `src/lib/api/mock/*` from screens. The API types are the future backend contract.
6. **Balances are derived from movements** (`src/lib/stock.ts`), never stored or typed.
7. **Rules live in Zod schemas + the mock API**, with identical error messages ("Only 6 in stock").
8. Unit always comes from the item; not editable on a line.
9. Farm-User-forbidden actions are **hidden**, not disabled.

## Stack
Next.js 16 (App Router, `src/`) · TypeScript strict · Tailwind CSS 4 (tokens in `src/app/globals.css` `@theme`) · shadcn/ui (Radix) restyled plain · React Hook Form + Zod · TanStack Query over `src/lib/api` · Fuse.js with Urdu letter normalisation (ی/ي, ک/ك) for item search · lucide-react icons · Inter + Noto Nastaliq Urdu (self-hosted) · print CSS + react-pdf for shared PDF · mock store in memory → localStorage, seeded from JSON, "reset demo".

Deliberate simplifications vs the spec: bilingual strings use a small typed helper over `en.json`/`ur.json` instead of next-intl (both languages render together, no locale routing). Storybook deferred — add only if a client component review needs it.

This Next.js version is newer than training data — check `node_modules/next/dist/docs/` before using Next APIs (see AGENTS.md).

## How the pieces fit (week 2)
- **Mock backend**: `src/lib/api/mock/` — `engine.ts` (rules: save, receive, correct, cancel, count), `seed.ts` (two weeks of history through the engine), `store.ts` (localStorage, writes on a copy), `index.ts` (async API with latency). Reset from `/dev`.
- **Session**: `src/lib/session.ts` (per tab). `FarmGate` / `AdminGate` guard the areas; below `FarmGate` use `useCurrentFarm()` for the farm and user name.
- **Rules**: Zod schemas in `src/features/*/schema.ts` + helpers in `src/lib/validation.ts`; messages are message ids.
- **Component review**: `/dev` shows C1–C12 on live data + demo controls (reset, latency, failing saves). It replaces Storybook for now.

## Structure
```
src/
  app/
    login/                    S1
    print/[slipId]/           S2
    (farm)/farm/...           F1–F10 (phone-first, bottom nav)
    (admin)/admin/...         A1–A11 (desktop-first, sidebar)
  components/
    ui/                       shadcn primitives (restyled)
    slip/                     C1 item search, C2 qty input, C3 lines, C4 header, C9 summary, C12 print frame
    layout/                   farm shell, admin shell, C5 <Bi>, C6/C7 chips, C8 farm picker, C10 table, C11 filter bar
  features/igp|ogp|sis|stock-count/   slip forms, Zod schemas, summary logic
  lib/
    api/index.ts              typed API functions (the contract)
    api/mock/                 store, seed JSON, latency/failure simulation
    stock.ts                  balance from movements
    keyboard/                 useEnterToNext, useShortcut, focus manager
  messages/en.json, ur.json
  types/domain.ts             Farm, Item, IGP, OGP, SIS, Transfer, Movement…
docs/                         knowledge base (see above)
```

## Conventions
- Server components by default; `"use client"` only for forms/interactive parts.
- Slip numbers: `AW02-IGP-1663` (farm code without dash + type + 4 digits), per farm sequence.
- Numbers: `tabular-nums`, right-aligned in tables, thousands separators on display.
- Every list/slip screen implements loading (skeleton), empty, and error states.
- Visible focus ring always; never remove outlines without replacement.
- Open client questions: use the default in `07-roadmap-and-open-questions.md` and keep going.
- Messages: add every key to **both** `en.json` and `ur.json` (missing Urdu keys fail type-checking). Use `{n}` placeholders; `t()` keeps values LTR inside Urdu.
- Slip field names follow `lines.N.key` / `shed.N.key` (the SIS summary reads them from FormData).
- Keyboard: put shared behaviour in `src/lib/keyboard/`; Enter handlers must respect `e.defaultPrevented` (combobox → line → form order).
- New slip type or form: a client component in `src/features/<slip>/` that renders `SlipForm` with `build` (form → API input + screen rows) and `save` (an `api.*` function). Pages stay thin server components.
- Dialogs: React's `autoFocus` does nothing in a `<dialog>` opened later — call `.focus()` on a ref right after `showModal()`.
- Component CSS goes in `@layer components` in `globals.css`, or Tailwind utilities can't override it.

## Next.js 16 pitfalls (Cache Components is on)
- `usePathname()` / `useSearchParams()` in a shared layout must sit inside `<Suspense>` with a fallback (see `AdminNav` / `AdminNavLinks`).
- Pages reading `params` need `generateStaticParams` or a `<Suspense>` boundary, or the build fails on prerender.
- `PageProps<'/route'>` / `LayoutProps` are global and generated by `next dev` / `next build`; plain `tsc` fails until one of those has run.

## Commands
```
npm install      # if the global npm cache errors with EACCES: npm install --cache /tmp/npm-cache
npm run dev      # http://localhost:3000 → redirects to /login; /dev = components + demo tools
npm run build
npm run lint
npm run test:e2e # build + Playwright (rules on the engine, keyboard, search, data, phone). Uses installed Chrome.
npm test         # Playwright against an already-built app
```
Add a Playwright test for every new keyboard path or rule. In tests, `<select>` and `<option>` also have the combobox/option roles — target item search with `[data-kind="item"]` and `li[role="option"]`.
