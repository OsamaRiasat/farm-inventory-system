# Work tracker

Shared status board for tasks that **several Claude sessions work on at once**.
Each task has its own plan doc under `docs/plans/` — read it before you start; it holds the decisions
already taken, so nobody re-asks. Client sheet rows stay in `docs/client-issues.md`; the "Client #" column links them.

## Rules for every session

1. **Never edit the Status / Owner / Updated / Commit / Verified columns or the Log by hand.** Use
   `scripts/tracker.sh` (works from the repo or any worktree; it always writes this file in the main checkout).
   It holds a lock while it writes and refuses to claim a row that isn't `pending`, so two sessions
   can't pick the same task.
2. **Claim before you touch code:** `scripts/tracker.sh next <who>` takes the highest-priority pending row,
   `scripts/tracker.sh claim T03 <who>` a specific one. Refused → someone has it; pick another.
3. **`<who>`** is a short label unique to your session, e.g. `s-t03-bags`. Use the same label throughout.
4. **Move the row forward:** `pending → working → worked → committed → deployed`
   - `working` — a session is on it now. Leave it alone.
   - `worked` — done locally: code + tests, `npm run lint` and `npm run test:e2e` green. Not committed.
   - `committed` — committed (and pushed) to `main`. Pass `--commit <short sha>`.
   - `deployed` — live on Vercel, **and** `prisma migrate deploy` has run on Neon if the task has a migration.
   - `blocked` — waiting on someone (say who / what in `--note`). `no-issue` — checked, nothing to do.
5. **Verified** is separate from Status: after checking in a real browser (local dev, or the live URL after deploy)
   run `scripts/tracker.sh verify T03 <who> pass --note "what you checked"` (or `fail` + what broke).
6. **Stopping without finishing?** `scripts/tracker.sh release T03 <who> --note "why / where you got to"`.
   A `working` row whose Updated time is hours old is probably abandoned: read its Log (`scripts/tracker.sh show T03`)
   before taking it with `--force`.
7. Put context in the Log with `--note` (or `scripts/tracker.sh log T03 <who> --note "…"`). The script appends; never rewrite past lines.
8. **Two sessions coding at once → one git worktree each**, in `../farm-inventory-worktrees/<id>-<slug>`
   (`git worktree add -b t03-feed-bags ../farm-inventory-worktrees/t03-feed-bags main`, copy `.env`, then
   `cp -cR ../../farm-inventory-system/node_modules node_modules` and `npx prisma generate` —
   a **symlinked** `node_modules` breaks `next build` (Turbopack won't read outside the worktree). Only commit `TRACKER.md`
   from the main checkout, never from a worktree branch.
   **Testing in parallel:** give each session its own test database and port, or runs wipe each other's data:
   in the worktree's `.env` set `TEST_DATABASE_URL=…/awfarms_test_<id>`, and run `PW_PORT=31xx npx playwright test`.
   The global setup runs `prisma migrate reset`, which Prisma refuses from an agent until the user consents
   (env `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` = their exact words) — ask once, name the database.
   `next build` sometimes stops on a "security vulnerability" notice: run it again until it succeeds, or the tests run an old build.
9. Commits: author Usama Riasat, **no** Claude co-author line. At session end update `docs/progress.md`, and if the
   task closes a client row, set it in `docs/client-issues.md` too.

```sh
scripts/tracker.sh list                  # every row
scripts/tracker.sh list pending          # what is free
scripts/tracker.sh next s-a              # claim the next free row (prints its plan path)
scripts/tracker.sh show T02              # row + plan + its Log lines
scripts/tracker.sh set T02 worked s-a --note "migration + seed + tests, 98 pass"
scripts/tracker.sh set T02 committed s-a --commit abc1234
scripts/tracker.sh verify T02 s-a pass --note "Regulator once, stock 7 = 3 + 4 on aw02"
scripts/tracker.sh set T02 deployed s-a --note "migrate deploy on Neon ok"
scripts/tracker.sh release T02 s-a --note "blocked on X"
scripts/tracker.sh add T07 Normal "New task title" docs/plans/T07-slug.md --client "#32"
```

## Board

Batch 1 — developer's list of 28 Nov 2026. Decisions in each plan doc.

| ID | Priority | Status | Owner | Updated | Commit | Verified | Title | Plan | Client # |
|---|---|---|---|---|---|---|---|---|---|
| T01 | High | deployed | s-batch1 | 2026-11-28 08:21 | 34b380a | pass 11-28 08:21 | Request-new-item "+" only on IGP (not OGP / SIS) | docs/plans/T01-request-item-igp-only.md | #30 |
| T02 | High | deployed | s-batch1 | 2026-11-28 08:21 | 241e6ee | pass 11-28 08:21 | Remove duplicate items (keep the Stock in Store copy), live DB via migration | docs/plans/T02-dedupe-items.md | #28 |
| T03 | High | deployed | s-batch1 | 2026-11-28 08:21 | cc34e39 | pass 11-28 08:21 | Feed All: Bags + KG on slip lines | docs/plans/T03-feed-bags.md | #26 |
| T04 | Normal | deployed | s-batch1 | 2026-11-28 08:21 | 7b831ed | pass 11-28 08:21 | Farm slip search also matches remarks / purpose / M/s / driver… | docs/plans/T04-search-remarks.md | — |
| T05 | Normal | deployed | s-batch1 | 2026-11-28 08:21 | 7b831ed | pass 11-28 08:21 | Admin: add users, edit users, set a new password | docs/plans/T05-admin-users.md | — |
| T06 | Normal | deployed | s-batch1 | 2026-11-28 08:21 | 61e8201 | pass 11-28 08:21 | Excel: formatted .xlsx, items grouped by category (merged rows) | docs/plans/T06-excel-xlsx.md | — |

**Overlap to watch**
- T02 and T03 both add a Prisma migration. Whoever lands second rebases and gives theirs the later timestamp folder name.
- T01 and T03 both change `src/components/slip/slip-lines.tsx` (T01: `allowRequest` prop; T03: Bags column). Small, but rebase carefully.
- T03 and T06: the stock card Excel gets a Bags column only if T03 is in; T06 shouldn't wait for it.
- T02 and T05 both edit `src/server/services/setup.ts` (items vs users) — different functions.
- T02 + T03 deploy: both need `prisma migrate deploy` on Neon before (or with) the Vercel deploy.

**Deploy checklist (batch 1)** — nothing is pushed yet; T01, T02, T03, T06 are committed on local `main`, T04 / T05 on branch `t04-t05-search-users`.
1. Merge T04 / T05 (rebase on main first: seed is 1,947 items, slip lines have `bags`), `npm install` (exceljs), `npm run lint` + `npm run test:e2e` green.
2. Push `main` (this deploys to Vercel).
3. `prisma migrate deploy` on Neon, before or with the deploy: `20261128000000_dedupe_items` (T02), `20261128000001_slip_line_bags` (T03).
4. Check on the live URL (ask the developer before writing to live data): Regulator once in item search (T02); Feed All IGP has a Bags box (T03); slip search by remarks (T04); Admin → Users add / edit / password (T05); Excel downloads open in Excel, grouped by category (T06).
5. Each row: `scripts/tracker.sh set Txx deployed <who> --note "…"`, and `verify` with what was checked live.

## Log
- 2026-11-28 07:30 · T01–T06 · added as pending · plan approved by the developer (feed bags = Bags + KG both typed; dedupe keeps Stock in Store, Liquid Soap → QTY; users = add + edit + password; Excel = .xlsx for stock, stock card, admin reports)
- 2026-11-28 07:35 · T01 · pending → working · by s-t01-igp-request
- 2026-11-28 07:36 · T04 · pending → working · by s-t04t05
- 2026-11-28 07:36 · T05 · pending → working · by s-t04t05
- 2026-11-28 07:37 · T01 · working → worked · by s-t01-igp-request · allowRequest prop on SlipLines, IGP only; e2e 95 pass (Playwright, local build + awfarms_test)
- 2026-11-28 07:37 · T01 · verify pass · by s-t01-igp-request · Playwright Chromium vs local build: + on farm IGP, none on OGP/SIS, Enter on No item found opens nothing there
- 2026-11-28 07:37 · T01 · worked → committed · by s-t01-igp-request · commit 34b380a · local commit, not pushed (push deploys)
- 2026-11-28 07:38 · T02 · pending → working · by s-batch1
- 2026-11-28 07:41 · T03 · pending → working · by s-t03t06
- 2026-11-28 07:41 · T06 · pending → working · by s-t03t06
- 2026-11-28 07:44 · T04 · working → worked · by s-t04t05 · F6 search matches remarks/M/s/driver/Purpose of Use etc. + shows matched text; e2e/slip-search.spec.ts; branch t04-t05-search-users (worktree), lint + 100 tests green on scratch DB
- 2026-11-28 07:44 · T05 · working → worked · by s-t04t05 · A10 add/edit user + set new password; POST /api/users, /users/[id], /users/[id]/password; sign-out on password/deactivate, self + last-admin guards, audit; e2e/users.spec.ts (5); same branch
- 2026-11-28 07:45 · T02 · working → worked · by s-batch1 · migration verified on scratch demo DB (1,947 items, no orphans, balances unchanged); e2e 97 pass
- 2026-11-28 07:45 · T02 · verify pass · by s-batch1 · scratch DB: Regulator once (Stock in Store), aw02 balance 8 = both copies; index refuses ' REGULATOR '; UI not clicked through
- 2026-11-28 07:45 · T02 · worked → committed · by s-batch1 · commit 241e6ee · local commit on main, not pushed. Deploy needs prisma migrate deploy on Neon
- 2026-11-28 07:45 · T03 · note · by s-batch1 · FYI from T02: main has migration 20261128000000_dedupe_items, give T03's migration a later folder name; seed now 1,947 items so the random demo history changed, tests must not hard-code the hatchery's OGP-0047 (use /OGP-\d{4}/, see e2e/data.spec.ts + keyboard.spec.ts)
- 2026-11-28 07:45 · T04 · note · by s-batch1 · FYI from T02: rebase on main before merging, seed is now 1,947 items and OGP-0047 is no longer fixed in the demo data
- 2026-11-28 07:52 · T03 · working → worked · by s-t03t06 · branch t03-t06-bags-xlsx @ 9927e02; migration 20261128000001_slip_line_bags (after T02's 20261128000000); lint + e2e 99/100 (journeys return-unused diesel race on aw02, passes alone)
- 2026-11-28 07:52 · T03 · verify pass · by s-t03t06 · Playwright Chrome vs local build: IGP Enter Qty Received → Bags → Weight → new line; SIS refused without bags, summary '2 bags', print Bags column; phone 360px Bags box
- 2026-11-28 08:02 · T06 · working → worked · by s-t03t06 · branch t03-t06-bags-xlsx @ 13a29d5 (on top of T03 9927e02); exceljs 4.4.0 → main needs npm install after merge; lint + e2e 102/103 (same journeys diesel race, passes alone)
- 2026-11-28 08:02 · T06 · verify pass · by s-t03t06 · files opened in LibreOffice (PDF render): stock grouped with merged category rows, Urdu rows readable; card with Bags + bold total. Developer still to open in Excel
- 2026-11-28 08:02 · T03 · note · by s-t03t06 · not merged to main / not pushed: main checkout has T02 uncommitted, push deploys. Merge branch t03-t06-bags-xlsx after T02; migration then needs migrate deploy on Neon
- 2026-11-28 08:04 · T03 · worked → committed · by s-t03t06 · commit cc34e39 · ff-merged to main (local, not pushed); rebased on T02, e2e 105/105; deploy needs prisma migrate deploy (slip_line_bags)
- 2026-11-28 08:04 · T06 · worked → committed · by s-t03t06 · commit 61e8201 · ff-merged to main (local, not pushed); npm install needed for exceljs; e2e 105/105
- 2026-11-28 08:06 · T03 · note · by s-t03t06 · supersedes the 08:02 note: now merged to main (cc34e39), still NOT pushed. To finish (→ deployed): 1) push main 2) prisma migrate deploy on Neon (20261128000000_dedupe_items + 20261128000001_slip_line_bags) before / with the Vercel deploy 3) on the live URL check a Feed All IGP shows a Bags box (ask the developer first: live is the client's data) 4) scripts/tracker.sh set T03 deployed
- 2026-11-28 08:06 · T03 · note · by s-t03t06 · what shipped: Bags (whole number >= 1, required) on Feed All lines of IGP / OGP / SIS / receive (pre-filled from OGP, required only if qty received > 0); other items never keep bags; stock stays KG; bags on SIS summary, slip detail + print, admin correction (editable), stock card rows. Client #26 set done in docs/client-issues.md
- 2026-11-28 08:06 · T06 · note · by s-t03t06 · to finish: 1) npm install on every checkout / Vercel build (new dependency exceljs 4.4.0) 2) developer opens a stock report, a stock card and an admin report .xlsx in real Excel and confirms the layout (only LibreOffice checked so far) → then scripts/tracker.sh verify T06 ... with what was checked 3) push + scripts/tracker.sh set T06 deployed (no migration)
- 2026-11-28 08:06 · T06 · note · by s-t03t06 · what shipped: farm stock report (Home + F8) grouped by category with merged shaded rows, no Category column; stock card with header block, opening row, bold total, Bags for feed; admin reports Excel button wired (stock on hand grouped). CSV export removed (downloadCsv gone)
- 2026-11-28 08:06 · T03 · note · by s-t03t06 · known flaky test (not from T03/T06): e2e/journeys.spec.ts 'return unused … diesel' races journeys.spec.ts:44 on aw02 diesel in full parallel runs; passes alone. Needs its own testFarm or serial mode — not fixed
- 2026-11-28 08:06 · T06 · note · by s-t03t06 · cleanup left: worktree ../farm-inventory-worktrees/t03-t06-bags-xlsx (branch t03-t06-bags-xlsx, merged) and test DB awfarms_test_t03 can be removed
- 2026-11-28 08:09 · T04 · note · by s-t04t05 · committed 232380f on branch t04-t05-search-users (not merged to main, not pushed)
- 2026-11-28 08:09 · T05 · note · by s-t04t05 · committed 232380f on branch t04-t05-search-users (not merged to main, not pushed)
- 2026-11-28 08:09 · T04 · note · by s-batch1 · merging 232380f to main (rebase in worktree ../farm-inventory-worktrees/t04-t05-merge, branch t04-t05-merge), developer asked; please don't rebase t04-t05-search-users meanwhile
- 2026-11-28 08:12 · T04 · worked → committed · by s-batch1 · commit 7b831ed · rebased s-t04t05's 232380f onto main (only progress.md conflicted, kept both), ff-merged; e2e 111/111 on own DB + port; not pushed
- 2026-11-28 08:12 · T05 · worked → committed · by s-batch1 · commit 7b831ed · same commit as T04; not pushed
- 2026-11-28 08:18 · T01 · committed → deployed · by s-batch1 · pushed 6594b23, Vercel prod Ready (farm-inventory-system-seven.vercel.app); Neon backup taken, migrate deploy of dedupe_items + slip_line_bags OK
- 2026-11-28 08:18 · T02 · committed → deployed · by s-batch1 · pushed 6594b23, Vercel prod Ready (farm-inventory-system-seven.vercel.app); Neon backup taken, migrate deploy of dedupe_items + slip_line_bags OK
- 2026-11-28 08:18 · T03 · committed → deployed · by s-batch1 · pushed 6594b23, Vercel prod Ready (farm-inventory-system-seven.vercel.app); Neon backup taken, migrate deploy of dedupe_items + slip_line_bags OK
- 2026-11-28 08:18 · T04 · committed → deployed · by s-batch1 · pushed 6594b23, Vercel prod Ready (farm-inventory-system-seven.vercel.app); Neon backup taken, migrate deploy of dedupe_items + slip_line_bags OK
- 2026-11-28 08:18 · T05 · committed → deployed · by s-batch1 · pushed 6594b23, Vercel prod Ready (farm-inventory-system-seven.vercel.app); Neon backup taken, migrate deploy of dedupe_items + slip_line_bags OK
- 2026-11-28 08:18 · T06 · committed → deployed · by s-batch1 · pushed 6594b23, Vercel prod Ready (farm-inventory-system-seven.vercel.app); Neon backup taken, migrate deploy of dedupe_items + slip_line_bags OK
- 2026-11-28 08:18 · T02 · note · by s-batch1 · LIVE DB: 1,971 → 1,948 items, 23 merges + 23 audit rows, 0 orphans, 12 rows moved to kept copies, all 300 item/farm balances identical to the pre-migration backup (farm-inventory-backups/neon-before-batch1-20261128.dump)
- 2026-11-28 08:18 · T03 · note · by s-batch1 · LIVE DB: SlipLine.bags column present
- 2026-11-28 08:21 · T01 · verify pass · by s-batch1 · LIVE aw01: + on IGP, none on OGP / SIS
- 2026-11-28 08:21 · T02 · verify pass · by s-batch1 · LIVE: API 1,948 items, no duplicate names, Regulator once (Stock in Store); balances identical to backup
- 2026-11-28 08:21 · T03 · verify pass · by s-batch1 · LIVE aw01: Feed All on IGP and SIS shows Bags box, none before an item is picked (not saved)
- 2026-11-28 08:21 · T04 · verify pass · by s-batch1 · LIVE aw01 F6: 'royal office' → IGP-2125 + IGP-2090, 'exchange' → OGP-2103, 'new filter' → IGP-2105 (remarks)
- 2026-11-28 08:21 · T05 · verify pass · by s-batch1 · LIVE admin: added verify-test (aw01), signed in, Set new password → old pw refused / new works, deactivated → can't sign in, 0 sessions left; audit add_user/set_password/edit_user. verify-test left inactive on live
- 2026-11-28 08:21 · T06 · verify pass · by s-batch1 · LIVE: farm stock .xlsx 17 merged category rows, 296 items = screen; admin stock-on-hand .xlsx 20 merged ranges, no Category column. Still to open in real Excel by the developer
