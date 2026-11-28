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
   (`git worktree add -b t03-feed-bags ../farm-inventory-worktrees/t03-feed-bags main`, then `ln -s ../../farm-inventory-system/node_modules node_modules`
   and copy `.env`). Only commit `TRACKER.md` from the main checkout, never from a worktree branch.
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
| T01 | High | pending | — | 2026-11-28 | — | — | Request-new-item "+" only on IGP (not OGP / SIS) | docs/plans/T01-request-item-igp-only.md | #30 |
| T02 | High | pending | — | 2026-11-28 | — | — | Remove duplicate items (keep the Stock in Store copy), live DB via migration | docs/plans/T02-dedupe-items.md | #28 |
| T03 | High | pending | — | 2026-11-28 | — | — | Feed All: Bags + KG on slip lines | docs/plans/T03-feed-bags.md | #26 |
| T04 | Normal | pending | — | 2026-11-28 | — | — | Farm slip search also matches remarks / purpose / M/s / driver… | docs/plans/T04-search-remarks.md | — |
| T05 | Normal | pending | — | 2026-11-28 | — | — | Admin: add users, edit users, set a new password | docs/plans/T05-admin-users.md | — |
| T06 | Normal | pending | — | 2026-11-28 | — | — | Excel: formatted .xlsx, items grouped by category (merged rows) | docs/plans/T06-excel-xlsx.md | — |

**Overlap to watch**
- T02 and T03 both add a Prisma migration. Whoever lands second rebases and gives theirs the later timestamp folder name.
- T01 and T03 both change `src/components/slip/slip-lines.tsx` (T01: `allowRequest` prop; T03: Bags column). Small, but rebase carefully.
- T03 and T06: the stock card Excel gets a Bags column only if T03 is in; T06 shouldn't wait for it.
- T02 and T05 both edit `src/server/services/setup.ts` (items vs users) — different functions.
- T02 + T03 deploy: both need `prisma migrate deploy` on Neon before (or with) the Vercel deploy.

## Log
- 2026-11-28 07:30 · T01–T06 · added as pending · plan approved by the developer (feed bags = Bags + KG both typed; dedupe keeps Stock in Store, Liquid Soap → QTY; users = add + edit + password; Excel = .xlsx for stock, stock card, admin reports)
