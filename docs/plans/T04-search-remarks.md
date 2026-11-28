# T04 — Farm slip search also finds remarks and descriptions

**Tracker:** T04 · **Priority:** Normal
**Decision (developer, 28 Nov 2026):** the Farm User's slip search should also match the free text on slips — remarks and descriptions — not only slip No. and item.

## Today
`src/features/farm/my-slips.tsx` (F6, also reached from Home's Find via `?q=`) filters on `s.no`, `s.paperNo` and the names/aliases of the slip's items (`normalizeSearch` from `src/lib/format.ts`, which also normalises Urdu letters).

## Change
1. `src/lib/slips.ts`: `slipSearchText(slip)` → one string of the slip's free text:
   - IGP: `remarks`, `source.ms` (M/s), `biltyNo`, `truckNo`, `driverName`, `demandNo`, `challanNo`
   - OGP: `remarks`, `to.ms`, `vehicleNo`, `driverName`
   - SIS: each line's `purpose` (Purpose of Use) and `ledgerFolio`
   - source/destination farm name if cheap (farm list from `useFarms`) — optional
2. `my-slips.tsx`: match `normalizeSearch(\`${s.no} ${s.paperNo} ${slipSearchText(s)}\`)` before falling back to items.
   When the match came from the text (not an item), show the matching remark/purpose under the slip (one muted line, truncated) so the user sees *why* it matched.
3. Placeholder `slips.search` (EN + UR in `src/messages/*.json`): mention remarks, e.g. "Slip No., item or remarks".
4. Optional: Admin All slips (`src/features/admin/all-slips.tsx`) reuses `slipSearchText` if it has a search box.

## Tests (`e2e/search.spec.ts`)
- Save an IGP with remarks "broken tap" → F6 search "broken" lists it.
- Save an SIS with Purpose of Use "shed 3 repair" → search "repair" lists it.
- Urdu remark found with ی/ي variants.

## Done when
Lint + e2e green; checked in the browser as `aw02`.
