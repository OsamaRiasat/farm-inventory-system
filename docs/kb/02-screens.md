# 02 · Screens

23 screens. Farm User = phone first (360 px). Accounts Admin = desktop first (1366 × 768). Both share Login and Print. P1 = needed for first client demo.

| ID | Screen | Route | Who | Purpose | P |
| --- | --- | --- | --- | --- | --- |
| S1 | Login | `/login` | Both | Mock: pick role + farm | P1 |
| S2 | Print view | `/print/[slipId]` | Both | Paper layout, print / PDF | P1 |
| F1 | Farm home | `/farm` | Farm | 3 slip buttons, waiting to receive, today's slips | P1 |
| F2 | New IGP | `/farm/igp/new` | Farm | IGP from supplier / other | P1 |
| F3 | Receive transfer | `/farm/igp/receive/[transferId]` | Farm | IGP pre-filled from sender's OGP | P1 |
| F4 | New OGP | `/farm/ogp/new` | Farm | To another farm or outside party | P1 |
| F5 | New SIS | `/farm/sis/new` | Farm | Feed & Mortality + items used | P1 |
| F6 | My slips | `/farm/slips` | Farm | Search by No., date, item | P1 |
| F7 | Slip detail | `/farm/slips/[id]` | Farm | Read-only, print, share, request correction | P1 |
| F8 | Farm stock | `/farm/stock` | Farm | Items with qty on hand | P1 |
| F9 | Item stock card | `/farm/stock/[itemId]` | Farm | Movements + running balance | P2 |
| F10 | Stock count | `/farm/stock-count/new` | Farm | Physical count, differences, reason | P2 |
| A1 | Dashboard | `/admin` | Admin | Tiles, farms today, latest slips | P1 |
| A2 | All slips | `/admin/slips` | Admin | All farms, filters | P1 |
| A3 | Slip detail | `/admin/slips/[id]` | Admin | F7 + Correct + Cancel | P1 |
| A4 | Stock | `/admin/stock` | Admin | Farm × item matrix + All Farms + In transit | P1 |
| A4b | Stock card (admin) | `/admin/stock/[farmId]/[itemId]` | Admin | F9 for any farm, opened from A4 | — |
| A5 | Transfers | `/admin/transfers` | Admin | Status, shortfall, age, Resolve | P1 |
| A6 | Correction requests | `/admin/corrections` | Admin | Approve (→ correct flow) / Reject | P2 |
| A7 | Reports | `/admin/reports/[type]` | Admin | The 8 reports | P2 |
| A8 | Farms & sheds | `/admin/setup/farms` | Admin | Add/edit/deactivate | P2 |
| A9 | Items | `/admin/setup/items` | Admin | Name, Urdu, aliases, category, unit | P2 |
| A10 | Users | `/admin/setup/users` | Admin | Mock data only | P2 |
| A11 | Audit log | `/admin/audit` | Admin | Who, what, when, old → new, reason | P2 |

## Farm User details
- **F1:** top bar (farm name, user, language-order toggle). Three full-width buttons with icon + EN + UR: Inward Gate Pass / آمد گیٹ پاس, Outward Gate Pass / روانگی گیٹ پاس, Stock Issue Slip / اشیاء جاری پرچی. "Waiting to receive" card (hidden when empty). "Today's slips" (No., type chip, time, first item + "and 4 more"). Bottom nav: Home, Slips, Stock.
- **Slip header/footer (F2–F5):** bilingual title, No. = "New" until saved. Farm, Date, Time auto + read-only; Time has "change" for later-same-day entry. Footer: Prepared by + sticky 56 px Save.

### F2 New IGP — fields in paper order
| Field | Control | Req | Rule |
| --- | --- | --- | --- |
| Received from M/s | Segmented Supplier / Other → searchable past suppliers + "add new" | Yes | Farms not offered — transfers come via F3 |
| Bilty No., Truck No. | Text | No | |
| Driver Name | Text, Urdu ok (`dir="auto"`) | No | |
| Demand No. | Text | No | |
| D. Challan No. + Dated | Text + date | No | |
| Line: Item | C1 item search | ≥1 line | |
| Line: Unit | From item | — | Not editable |
| Line: Qty As Per Delivery Challan | C2 | Yes | > 0 |
| Line: Qty Actual Received | C2 | Yes | ≥ 0; less than challan → amber row "Short by 3" |
| Line: Weight | Number + kg | No | |

### F3 Receive transfer
Header read-only (From farm, OGP No., Date sent, Driver, Vehicle). Lines pre-filled (Item, Unit, Qty As Per Delivery Challan = sent). Only **Qty Actual Received** editable. "Received all" fills every row. More than sent → blocked: "Cannot receive more than 9,000. Extra items need a separate IGP."

### F4 New OGP
| Field | Control | Req |
| --- | --- | --- |
| To | Segmented Another farm / Outside party | Yes |
| Farm | Farm picker (other 10) | If farm |
| M/s | Text, Urdu ok | If outside |
| Reason | Chips Repair / Return to supplier / Other | If outside |
| Driver Name, Vehicle No. | Text | No |
| Line: Description (item) | C1, shows "in stock: 6" | Yes |
| Line: Unit | From item | — |
| Line: Qty | C2, > 0 and ≤ stock, else "Only 6 in stock" | Yes |
| Line: Weight | Number + kg | No |

After save → go straight to Print view (driver needs the pass).

### F5 New SIS
1. **Feed & Mortality:** one row per shed (all sheds listed). Shed, Feed (feed items only, default last used), Feed used (KG), Mort Male, Mort Female. Empty rows skipped. Total row.
2. **Items:** S. No. auto, Name of Item (C1 with in-stock), Quantity used (≤ stock), Ledger Folio (item number, read-only, opens stock card), Purpose of Use (text + optional shed chip).

Before save → **Summary sheet (C9)**: "Diesel: 2,550 → 2,465 LTR" per line, mortality listed as "recorded, not stock". Back to edit / Confirm and save.

### F6–F10
- **F6:** search (No., item), chips IGP/OGP/SIS + date, cards (No., type, date, line count).
- **F7:** paper-like read-only; Print, Share PDF, Request correction. Corrected/cancelled → banner linking the correction.
- **F8:** search, category filter, list (EN + UR name, qty, unit). Zero items greyed at bottom.
- **F9:** item header with balance; rows date, slip No., in, out, running balance.
- **F10:** category or all; system qty + counted input; difference highlighted; reason required.

## Accounts Admin details
Layout: left sidebar (Dashboard, Slips, Stock, Transfers, Corrections, Reports, Setup → Farms & sheds / Items / Users, Audit log; icons-only < 1024 px). Top bar farm filter (All farms / one) applies to every screen. Dense tables.

- **A1:** five clickable tiles — Slips today, In transit, In transit > 2 days, Open shortfalls, Correction requests. "Farms today" table (11 rows: IGP, OGP, SIS ✓ or amber "missing", last slip time). Latest 20 slips (time, farm, No., type, first item).
- **A2:** columns No., Type, Farm, Date, From/To, Lines, Prepared by, Status. Filters type, farm, date range, item, status; search by No.
- **A3:** F7 + **Correct** (editable qtys + required reason → before/after diff) + **Cancel** (reason; warns/blocks for received transfers). Original ↔ correction linked both ways.
- **A4:** all-farms matrix (items × 11 farms + All Farms + In transit), sticky first column + header, category filter, search. One farm → F8 list with stock card links.
- **A5:** OGP No., From, To, Sent, Received, Status, Shortfall, Age (days). Row opens sent vs received side by side + **Resolve** (write off with reason / keep open).
- **A6:** farm, slip No., line, requested qty, reason, date. Approve → A3 Correct pre-filled; Reject → note shown on F7.
- **A7:** Stock on hand, Item stock card, Consumption, Feed & mortality (+ small line chart per shed), Gate register, Transfers, Out for repair, Corrections. Filter bar + table + Print / PDF / Excel (Excel not wired in phase 1).
- **A8–A11:** see table above. Farms/sheds/items are deactivated, never deleted.
