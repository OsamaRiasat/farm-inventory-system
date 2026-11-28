-- T07: Daily Report (DR) slips + the "Current Assets" items (Eggs, Gatta Tray, Plastic Tray, Eggs Box).
-- Safe on live data: only adds an enum value, nullable columns and items whose name isn't there yet.

ALTER TYPE "SlipType" ADD VALUE IF NOT EXISTS 'DR';

ALTER TABLE "Slip" ADD COLUMN IF NOT EXISTS "eggsReceived" INTEGER,
                   ADD COLUMN IF NOT EXISTS "hatchingEggs" INTEGER,
                   ADD COLUMN IF NOT EXISTS "marketEggs" INTEGER,
                   ADD COLUMN IF NOT EXISTS "discardedEggs" INTEGER,
                   ADD COLUMN IF NOT EXISTS "gattaTray" INTEGER,
                   ADD COLUMN IF NOT EXISTS "plasticTray" INTEGER,
                   ADD COLUMN IF NOT EXISTS "eggsBox" INTEGER;

-- An item that already exists under the same name (any category, case and outer spaces ignored) is reused,
-- not duplicated: "Gatta Tray" is already item No. 1687 (Packing Material) and stays as it is.
-- New ones get the next Item No. after the highest in use.
-- Only on a database that already has its items (live): a fresh install runs migrations before the seed, and the
-- seed's items.json carries the same items.
INSERT INTO "Item" ("id", "number", "name", "nameUr", "aliases", "category", "unit", "isFeed", "active")
SELECT v.id,
       (SELECT coalesce(max("number"), 0) FROM "Item") + row_number() OVER (ORDER BY v.ord),
       v.name, v.name_ur, v.aliases, 'Current Assets', 'QTY', false, true
FROM (VALUES
  (1, 'eggs',         'Eggs',         'انڈے',          ARRAY['egg', 'anday', 'anda']::text[]),
  (2, 'gatta-tray',   'Gatta Tray',   'گتہ ٹرے',       ARRAY[]::text[]),
  (3, 'plastic-tray', 'Plastic Tray', 'پلاسٹک ٹرے',    ARRAY['plastic egg tray']::text[]),
  (4, 'eggs-box',     'Eggs Box',     'انڈوں کا ڈبہ',  ARRAY['egg box']::text[])
) AS v(ord, id, name, name_ur, aliases)
WHERE NOT EXISTS (SELECT 1 FROM "Item" i WHERE lower(btrim(i."name")) = lower(btrim(v.name)))
  AND NOT EXISTS (SELECT 1 FROM "Item" i WHERE i."id" = v.id)
  AND EXISTS (SELECT 1 FROM "Item");
