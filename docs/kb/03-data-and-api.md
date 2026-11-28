# 03 · Data shapes and API

The UI talks **only** to `src/lib/api`. Since 24 Nov 2026 those functions call the real backend over HTTP (`src/lib/api/http.ts` → `/api/*` route handlers → `src/server/services` → PostgreSQL); the browser mock is gone. Treat these shapes as the contract between screens and server; change them only deliberately.

## Types (from the spec — put in `src/types/domain.ts`)
```ts
type Unit = 'KG' | 'LTR' | 'QTY' | 'BG' | 'ROLL' | 'VIAL' | 'MAUND'; // any unit takes decimals (client #21)
type SlipType = 'IGP' | 'OGP' | 'SIS' | 'DR';   // DR = Daily Report (T07)
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
  lines: { itemId: string; qtyChallan: number; qtyReceived: number; weightKg?: number; bags?: number }[]; // bags: feed items only
}

interface OGP extends SlipBase {
  type: 'OGP';
  to: { kind: 'farm' | 'outside'; farmId?: string; ms?: string; reason?: 'repair' | 'return' | 'other' };
  transferId?: string; driverName?: string; vehicleNo?: string;
  lines: { itemId: string; qty: number; weightKg?: number; bags?: number }[];
}

interface SIS extends SlipBase {
  type: 'SIS';
  // Feed & mortality per shed: no longer entered (client, 30 Oct 2026) — feed is a normal line. Optional on input
  // (defaults to []), kept on old slips and in the Feed & mortality report. The backend may drop it once old data is migrated.
  shedRows: { shedId: string; feedItemId: string; feedKg: number; mortMale: number; mortFemale: number }[];
  lines: { itemId: string; qty: number; bags?: number; ledgerFolio?: string; purpose?: string; shedId?: string }[]; // ledgerFolio: storekeeper's ledger page, typed
}

interface DR extends SlipBase {                  // Daily Report (T07, 28 Nov 2026) — one per farm per date
  type: 'DR';
  eggsReceived: number; hatchingEggs: number; marketEggs: number; discardedEggs: number;  // whole numbers ≥ 0
  gattaTray: number; plasticTray: number; eggsBox: number;                               // recorded only
  lines: { itemId: string; qty: number }[];  // derived: [{ Eggs, eggsReceived − hatching − market − discarded }], [] when 0
  remarks?: string;
}

interface Transfer { id: string; ogpId: string; igpId?: string; fromFarmId: string; toFarmId: string; status: 'in_transit' | 'received' | 'short'; sentAt: string; receivedAt?: string }
interface Movement { id: string; farmId: string; itemId: string; slipId: string; date: string; qtyIn: number; qtyOut: number }
```

Added in week 2 (not in the spec — review with the backend developer): `User`, `CorrectionRequest`, `StockCount`, `AuditEntry`; `Transfer.status` gains `"cancelled"` (OGP cancelled while in transit) and `Transfer.resolution` (A5 write-off). Suppliers are plain names collected from IGPs. All in `src/types/domain.ts`; API filters/results in `src/lib/api/types.ts`; slip inputs are inferred from the Zod schemas in `src/features/*/schema.ts`.

## API functions (`src/lib/api/index.ts`, async, typed)
`listFarms` · `listItems` · `searchItems(q)` · `getStock(farmId)` · `getStockCard(farmId, itemId)` · `listSlips(filters)` · `getSlip(id)` · `saveIGP` · `saveOGP` · `saveSIS` · `listWaitingTransfers(farmId)` · `receiveTransfer` · `requestCorrection` · `correctSlip` · `cancelSlip` · `saveStockCount` · `getDashboard` · `getReport(type, filters)` (stub until A7, week 6)

Added for the remaining screens: `updateFarm` · `addShed` · `updateShed` (A8) · `saveItem` (A9; the unit is locked once an item has movements). `getReport(type, filters)` returns `{ columns, rows, totals?, note?, series? }` — every report is a typed table (+ the feed & mortality chart series), computed from movements so corrections and cancellations are always included (`src/server/services/reports.ts`).

Added in week 2: `listSuppliers` · `listUsers` · `getStockMatrix` (A4) · `listTransfers` (A5) · `resolveShortfall` (A5) · `listCorrectionRequests` · `rejectCorrection` (A6) · `listAudit` (A11; a Farm User gets their own farm's entries, which F7 uses for "Corrected on … by …"). `onExternalChange` and the demo-only `resetDemo` / mock options were removed with the mock: other users' saves show up on window focus and every 30 s on live screens (`refetchInterval` in `queries.ts`).

### Changes from the client's issue list (30 Oct 2026)
- **Save inputs** (`saveIGP`, `saveOGP`, `saveSIS`, `receiveTransfer`) now take `paperNo` (required, trimmed) and `date` (the slip's own date). The form sends `paperNo` with the type prefix (`"IGP-0123"`); the server compares paper numbers ignoring case and spaces.
- The server sets `postedAt` itself; a correction gets its own `postedAt` and keeps the original's `paperNo`.
- New errors (same ids on screen and API): `err.enterPaperNo` (path `paperNo`), `err.paperNoUsed` `{no}` (path `paperNo` — same farm, same type, not a correction), `err.dateFuture` (path `date`; no lower limit — `err.dateTooOld` removed). "Today" is the server's date.
- `SlipFilters.no` matches the system **or** paper number.
- `getStockCard` rows' `ref` is the paper number (`slipNo()`: paper No. + `-C1` on corrections).
- Home's "Today's slips" means **posted** today (`postedAt`), not dated today. Admin "Slips today" / missing-SIS still use `date`.
- **Item requests (client #30, 26 Nov 2026):** `ItemRequest { id, farmId, name, nameUr, category, unit, requestedBy, at, status: 'pending'|'approved'|'rejected', note?, itemId? }`. `requestItem({ name, nameUr, category, unit })` — name + category required; refused when an item already has that name (`err.itemExists`) or the farm already asked for it (`err.alreadyRequested`). Not an `Item` (not in search, not on slips) until `approveItemRequest`, which creates the Item through the same rules as `saveItem` (Urdu name required, unique name) in the same transaction and stores `itemId`. Reject needs a note. Audit: `request_item` / `approve_item` / `reject_item`. `Dashboard.tiles.itemRequests` = pending count.
- **Units (26 Nov 2026):** `MAUND` added (Rice Husk moved from BG by migration, client #23). The whole-number rule (`err.wholeNumber` for Qty items) is gone: every unit takes decimals (client #21).
- **Remarks (21 Nov 2026):** `IGP.remarks?` and `OGP.remarks?` — optional, trimmed, ≤ 200 characters (`err.remarksTooLong`, path `remarks`), blank → not stored. Accepted by `saveIGP`, `saveOGP` and `receiveTransfer`. Corrections keep it unchanged. Shown on F7 / A3 and printed only when present. Not searched by `SlipFilters` (yet).
- **Return unused (21 Nov 2026):** new type `SISReturn { id, no, sisId, farmId, date, postedAt, by, lines: {lineIndex, itemId, qty}[], remarks?, status: "saved" | "cancelled", cancelled? }`. API: `listReturns(slipId)` (all versions of that SIS, oldest first, cancelled included), `returnUnused({ sisId, date, by, remarks?, lines: [{lineIndex, qty}], idempotencyKey })`, `cancelReturn({ returnId, reason, by })`. Rules in `src/features/sis/return-schema.ts`. Number `<SIS system no. without -Cn>-R<n>`; no paper No. Movements point at the return id (stock up; cancel = same id, stock down). `StockCardRow.returnOf` = the SIS to open. Errors: `err.onlyReturnable {n}`, `err.returnBeforeIssue`, `err.noReturnQty`, `err.belowReturned {n}` (correction), `err.returnClosed`. Audit actions `return` / `cancel_return` (recordId = the SIS). Consumption report counts returns against their SIS (use = issued − returned).
- Excel export is a real, formatted `.xlsx` built in the browser with `exceljs` (loaded on click, `src/lib/export.ts`: `downloadXlsx` + `addTableSheet`) from data the screens already have; no API function. Title block, bold frozen header repeated on print, thin borders, `#,##0` numbers right-aligned, Urdu column right-to-left in Noto Nastaliq, A4 fit to width. Stock report (farm Home + F8) and Admin stock on hand: **items grouped by category** — one merged, shaded row per category (A–Z), no Category column. Stock card: header block, opening row, bold total, Bags column for feed. Admin reports: every report's Excel button (28 Nov 2026, T06).

- **Daily Report (T07, 28 Nov 2026):** `saveDR(input)` → `POST /api/slips/dr` (own farm / Admin any farm; `farmId`, `preparedBy` from the session). Input = slip base (`paperNo` "DR-0123", `date`, `time`, `idempotencyKey`) + `eggsReceived` (required) + `hatchingEggs`, `marketEggs`, `discardedEggs`, `gattaTray`, `plasticTray`, `eggsBox` (default 0) + `remarks?`. Schema `drSchema` in `src/features/daily-report/schema.ts` (`DrInput`). Errors: `err.drEggsOver {n, total}` (path `eggsReceived`), `err.drDateUsed {date, no}` (path `date`; another non-cancelled DR of this farm on that date), `err.drWhole`, `err.zeroOrMore`, `err.required`, plus the slip base errors. The server works out the one line (Eggs, found by name) and adds one movement; Counter kind `DR` → `AW02-DR-0001`. `correctSlip` / `requestCorrection` refuse a DR with `err.drNoCorrection`; `cancelSlip` works as for any slip. `SlipFilters.type` accepts `"DR"`. `FarmToday.dr` = Daily Reports dated today. `getReport("daily-reports")` lists them with totals.

Screens call these through TanStack Query hooks in `src/lib/api/queries.ts`. Every API error is an `ApiError` with a message id (+ values and field errors), so the screen shows the rule's own words.

## HTTP endpoints (`src/app/api/**/route.ts`)
Thin handlers: session → permission → service → JSON (`handler()` in `src/server/route.ts`). Errors: `{ error: { id, values, fieldErrors } }` with 400 (rule), 404 (not found **or not yours**), 401 `err.signedOut`, 500 `err.notSaved`; `http.ts` turns them back into `ApiError`.

| Function | Endpoint | Who |
| --- | --- | --- |
| listFarms · listItems · searchItems · listSuppliers | `GET /api/farms` · `/api/items` · `/api/items/search?q` · `/api/suppliers` | any |
| listUsers · getStockMatrix · getDashboard · getReport | `GET /api/users` · `/api/stock/matrix` · `/api/dashboard` · `/api/reports/[type]?filters` | Admin |
| getStock · getStockCard | `GET /api/stock?farmId` · `/api/stock/card?farmId&itemId` | own farm / Admin |
| listSlips · getSlip · listReturns | `GET /api/slips?filters` · `/api/slips/[id]` · `/api/slips/[id]/returns` | own farm (+ the other side of a transfer) / Admin |
| listWaitingTransfers · listTransfers · listCorrectionRequests · listAudit | `GET /api/transfers/waiting?farmId` · `/api/transfers?farmId` · `/api/corrections?farmId&status` · `/api/audit?farmId` | own farm / Admin |
| saveIGP · saveOGP · saveSIS · saveDR · saveStockCount · receiveTransfer | `POST /api/slips/{igp,ogp,sis,dr}` · `/api/stock-counts` · `/api/transfers/receive` | own farm / Admin (any farm) |
| returnUnused · requestCorrection | `POST /api/returns` · `/api/corrections` | own farm's slip / Admin |
| requestItem · listItemRequests | `POST /api/item-requests` (Farm User; farm + name from the session) · `GET /api/item-requests?farmId&status` | own farm / Admin |
| saveUser · setUserPassword | `POST /api/users` (add) · `/api/users/[id]` (edit; password ignored) · `/api/users/[id]/password` | Admin |
| approveItemRequest · rejectItemRequest | `POST /api/item-requests/[id]/approve` (body = the final item fields) · `/api/item-requests/[id]/reject` (`note`) | Admin |
| correctSlip · cancelSlip · cancelReturn · rejectCorrection · resolveShortfall | `POST /api/slips/[id]/{correct,cancel}` · `/api/returns/[id]/cancel` · `/api/corrections/[id]/reject` · `/api/transfers/[id]/resolve` | Admin |
| updateFarm · addShed · updateShed · saveItem | `POST /api/farms/[id]` · `/api/sheds` · `/api/sheds/[id]` · `/api/items` | Admin |
| (session) | `POST /api/auth/login` `{username, password}` · `POST /api/auth/logout` · `GET /api/me` → the `Session` or null | — |

- **The server never trusts who / which farm from the body.** `preparedBy`, `by`, `requestedBy` are replaced by the signed-in user's name; a Farm User's `farmId` must be their own (or is filled in). The `by` fields in the function inputs are now optional and ignored.
- Login: username + password (bcrypt). Session = random token in an httpOnly cookie (`awfarms_session`, 30 days), stored as a sha256 hash in `Session`. Seeded usernames: farm id (`aw02`, `layer04`…) and `admin`.

## Rules on the server (`src/server/services/*`, ported from the phase 1 mock engine)
- Balance = Σ movements (qtyIn − qtyOut) per farm × item, summed in SQL (`balancesOf` in `src/server/repo.ts`); never stored.
- Every save runs the **same Zod schema** as the form (`src/features/*/schema.ts`) with a `RuleContext` loaded from the database (the items on the slip, their balances, today, the paper No. lookup), so messages match the screen exactly.
- **One transaction per save, holding a lock per farm it touches** (`withFarmLock`, Postgres advisory locks, sorted). Two saves racing for the last stock run one after the other: one wins, the other gets "Only 0 in stock". Receive / cancel / correct of a transfer's gate pass lock both farms.
- Idempotency key per save (`IdempotencyKey` table): a retry returns the first result, even when sent at the same time.
- Numbers from `Counter` (farm × IGP / OGP / SIS / DR / CNT), inside the farm lock.
- Slip date any day up to today (no lower limit); paper No. unique per farm + type (`checkSlipBase`; plus a partial unique index as a backstop).
- Corrections are new slips (`AW02-SIS-0213-C1`, `correctionOf` → original, original `status: "corrected"`); stock moves by the difference only. Cancel reverses the slip's net effect; refused if it would take an item below zero, or if the OGP's transfer was already received.
- **Feed bags (client #26, 28 Nov 2026):** a line whose item `isFeed` needs `bags`, a whole number ≥ 1 (`checkBags` in `src/lib/validation.ts`: "Enter the number of bags" / "Bags: whole numbers only"); receive only when Qty Actual Received > 0. Bags on any other item are dropped (`feedBagsOnly`). Stored in `SlipLine.bags`; stock and balances stay in KG. A correction may send `lines[].bags` for a feed line.
- `AuditEntry` is append-only: a database trigger refuses UPDATE / DELETE / TRUNCATE.
- "Today" and posted-on stamps are Pakistan time (`Asia/Karachi` in `src/lib/dates.ts`), whatever the server's time zone.

## Database (`prisma/schema.prisma`, PostgreSQL, Prisma 7)
`Farm`, `Shed`, `Item`, `User`, `Session`, `Supplier` · `Slip` (header columns per type, `shedRows` JSON for old SIS, the Daily Report's seven counts as nullable Int columns — migration `20261128000002_daily_report`) + `SlipLine` (by index) · `Transfer` · `Movement` · `SisReturn` + lines · `StockCount` + lines · `CorrectionRequest` · `ItemRequest` · `Counter` · `IdempotencyKey` · `AuditEntry`. Dates and times are text in the API's own format. `src/server/mappers.ts` turns rows into the domain types above.

## Seed (`prisma/seed.ts` → `src/server/seed/base.ts`, `demo.ts`, `farms.json`, `items.json`)

`npm run db:seed:base`: farms, sheds, items and one login per farm + the Admin with random passwords (printed once) — what a real install starts with. `npm run db:seed` (and `db:reset`): base + the demo history below, all logins `demo1234`. The demo goes through the real services, so it obeys the same rules. Deterministic, relative to today, ~250 slips. Seeded paper numbers use the same digits as the system number (`AW02-SIS-0203` → `SIS-0203`); seeded slips are posted on their own date.
- **Farms:** the 11 sites, each with 3–6 sheds.
- **Current Assets (T07):** `items.json` adds Eggs (No. 1971), Plastic Tray (1972), Eggs Box (1973), category "Current Assets", unit QTY; Gatta Tray is the client's existing No. 1687 (Packing Material). On a live database the migration inserts only the names not already there (case / outer spaces ignored), numbered after the highest Item No.; on a fresh one the seed adds them. **1,950 items** in the seed.
- **Daily Reports (demo):** every layer / breeder farm, each of the 14 days (17:xx), with their own random sequence so the rest of the demo is unchanged; today missing at AW-05 and Layer-04.
- **Items:** the client's full list, `docs/source/All Inventory Items By Names.xlsx` — **1,970 items in 18 categories** in the workbook, names exactly as the client wrote them (spelling variants kept). Item No. = position in that workbook (1–1,970). **Duplicates merged (T02, 28 Nov 2026):** 23 names were listed twice; the Stock in Store copy stays (else the lowest Item No.), so the seed has **1,947 items** and Item No. has gaps. Migration `20261128000000_dedupe_items` did the same on live data (references moved, audit row per merge) and added a unique index on `lower(btrim(name))`. Categories use the cleaned names from `requirements.md` (Shed Items, Generator Items, Oil Filter, Air Filter, Printing & Stationery, Discard & Scrap; the rest as written).
  - **Units are our guess** (the workbook has none): vaccines and injections VIAL, tablets QTY, powders KG, other medicines LTR; diesel, petrol, oils LTR; chips, husk, choona, cement BG; wire, cable, tape ROLL; sugar, salt, tea KG; everything else QTY. To be confirmed by the client.
  - **Urdu names / aliases** only on the ~60 everyday items the demo uses (Feed All, Diesel Stock, Fan Belt, Drill Machine, HCL…; their old demo ids are kept: `diesel`, `feed-all`, `fan-belt-88a`…). The others have `nameUr: ""`; screens show the category in its place. The admin must add Urdu when editing one (A9).
  - Only one feed item (Feed All); layer farms use it too.
- **Balances (opening movements):** every farm holds the everyday items; each also holds ~6% of the other items, so lists look real. E.g. Patoki: Feed All 23,739 KG, Diesel 2,550 LTR, Nylon Rope 80, Aqua Kair 300, HCL 240 LTR, Accid Pro 200 LTR, Chips 7,552 BG, Drill Machine 6.
- **Slips:** ~2 weeks of history incl. Hatchery OGP-46 → Patoki IGP-1662 (egg boxes 180, egg trays 9,000, chappals 90, worker uniforms 10, assistant uniforms 5, foil 14 rolls, Gentylo 100 vials), OGP-1366 drill machine 6 → 5 to Layer-04 Khan, SIS-203 at Patoki; one transfer in transit, one short transfer, one corrected slip.
- **Return unused:** AW-01, 4 days ago — 60 LTR diesel issued for the generator, 15 LTR returned the same evening.
- **Users:** one Farm User per farm + one Accounts Admin.
- Real SIS example (AW-05 No. 483): feed 6,067 KG, Mort Male 2, Female 7.
