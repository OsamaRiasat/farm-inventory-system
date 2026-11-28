# T01 — "Request a new item" only on the IGP

**Tracker:** T01 · **Client #:** follow-up to #30 · **Priority:** High
**Decision (developer, 28 Nov 2026):** the "+" beside item search and Enter on "No item found" open *Request a new item* **only on the Inward Gate Pass**. OGP and SIS can only send out / issue what the farm already has, so a brand-new item makes no sense there.

## Today
`src/components/slip/slip-lines.tsx` (~line 198) passes `allowRequest={area === "farm"}` to every line's `ItemPicker`, so OGP, SIS and receive-transfer all show it.

## Change
1. `SlipLines` gets a prop `allowRequest?: boolean` (default `false`); the line passes `allowRequest && area === "farm"` to `ItemPicker`.
2. `src/features/igp/igp-form.tsx`: `<SlipLines cols={cols} rules={{ shortfall: true }} allowRequest />`.
3. OGP (`src/features/ogp/ogp-form.tsx`), SIS (`src/features/sis/sis-form.tsx`), receive-transfer (`src/features/igp/receive-transfer.tsx`): no change (default off).
4. Admin entry (`/admin/slips/new`) stays without it (already `area !== "farm"`).

## Tests (`e2e/client-issues.spec.ts`, next to the #30 tests)
- Farm IGP: the "+" request button is visible; typing an unknown name + Enter opens the dialog (existing test).
- Farm OGP and SIS: no "+" button (count `:visible`); unknown name + Enter does **not** open the dialog.

## Done when
Lint + `npm run test:e2e` green; checked in the browser as `aw02`.
