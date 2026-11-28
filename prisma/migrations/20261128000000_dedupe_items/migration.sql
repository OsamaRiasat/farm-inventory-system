-- T02 / client #28: merge items that share a name (case and outer spaces ignored).
-- The copy in "Stock in Store" stays; otherwise the lowest Item No. Every row that points at a removed copy
-- (slip lines, movements, returns, stock counts, item requests) is moved onto the one that stays, so
-- balances (derived from movements) add up. One audit entry per removed copy. Then a unique index stops
-- the same name coming back. All in one transaction: on any error nothing changes.

BEGIN;

CREATE TEMP TABLE item_merge ON COMMIT DROP AS
SELECT i.id AS loser, w.winner
FROM "Item" i
JOIN (
  SELECT id, first_value(id) OVER (
    PARTITION BY lower(btrim(name))
    ORDER BY (category = 'Stock in Store') DESC, number ASC
  ) AS winner
  FROM "Item"
) w ON w.id = i.id
WHERE i.id <> w.winner;

UPDATE "SlipLine"       t SET "itemId" = m.winner FROM item_merge m WHERE t."itemId" = m.loser;
UPDATE "Movement"       t SET "itemId" = m.winner FROM item_merge m WHERE t."itemId" = m.loser;
UPDATE "SisReturnLine"  t SET "itemId" = m.winner FROM item_merge m WHERE t."itemId" = m.loser;
UPDATE "StockCountLine" t SET "itemId" = m.winner FROM item_merge m WHERE t."itemId" = m.loser;
UPDATE "ItemRequest"    t SET "itemId" = m.winner FROM item_merge m WHERE t."itemId" = m.loser;

-- The one that stays keeps its name, category and unit; it also answers to the removed copies' aliases.
UPDATE "Item" w
SET "aliases" = ARRAY(
  SELECT DISTINCT a FROM unnest(w."aliases" || (
    SELECT coalesce(array_agg(x), '{}') FROM item_merge m JOIN "Item" l ON l.id = m.loser, unnest(l."aliases") x
    WHERE m.winner = w.id
  )) a
)
WHERE w.id IN (SELECT winner FROM item_merge);

-- If the one that stays is inactive but a removed copy was active, keep it usable.
UPDATE "Item" w SET "active" = true
WHERE NOT w."active"
  AND EXISTS (SELECT 1 FROM item_merge m JOIN "Item" l ON l.id = m.loser WHERE m.winner = w.id AND l."active");

INSERT INTO "AuditEntry" ("at", "user", "farmId", "action", "recordId", "recordNo", "old", "new", "reason")
SELECT to_char(now() AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD"T"HH24:MI:SS'), 'System', NULL, 'setup', w.id, w.name,
       l.name || ' · ' || l.unit || ' · ' || l.category || ' (No. ' || l.number || ')',
       w.name || ' · ' || w.unit || ' · ' || w.category || ' (No. ' || w.number || ')',
       'Duplicate item merged (client #28)'
FROM item_merge m
JOIN "Item" l ON l.id = m.loser
JOIN "Item" w ON w.id = m.winner;

DELETE FROM "Item" i USING item_merge m WHERE i.id = m.loser;

-- Hand-written (Prisma can't express it): one item per name, case and outer spaces ignored.
CREATE UNIQUE INDEX "Item_name_lower_key" ON "Item" (lower(btrim("name")));

COMMIT;
