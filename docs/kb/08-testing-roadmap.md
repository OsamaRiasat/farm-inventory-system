# 08 · Testing roadmap

How the app is tested from now (end of week 2) to client sign-off, and after the backend arrives. Update the **Coverage** and **Rule map** tables as tests land.

## Principles
1. **Every business rule has an automated test**, run on the engine (fast, no browser) *and* at least once through the screen.
2. **Every keyboard path has an end-to-end test.** Keyboard-first is the product's main promise; it breaks silently.
3. **Test on the client's reality**: 360 px Android with throttled CPU, office PC at 1366 × 768, real A5/A4 printer, a native Urdu reader.
4. **Deterministic data**: the seed is fixed; tests that change data use a fresh browser context, so they never depend on each other.
5. A week isn't done until `npm run test:e2e` passes and the new screens have tests.

## Test layers

| Layer | What | Tool | Where | Runs |
| --- | --- | --- | --- | --- |
| 1. Static | Types (incl. every Urdu key present), lint | `tsc`, ESLint | — | Every change |
| 2. Rules | Engine + Zod schemas: stock, numbering, transfers, corrections, cancel, idempotency, seed invariants | Playwright (no browser, `rules` project) | `e2e/rules.spec.ts` | Every change, < 2 s |
| 3. Search | Item search cases: English, Urdu, mixed, number, alias, typo, recent | Playwright | `e2e/search.spec.ts` | Every change |
| 4. Keyboard | Enter flow, line add/remove, pick, save, Esc, shortcuts, tables | Playwright (desktop) | `e2e/keyboard.spec.ts` | Every change |
| 5. Journeys | A user's whole task across screens (farm saves → admin sees) | Playwright, 2 contexts | `e2e/journeys/*.spec.ts` (week 3+) | Every change |
| 6. Phone | 360 px: cards, full-screen search, no horizontal scroll, touch targets ≥ 48 px | Playwright (phone project) | `e2e/phone.spec.ts` | Every change |
| 7. Visual | Screenshot baselines of key screens, EN-first and UR-first | `toHaveScreenshot` | `e2e/visual.spec.ts` (week 4) | Before each client demo |
| 8. Accessibility | Labels, focus order, contrast, dialogs | `@axe-core/playwright` + manual keyboard pass | `e2e/a11y.spec.ts` (week 5) | Weekly |
| 9. Print / PDF | A5/A4 layout, one page, empty rows not printed, stamp, Urdu font in PDF | Playwright `page.pdf()` + real printer | `e2e/print.spec.ts` (week 4) | Weekly + week 7 |
| 10. Performance | Low-end phone: load, item search keystroke, save | Playwright CPU throttling + Lighthouse | `e2e/perf.spec.ts` (week 6) | Weekly |
| 11. Manual / UAT | Client walk-through, Urdu review, device + printer checks | Checklists below | — | Weeks 4, 7, pilot |

## Week by week

### Week 3 — saving for real (F1, F2, F3, F5)
- Journey: **New IGP saved** → Saved banner shows the real number (`AW02-IGP-1663`), form clears, focus on "New slip", farm stock goes up by Qty Actual Received.
- Journey: **SIS** → summary sheet before → after equals the API's stock; after Confirm, the new balances are the "after" figures.
- Journey: **Receive transfer** → transfer leaves "Waiting to receive"; short receipt → admin dashboard "Open shortfalls" +1.
- **Field errors**: an `ApiError` from the save appears under the right field (e.g. a second tab used the stock first → "Only 6 in stock" on that line).
- **Not saved**: with "fail every save" on (`/dev`), the red banner shows, everything typed stays, and saving again works once the toggle is off.
- **Double save**: two fast Enters / clicks → one slip (check the count through `listSlips`).
- **Draft**: reload a half-filled slip → restored; Back with changes → "Leave without saving?" with focus on Stay.
- Rules: SIS with only Feed & Mortality saves; empty shed rows are skipped; mortality doesn't change stock.

### Week 4 — OGP, transfers end to end, history, print
- Journey (two browser contexts): **AW-02 sends an OGP to AW-05 → AW-05 sees it waiting → receives 8 of 10 → admin sees "short"** — the main transfer story from the requirements.
- OGP to an outside party for repair → listed as out for repair.
- F6 My slips: search by No., item, type chips, date; F7 detail matches what was saved.
- F8 farm stock: every quantity equals the sum of that item's movements (compare with `getStockCard`); zero items greyed at the bottom.
- **Print** (`page.pdf()` in print media): one A5 page for a 10-line slip, empty rows absent, Prepared by printed, stamp on corrected / cancelled, QR code decodes to the slip URL. On an OGP to a farm, the QR opens F3 at the receiving farm.
- Visual baselines for F1–F5 at 360 px and 1280 px, in both language orders.
- **First client demo checklist** (manual, below).

### Week 5 — Accounts Admin (A1–A5)
- A1 tiles equal counts computed from the API; each tile opens the matching filtered list.
- A2 filters combine (farm + type + dates + item); search by No.; keyboard ↑ ↓ Enter [ ].
- A3 **Correct**: before / after shown, reason required, original marked corrected with links both ways, stock moves by the difference only. **Cancel**: reason required, refused for a received transfer's OGP, refused when stock would go below zero.
- A4 matrix: each All Farms cell = the sum of the farm columns; In transit column = open transfers; sticky column and header while scrolling.
- A5 Resolve shortfall: written off with a reason, leaves the "Open shortfalls" tile.
- **Permissions in the UI**: a Farm User never sees admin actions (hidden, not disabled), and farm URLs only show their own farm.
- Accessibility pass with axe on every screen built so far.

### Week 6 — P2 screens (F9, F10, A6–A11)
- F9 stock card: the running balance's last row = F8 quantity; opening balance first.
- F10 stock count: difference highlighted, reason required, stock equals counted afterwards, the count appears on the stock card.
- A6: approving opens A3 pre-filled; rejecting shows the note on F7.
- A7 reports reconcile: consumption = sum of SIS lines + feed; feed & mortality totals = sum of shed rows; transfers report = A5.
- A11 audit log: every save / correct / cancel / count from this week's tests appears with user, time, old → new, reason; no way to edit or delete.
- Performance budget (below) checked weekly from now on.

### Week 7 — readiness
- **Urdu review** with a native reader: every label, the Nastaliq rendering (no clipped descenders), numbers and dates staying LTR inside Urdu, and the slip names (open question).
- **Devices**: a low-cost Android phone (the farms' actual model, an open question) on 3G-like network; office PC at 1366 × 768.
- **Real printer** at A5 and A4, Urdu included; WhatsApp PDF share on the phone.
- Full regression run plus a manual keyboard-only pass of every slip.
- Sign-off checklist (below) with the client.

### After phase 1 — when the real backend arrives
- **Contract tests**: the same `rules.spec.ts` cases run against the mock and the real API (one suite, two adapters); same inputs give the same errors.
- **Auth and permissions** server-side: a Farm User can't read or write another farm's data even by editing the URL or request.
- **Concurrency**: two saves using the last stock at once, so exactly one wins; receiving a transfer twice at once.
- **Idempotency** across network retries; **audit log** immutability.
- **Migration**: opening balances loaded = the client's counts.
- **Pilot (from the requirements)**: two weeks at one farm with paper and app side by side; daily reconcile app balances against the paper slips; go-live only when they match for two weeks.

## Rule map (from 01-domain.md)

| # | Rule | Engine test | Screen test | Status |
| --- | --- | --- | --- | --- |
| 1 | Save is final, stock changes at once | IGP raises stock | IGP / SIS save journeys | ✓ |
| 2 | Stock never below zero, "Only n in stock" | OGP/SIS over stock; same item on two lines | OGP keyboard test | ✓ |
| 3 | Balances from movements only | Seed invariants | A4 All Farms = sum of farms | ✓ |
| 4 | Automatic numbers per farm (`AW02-IGP-1663`) | IGP number format; real slip numbers in the seed | Saved banner shows `AW02-IGP-nnnn` | ✓ |
| 5 | Farm, date, time, number, Prepared by on every slip | Schemas require them | Week 3 | Partly |
| 6 | Unit comes from the item, not editable | — | Week 3: Unit never focused or editable | Todo |
| 7 | Nothing deleted; corrections point to the original | Correction keeps the original | Request → approve → original "Corrected" | ✓ |
| 8 | Received transfer's OGP can't be cancelled | Transfer test | Week 5 A3 | Engine ✓ |
| 9 | Can't receive more than sent | Transfer test | Receive keyboard test | ✓ |
| 10 | Shortfall is amber, still saves | Transfer → short | Transfer journey (short, written off) | ✓ |
| 11 | In transit > 2 days flagged | — | Admin dashboard test | Screen ✓ |
| 12 | Double save → one slip | Idempotency test | Save button disabled while saving; key per slip | Engine ✓ |
| — | Whole numbers only for Qty items | Whole-number test | Week 3 | Engine ✓ |

## Coverage today (all screens built, before the backend)
45 tests, all passing, 3 repeated runs with no flakes (135/135): 8 rules · 10 search · 6 keyboard · 6 data · 2 phone (no sideways scroll on all 9 farm routes) · 13 journeys (IGP/SIS save + stock change, save errors, Not saved, leave prompt, transfer end to end in two tabs incl. QR target, correction request → approve, cancel, stock count, my slips search, A4 totals, reports + chart, setup + audit).

Still to add: print/PDF page checks (`page.pdf()`), screenshot baselines, axe accessibility, performance budget, fixed test clock.

## Infrastructure to add
- **Fixed clock for tests**: the seed is built around "now", so a run just after midnight sees few slips "today". Add a mock option (e.g. `awfarms.mock.now`) that tests set, so dates are stable.
- **Test ids**: keep using roles and `data-kind` / `data-search`; add `data-testid` only where no stable role exists.
- **CI**: the project isn't a git repository yet. Once it is, run `npm run test:e2e` on every push (GitHub Actions with Chrome); keep traces on failure.
- **Journey helpers**: `asFarm(page, "aw02")`, `asAdmin(page)`, and a two-context helper for transfer tests.

## Performance budget (low-end Android, Playwright 4× CPU throttle, Fast 3G)
| Measure | Budget |
| --- | --- |
| Farm home usable (first slip button tappable) | < 3 s |
| Item search: keystroke → results | < 100 ms |
| Save → Saved banner (excluding network) | < 300 ms |
| JavaScript for the farm screens | < 250 KB gzipped |

## Manual checklists

**Client demo (weeks 4, 5, 7)**
- [ ] Reset the demo data on `/dev`; latency 300 ms
- [ ] Farm tab: fill the IGP, SIS and OGP by keyboard only; show "Only n in stock", "Short by n", and the summary sheet
- [ ] Admin tab beside it: the slip appears without a reload
- [ ] Print an OGP; share it as a PDF
- [ ] Switch to "Urdu first" and repeat one slip

**Sign-off (week 7)**
- [ ] All automated tests pass three runs in a row
- [ ] Urdu reviewed by a native reader; corrections applied
- [ ] Tested on the farms' phone model and the office PC
- [ ] Printed at A5 and A4 on the client's printer
- [ ] Every screen has its empty, loading, error and saved states
- [ ] axe: no serious or critical issues
- [ ] Performance budget met
- [ ] Open client questions answered or accepted defaults recorded
