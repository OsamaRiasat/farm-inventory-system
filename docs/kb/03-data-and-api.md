# 03 · Data shapes and API

The UI talks **only** to `src/lib/api`. Phase 1 backs it with a mock store in the browser (seeded from JSON, persisted to localStorage, "reset demo" restores the seed). Later the same functions call the real backend — **no screen changes**. Treat these shapes as the backend contract; change them only deliberately.

## Types (from the spec — put in `src/types/domain.ts`)
```ts
type Unit = 'KG' | 'LTR' | 'QTY' | 'BG' | 'ROLL' | 'VIAL';
type SlipType = 'IGP' | 'OGP' | 'SIS';
type SlipStatus = 'saved' | 'corrected' | 'cancelled';

interface Farm { id: string; code: string; name: string; type: 'breeder' | 'layer' | 'hatchery'; sheds: Shed[]; active: boolean }
interface Shed { id: string; farmId: string; name: string; active: boolean }
interface Item { id: string; number: number; name: string; nameUr: string; aliases: string[]; category: string; unit: Unit; isFeed: boolean; active: boolean }

interface SlipBase {
  id: string; no: string;            // AW02-IGP-1663 — system number, unique across farms
  paperNo: string;                   // "IGP-0123" — typed from the farm's paper slip book (added 30 Oct 2026)
  type: SlipType; farmId: string;
  date: string;                      // ISO date: arrival (IGP) / dispatch (OGP) / issue (SIS). Today − 30 … today
  time: string;                      // HH:mm
  postedAt: string;                  // local "2026-11-03T10:50:00", set by the server on save (added 30 Oct 2026)
  preparedBy: string; status: SlipStatus;
  correctionOf?: string; correctedBy?: string;
}

interface IGP extends SlipBase {
  type: 'IGP';
  source: { kind: 'supplier' | 'farm' | 'other'; farmId?: string; ms?: string };
  transferId?: string; biltyNo?: string; truckNo?: string; driverName?: string;
  demandNo?: string; challanNo?: string; challanDate?: string;
  lines: { itemId: string; qtyChallan: number; qtyReceived: number; weightKg?: number }[];
}

interface OGP extends SlipBase {
  type: 'OGP';
  to: { kind: 'farm' | 'outside'; farmId?: string; ms?: string; reason?: 'repair' | 'return' | 'other' };
  transferId?: string; driverName?: string; vehicleNo?: string;
  lines: { itemId: string; qty: number; weightKg?: number }[];
}

interface SIS extends SlipBase {
  type: 'SIS';
  // Feed & mortality per shed: no longer entered (client, 30 Oct 2026) — feed is a normal line. Optional on input
  // (defaults to []), kept on old slips and in the Feed & mortality report. The backend may drop it once old data is migrated.
  shedRows: { shedId: string; feedItemId: string; feedKg: number; mortMale: number; mortFemale: number }[];
  lines: { itemId: string; qty: number; ledgerFolio?: string; purpose?: string; shedId?: string }[]; // ledgerFolio: storekeeper's ledger page, typed
}

interface Transfer { id: string; ogpId: string; igpId?: string; fromFarmId: string; toFarmId: string; status: 'in_transit' | 'received' | 'short'; sentAt: string; receivedAt?: string }
interface Movement { id: string; farmId: string; itemId: string; slipId: string; date: string; qtyIn: number; qtyOut: number }
```

Added in week 2 (not in the spec — review with the backend developer): `User`, `CorrectionRequest`, `StockCount`, `AuditEntry`; `Transfer.status` gains `"cancelled"` (OGP cancelled while in transit) and `Transfer.resolution` (A5 write-off). Suppliers are plain names collected from IGPs. All in `src/types/domain.ts`; API filters/results in `src/lib/api/types.ts`; slip inputs are inferred from the Zod schemas in `src/features/*/schema.ts`.

## API functions (`src/lib/api/index.ts`, async, typed)
`listFarms` · `listItems` · `searchItems(q)` · `getStock(farmId)` · `getStockCard(farmId, itemId)` · `listSlips(filters)` · `getSlip(id)` · `saveIGP` · `saveOGP` · `saveSIS` · `listWaitingTransfers(farmId)` · `receiveTransfer` · `requestCorrection` · `correctSlip` · `cancelSlip` · `saveStockCount` · `getDashboard` · `getReport(type, filters)` (stub until A7, week 6)

Added for the remaining screens: `updateFarm` · `addShed` · `updateShed` (A8) · `saveItem` (A9; the unit is locked once an item has movements). `getReport(type, filters)` returns `{ columns, rows, totals?, note?, series? }` — every report is a typed table (+ the feed & mortality chart series), computed from movements so corrections and cancellations are always included (`src/lib/api/mock/reports.ts`).

Added in week 2: `listSuppliers` · `listUsers` · `getStockMatrix` (A4) · `listTransfers` (A5) · `resolveShortfall` (A5) · `listCorrectionRequests` · `rejectCorrection` (A6) · `listAudit` (A11) · `onExternalChange` (other tab saved → refetch). Demo only: `resetDemo`, `getMockOptions` / `setMockOptions` (latency, fail every save).

### Changes from the client's issue list (30 Oct 2026)
- **Save inputs** (`saveIGP`, `saveOGP`, `saveSIS`, `receiveTransfer`) now take `paperNo` (required, trimmed) and `date` (the slip's own date). The form sends `paperNo` with the type prefix (`"IGP-0123"`); the server compares paper numbers ignoring case and spaces.
- The server sets `postedAt` itself; a correction gets its own `postedAt` and keeps the original's `paperNo`.
- New errors (same ids on screen and API): `err.enterPaperNo` (path `paperNo`), `err.paperNoUsed` `{no}` (path `paperNo` — same farm, same type, not a correction), `err.dateFuture` and `err.dateTooOld` `{n: 30}` (path `date`). "Today" is the server's date.
- `SlipFilters.no` matches the system **or** paper number.
- `getStockCard` rows' `ref` is the paper number (`slipNo()`: paper No. + `-C1` on corrections).
- Home's "Today's slips" means **posted** today (`postedAt`), not dated today. Admin "Slips today" / missing-SIS still use `date`.
- Excel export is done in the browser as CSV (UTF-8 with BOM so Excel shows Urdu) from data the screens already have; no API function. A backend may later serve real `.xlsx`.

Screens call these through TanStack Query hooks in `src/lib/api/queries.ts`. Every API error is an `ApiError` with a message id (+ values and field errors), so the screen shows the rule's own words.

Rules for the mock (`src/lib/api/mock/engine.ts`; the seed goes through the same engine):
- Balance = Σ movements (qtyIn − qtyOut) per farm × item. Calculated in `src/lib/stock.ts`, never stored.
- Save functions reject a line that would take stock below zero, **with the same message the screen shows**.
- Saves take a client-generated idempotency key so a double submit returns the first result.
- Simulate latency (~300 ms) and an optional failure toggle so the Saving / Not saved states can be demoed.
- Writes run on a copy of the store and are swapped in only on success.
- Slip date between today − 30 and today; paper No. unique per farm + type (`checkSlipBase` in `src/lib/validation.ts`, called by every slip schema; the engine passes today and the used numbers through `RuleContext`).
- Corrections are new slips (`AW02-SIS-0213-C1`, `correctionOf` → original, original `status: "corrected"`); stock moves by the difference only. Cancel reverses the slip's net effect; refused if it would take an item below zero, or if the OGP's transfer was already received.
- Session (mock login) is per browser tab (sessionStorage), so one tab can be a farm and another the admin.

## Mock seed (`src/lib/api/mock/seed.ts` + `seed/farms.json`, `seed/items.json`)

Deterministic (same demo after every reset), relative to today, ~250 slips. `MOCK_VERSION` 3 (the client's full item list; 2 added paper numbers + posted stamps): older saved demo data is replaced on load. Seeded paper numbers use the same digits as the system number (`AW02-SIS-0203` → `SIS-0203`); seeded slips are posted on their own date. Check it with `npx playwright test e2e/rules.spec.ts`.
- **Farms:** the 11 sites, each with 3–6 sheds.
- **Items:** the client's full list, `docs/source/All Inventory Items By Names.xlsx` — **1,970 items in 18 categories**, names exactly as the client wrote them (spelling variants and duplicates kept until the client cleans them). Item No. = position in that workbook (1–1,970). Categories use the cleaned names from `requirements.md` (Shed Items, Generator Items, Oil Filter, Air Filter, Printing & Stationery, Discard & Scrap; the rest as written).
  - **Units are our guess** (the workbook has none): vaccines and injections VIAL, tablets QTY, powders KG, other medicines LTR; diesel, petrol, oils LTR; chips, husk, choona, cement BG; wire, cable, tape ROLL; sugar, salt, tea KG; everything else QTY. To be confirmed by the client.
  - **Urdu names / aliases** only on the ~60 everyday items the demo uses (Feed All, Diesel Stock, Fan Belt, Drill Machine, HCL…; their old demo ids are kept: `diesel`, `feed-all`, `fan-belt-88a`…). The others have `nameUr: ""`; screens show the category in its place. The admin must add Urdu when editing one (A9).
  - Only one feed item (Feed All); layer farms use it too.
- **Balances (opening movements):** every farm holds the everyday items; each also holds ~6% of the other items, so lists look real. E.g. Patoki: Feed All 23,739 KG, Diesel 2,550 LTR, Nylon Rope 80, Aqua Kair 300, HCL 240 LTR, Accid Pro 200 LTR, Chips 7,552 BG, Drill Machine 6.
- **Slips:** ~2 weeks of history incl. Hatchery OGP-46 → Patoki IGP-1662 (egg boxes 180, egg trays 9,000, chappals 90, worker uniforms 10, assistant uniforms 5, foil 14 rolls, Gentylo 100 vials), OGP-1366 drill machine 6 → 5 to Layer-04 Khan, SIS-203 at Patoki; one transfer in transit, one short transfer, one corrected slip.
- **Users:** one Farm User per farm + one Accounts Admin.
- Real SIS example (AW-05 No. 483): feed 6,067 KG, Mort Male 2, Female 7.
