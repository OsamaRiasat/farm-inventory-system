-- Separate migration: a new enum value can only be used after the ALTER TYPE has committed.
UPDATE "Item" SET "unit" = 'MAUND' WHERE "id" = 'rice-husk';
