# Client issue tracker

Mirror of the client's Google Sheet **Simple_Issue_Correction_List** (`16MGTnVAtsGPjkNLpRQs62mGXGybkuBZzKm_aPQiOCH8`, tab "Correction List").
The sheet is where the client reports; this file is where sessions agree on what each row means and where it stands.
Rows 1–19 are done (see `progress.md`, 3–21 Nov 2026). Rows 20–24, 27, 29, 30 done 26 Nov 2026 in code + tests (`e2e/client-issues.spec.ts`), **not yet deployed** (needs `prisma migrate deploy` on Neon: Maund unit, Rice Husk, ItemRequest table).

**How to use**
- Before working on an issue, read its row here; when you start one set it to `in progress`, when finished `done` with the commit / test, then update `progress.md`.
- The Drive export drops pictures and sometimes later rows — ask the developer for screenshots.
- Work on these rows is claimed on `TRACKER.md` (repo root) when a row has a T-number.
- Status values: `todo` · `in progress` · `done` (in code, not yet deployed) · `deployed` · `waiting client` · `skipped`.
- Decisions taken with the developer go under the row, so no one re-asks.

| # | Date | Issue (short) | Decision / plan | Status |
|---|---|---|---|---|
| 20 | 24-11 | Item search: ↑/↓ + Enter to pick, no mouse ("THER" → Thermos, Thermameter…) | Arrows worked but the highlight was a faint tint and didn't scroll into view. Now solid green, kept in view; Enter / Tab pick it | done |
| 21 | 24-11 | Decimal qty: `0.5` shows `05` (Barfi Jali) | Cause: Qty only allowed a dot for units marked decimal (QTY isn't). Allow decimals for every unit, saved and shown as typed | done |
| 22 | 24-11 | Tab from item search with no item picked jumps to Qty ("NY") | Tab stays in item search until an item is chosen; Tab with a highlighted option picks it | done |
| 23 | 24-11 | Rice Husk unit Bags → Maund (Mann) | Add unit `MAUND` (من) if missing; change seed + live DB | done |
| 24 | 24-11 | Qty challan vs received should match (Vent Spring 4 vs 61) | **Warn only** (developer, 26-11): when they differ, show a warning; don't block moving on or saving | done |
| 25 | 25-11 | After sign out can't go back / reach Admin | **Skipped** (developer, 26-11): unclear, doesn't make sense as written | skipped |
| 26 | 25-11 | Feed received in Bags, used in KG — add Bag unit | Needs unit conversion (bag weight per item). Waiting for client's answer. **28-11 developer: Feed All lines take Bags + KG, both typed; stock stays KG → `TRACKER.md` T03** | todo |
| 27 | 25-11 | Slip date resets to today; posting old-month slips means changing it every time | Remember the last chosen slip date for the next new slip (until changed / sign out) | done |
| 28 | 25-11 | Duplicate items (Regulator in Shed Items and Stock in Store; 23 names twice) | Waiting (developer, 26-11): list to client, they choose which to keep; merge movements. **28-11 developer: merge all; keep the Stock in Store copy, else lowest Item No. → `TRACKER.md` T02** | todo |
| 29 | 25-11 | OGP still opens View after save (reported before as #10) | After save stay on a blank new form with "Saved … — View / Print" | done |
| 30 | 25-11 | Farm staff add new items from IGP; Admin notified | **"+" next to item search → pop-up (name, Urdu name, category, unit)**. Creates an item *request*, not an item — it is not in the list until the Admin approves. A9 Items gets a "Requested" filter with Approve / Reject (developer, 26-11) | done |
| 31 | 25-11 | Number each category so typing a number opens it | **Skipped** (developer, 26-11): client's example is cut off | skipped |
