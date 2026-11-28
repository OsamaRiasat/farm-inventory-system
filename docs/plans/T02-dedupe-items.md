# T02 — Remove duplicate items (keep the Stock in Store copy)

**Tracker:** T02 · **Client #:** #28 · **Priority:** High
**Decisions (developer, 28 Nov 2026):**
- Items with the same name (case / spaces ignored) are merged into one. If one copy is in **Stock in Store**, that one stays; otherwise any (we keep the lowest Item No.).
- **Liquid Soap**: Medicine & Vaccine (LTR) vs Stock in Store (QTY) → keep **Stock in Store (QTY)**; any LTR quantities are read as QTY from then on.
- Must reach the **live** database: done as a Prisma migration, run with `prisma migrate deploy` on Neon.

## Today
23 names appear twice in `src/server/seed/items.json` (and so on live, seeded from it), e.g.
Regulator (Shed Items #124 / Stock in Store #1424), Controller (Shed Items / Discard & Scrap), Liquid Soap (Medicine LTR / Stock in Store QTY),
Windows (Stock in Store / Building Items), Calculator (Discard & Scrap / Printing & Stationery) …
Run `python3 -c` over `items.json` grouping by `name.strip().lower()` for the full list.

Already in place: `saveItem` (`src/server/services/setup.ts` → `writeItem`) refuses a duplicate name (`err.duplicateName`), `requestItem` refuses an existing name (`err.itemExists`), and approving a request goes through `writeItem`. So new duplicates can only come from a race or direct DB edits — the unique index below closes that.

## Tables that hold an `itemId`
`SlipLine`, `Movement`, `SisReturnLine`, `StockCountLine` (keyed by `countId, index` → no key clash), `ItemRequest.itemId`.
Old `Slip.shedRows` JSON holds only the feed item (Feed All isn't duplicated) — leave it.
Corrections reference slips/line indexes, not items — fine.

## Change
1. **Migration** `prisma/migrations/<timestamp>_dedupe_items/migration.sql` (hand-written, generic — works on whatever live holds, including items approved from requests):
   ```sql
   CREATE TEMP TABLE item_merge AS
   SELECT id AS loser, first_value(id) OVER w AS winner
   FROM "Item"
   WINDOW w AS (PARTITION BY lower(btrim(name)) ORDER BY (category = 'Stock in Store') DESC, number ASC);
   DELETE FROM item_merge WHERE loser = winner;
   UPDATE "SlipLine" t SET "itemId" = m.winner FROM item_merge m WHERE t."itemId" = m.loser;
   -- same for "Movement", "SisReturnLine", "StockCountLine", "ItemRequest"
   -- winner keeps its name/category/unit; add loser aliases (distinct) to winner.aliases
   INSERT INTO "AuditEntry" (...) VALUES (... 'system', 'setup', 'Merged duplicate items: <loser → winner list>' ...);
   DELETE FROM "Item" i USING item_merge m WHERE i.id = m.loser;
   CREATE UNIQUE INDEX "Item_name_lower_key" ON "Item" (lower(btrim(name)));
   ```
   Check the `AuditEntry` columns in `schema.prisma` and how `audit()` in `src/server/repo.ts` fills them. Inserts pass the audit trigger (it only blocks UPDATE/DELETE).
   Deleting the loser `Item` rows is fine: nothing points at them after the repoint ("nothing deleted" is about slips/movements). Balances are derived from `Movement`, so merged stock adds up by itself.
2. **Seed**: remove the 23 losers from `src/server/seed/items.json` with the same rule (one-off script in the scratchpad, don't commit it). Item numbers keep their gaps (Item No. = workbook position). Check `src/server/seed/demo.ts` doesn't reference a removed id.
3. Unique-index violation in `writeItem` / `requestItem` (race) → map Prisma `P2002` on that index to `err.duplicateName`.
4. Docs: `docs/kb/03-data-and-api.md` seed note (1,970 → 1,947 items), `docs/client-issues.md` #28 → done, `07-roadmap` open question on duplicates closed.

## Tests
- Seed check (`e2e/data.spec.ts` or the seed checks): no two items share `lower(trim(name))`; item count matches.
- Migration on real data: before committing, on a copy of the demo DB (`npm run db:reset`, then insert two movements on a loser id, run the migration SQL) — stock per farm for a merged pair = sum of both. Record what you checked in the tracker Log.
- Rules test: saving a second "Regulator" fails with the duplicate message (probably already covered — keep it).

## Deploy
`prisma migrate deploy` on Neon (see `docs/kb/09-backend-architecture.md` → Vercel), then on the live URL: item search "regulator" shows one item, its stock card shows the history of both.
