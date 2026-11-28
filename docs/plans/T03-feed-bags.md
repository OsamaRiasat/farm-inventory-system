# T03 — Feed All: Bags + KG on slip lines

**Tracker:** T03 · **Client #:** #26 · **Priority:** High
**Decision (developer, 28 Nov 2026):** Feed arrives and goes out in bags but stock is kept in KG. On a **Feed All** line the farm types **both**: KG (the existing Qty fields) **and** the number of **Bags**. Bags is **required** on Feed All lines, a whole number > 0. Stock and every balance stay in KG; bags are recorded and shown, not converted. Only items with `isFeed = true` (today: Feed All, `feed-all`, KG).
"Reflect live when deployed" → the new column ships as a Prisma migration (`prisma migrate deploy` on Neon).

## Change
**Data**
- `prisma/schema.prisma`: `SlipLine.bags Int?` + migration `<timestamp>_slip_line_bags` (if T02 landed first, use a later timestamp).
- `src/types/domain.ts`: `bags?: number` on IGP, OGP and SIS line types. `src/server/mappers.ts` reads/writes it. Check `src/lib/api/types.ts` save inputs.
- Corrections copy lines → carry bags. Transfers: the receiving IGP's lines are prefilled from the OGP → prefill bags too.

**Rules** (same Zod schema runs in the browser and on the server)
- Shared helper in `src/lib/slip-rules.ts`, used by `src/features/igp/schema.ts`, `ogp/schema.ts`, `sis/schema.ts`:
  item `isFeed` → `bags` required, integer ≥ 1 → message id e.g. `err.bagsRequired` "Enter the number of bags" / Urdu; non-feed item → bags ignored (dropped in `build`).
- Server services (`src/server/services/slips.ts`, corrections, transfers) store `bags`.

**UI** (`src/components/slip/slip-lines.tsx`)
- New `LineCol` kind `"bags"`, label `line.bags` ("Bags" / "بوریاں" — confirm Urdu), width ~`minmax(5rem, 0.6fr)`.
  IGP: after Qty Actual Received; OGP and SIS: after Qty.
- Input only renders when the row's item `isFeed`; for other items the cell is empty and not focusable.
- Keyboard: Enter moves item → qty… → bags → next field; `data-line-last` must be on the last **rendered** editable field of that row (today it's computed from `cols` once — make it per row). Ctrl/⌘+S and the "Enter in empty line → Save" path unchanged. Add a Playwright keyboard test (CLAUDE.md rule).
- Phone (360 px card): Bags shows under the qty fields, same as other fields.
- Use `QtyInput` in whole-number mode, or a plain numeric input with `inputMode="numeric"`.

**Show bags everywhere a line shows**
- Print (`src/features/print/print-view.tsx`): Bags column, or "1,250 KG (25 bags)" in the qty cell — pick what fits the paper layout in `docs/kb/06-states-and-print.md`.
- Farm / admin slip detail, SIS summary sheet before save (`src/components/slip/` C9), correction panel (`src/features/slip-detail/correct-panel.tsx`, editable), receive-transfer.
- Stock card movement rows: "(25 bags)" after the No. — optional, if cheap.

**Seed**: `src/server/seed/demo.ts` feed lines get `bags = Math.round(kg / 50)`.

**Docs**: `docs/kb/02-screens.md` (field lists), `03-data-and-api.md` (types), `05-keyboard-entry.md`, `client-issues.md` #26 → done.

## Tests
- `e2e/rules.spec.ts`: Feed All line without bags → refused with the message (server); with bags → saved, `bags` returned by the API; non-feed line with bags → bags not stored.
- Screen test: IGP with Feed All shows Bags, a non-feed item doesn't; keyboard Enter through bags reaches a new line; print shows the bags.
- Phone test (360 px): Bags field reachable.

## Deploy
`prisma migrate deploy` on Neon, then create a Feed All IGP on the live URL (or check with the developer first — live is the client's data).
