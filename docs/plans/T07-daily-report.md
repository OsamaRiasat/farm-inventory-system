# T07 — Daily Report (new slip type) + "Current Assets" items

**Tracker:** T07 · **Priority:** High
**Request (developer, 28 Nov 2026):** a farm fills a Daily Report once a day: Date, Total Eggs Received, Hatching
Eggs, Market Eggs, Discarded Eggs, Gatta Tray, Plastic Tray, Eggs Box, Remarks. Only the eggs left over go into stock.

## Decisions
- **A fourth slip type `DR`** in the same `Slip` table (header columns `eggsReceived`, `hatchingEggs`, `marketEggs`,
  `discardedEggs`, `gattaTray`, `plasticTray`, `eggsBox`, + `remarks`). So lists, filters, detail, print, audit,
  stock card and cancel work like the other slips. Number `AW02-DR-0001` (Counter kind `DR`).
- **Paper No.** required like every slip: `DR-0123` (open question: does the farm have a paper DR book?).
- **Stock:** one movement, Eggs in = Total − Hatching − Market − Discarded; none when 0. It is stored as the slip's
  only line (`Eggs`, qty = eggs added), derived on the server, never typed. Trays / box are recorded only.
- **Rules** (`src/features/daily-report/schema.ts`, browser + server): whole numbers ≥ 0; Hatching + Market +
  Discarded ≤ Total ("Hatching + Market + Discarded (n) is more than Total Eggs Received (m)"); one report per farm
  per date — cancelled ones don't count ("A Daily Report for 28 Nov 2026 is already saved (DR-0003)").
- **Corrections:** the Admin can **Cancel** a DR (Eggs back out, never below 0). **Correct** and
  **Request correction** are hidden / refused for DR — cancel and enter it again.
- **Items:** category "Current Assets": Eggs, Gatta Tray, Plastic Tray, Eggs Box, unit QTY ("Nos" / عدد).
  Gatta Tray already exists (Packing Material, No. 1687) → reused, not moved, not duplicated. Migration inserts only
  names not already there (lower(btrim(name))), Item No. = max + n. Seed `items.json` gets the same.
- **Admin:** DR in type filters, A12 "New slip ▾" → Daily Report, "Farms today" gets a DR column, new report
  "Daily reports" (A7) with Excel.

## Tests
`e2e/rules.spec.ts`: stock formula, trays don't move stock, sum > total refused, duplicate date refused (and allowed
again after cancel), 0 eggs → no movement, items not duplicated. Screen: keyboard path + dashboard button.
