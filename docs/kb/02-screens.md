# 02 · Screens

23 screens. Farm User = phone first (360 px). Accounts Admin = desktop first (1366 × 768). Both share Login and Print. P1 = needed for first client demo.

| ID | Screen | Route | Who | Purpose | P |
| --- | --- | --- | --- | --- | --- |
| S1 | Login | `/login` | Both | Username + password (since 24 Nov 2026); Sign out on F1 and the admin top bar | P1 |
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
| A1 | Dashboard | `/admin` | Admin | Tiles (incl. New item requests → A9 Requested), farms today, latest slips | P1 |
| A2 | All slips | `/admin/slips` | Admin | All farms, filters | P1 |
| A3 | Slip detail | `/admin/slips/[id]` | Admin | F7 + Correct + Cancel | P1 |
| A4 | Stock | `/admin/stock` | Admin | Farm × item matrix + All Farms + In transit | P1 |
| A4b | Stock card (admin) | `/admin/stock/[farmId]/[itemId]` | Admin | F9 for any farm, opened from A4 | — |
| A5 | Transfers | `/admin/transfers` | Admin | Status, shortfall, age, Resolve | P1 |
| A6 | Correction requests | `/admin/corrections` | Admin | Approve (→ correct flow) / Reject | P2 |
| A7 | Reports | `/admin/reports/[type]` | Admin | The 8 reports | P2 |
| A8 | Farms | `/admin/setup/farms` | Admin | Edit/deactivate (sheds hidden for now — not handled separately) | P2 |
| A9 | Items | `/admin/setup/items` | Admin | Name, Urdu, aliases, category, unit; **Requested** tab (`?show=requested`) — farms' new-item requests: open one → edit → Approve and add / Reject with a reason | P2 |
| A10 | Users | `/admin/setup/users` | Admin | Read-only list (password reset not built yet) | P2 |
| A11 | Audit log | `/admin/audit` | Admin | Who, what, when, old → new, reason | P2 |
| A12 | New slip for a farm | `/admin/slips/new/igp` · `ogp` · `sis` · `count` | Admin | F2 / F4 / F5 / F10 entered by the admin from a farm's paper slip | — |

## Farm User details
- **F1:** top bar (farm name, user, language-order toggle). **Find** box first (gate pass No. or item + optional date → F6 with that search; `/` focuses it). Three full-width buttons with icon + EN + UR: Inward Gate Pass / آمد گیٹ پاس, Outward Gate Pass / روانگی گیٹ پاس, Stock Issue Slip / اشیاء جاری پرچی. "Waiting to receive" card (hidden when empty). "Today's slips" = slips **posted** today (No., type chip, posting time, first item + "and 4 more"); each opens F7. **Export to Excel / PDF**: full stock report (Excel = CSV download, PDF = F8 printed); one item's report is on its stock card (F9). Bottom nav: Home, Slips, Stock.
- **Back:** every screen has a **Back** link (top left) except the two homes — F1 and A1 — and Login. Back returns to the page you came from (`router.back()`, history doesn't grow); a page opened directly (link, bookmark, QR) goes up instead and replaces itself: detail → its list (F7 → F6, F9 → F8, A3 → A2, A4 card → A4), anything else → Home / Dashboard. On a slip with typed data it asks "Leave without saving?" first. Receiving a transfer replaces the form in history; login replaces itself. Component: `BackLink` (`src/components/layout/back-link.tsx`); admin pages get it from the layout (`AdminBack`).
- **Slip header/footer (F2–F5):** bilingual title. **No.** = `IGP-` / `OGP-` / `SIS-` + a box for the paper slip's number (required, first field). Farm (auto), **Posted on** (today, auto), the slip's **date** — "Arrival date" (IGP), "Dispatch date" (OGP), "Issue date" (SIS) — today by default, changeable to any earlier date (previous months too), never future; Time auto with "change". The date starts on the last slip saved in this tab (client #27; "Not today's date" in amber). Footer: Prepared by + sticky 56 px Save.
- **Item search on a line (C1, client #20 #22 #30):** the highlighted option is solid green and stays in view while ↑ / ↓ move; Enter or Tab picks it. Typed text that isn't a picked item never moves on: Tab / Enter stay in the box (an empty box still moves on, so an empty last line → Remarks / Save). **Farm User only:** a **+** beside the box, and Enter on "No item found", open **Request a new item** (Name pre-filled, Urdu name, Category, Unit; Enter → next, Ctrl/⌘+S sends, Esc closes). It is *not* added to the list: "Request sent for … It will be in the list once the Admin approves it." The Admin sees a **New item requests** tile on A1 and approves on A9.
- **Qty vs challan (IGP, client #24):** Qty Actual Received above the challan → amber "n more than the challan — check the quantities" (a warning, still saveable); below → amber "Short by n".
- **Every visit starts an empty slip**: Next.js keeps a page you leave alive (React `<Activity>`), so `SlipForm` clears itself whenever it is hidden — by Back, the phone's Back, forward, or opening the same link again — and after a save. Same for every other form: stock count, correction / cancel / request panels on F7 / A3, shortfall write-off (A5), reject note (A6), farm and item editors (A8 / A9) — via `ResetOnHide` / `useOnHide` (`src/lib/on-hide.tsx`). Slip forms are `autocomplete="off"` so the browser doesn't refill them either. List filters are kept (going back to a list keeps its search).

### F2 New IGP — fields in paper order
| Field | Control | Req | Rule |
| --- | --- | --- | --- |
| Received from M/s | Segmented Supplier / Other → searchable past suppliers + "add new" | Yes | Farms not offered — transfers come via F3 |
| Bilty No., Truck No. | Text | No | |
| Driver Name | Text, Urdu ok (`dir="auto"`) | No | |
| Demand No. | Text | No | |
| D. Challan No. + D. Challan Dated | Text + date | No | The challan's own date — not the arrival date |
| Line: Item | C1 item search | ≥1 line | |
| Line: Unit | From item | — | Not editable |
| Line: Qty As Per Delivery Challan | C2 | Yes | > 0 |
| Line: Qty Actual Received | C2 | Yes | ≥ 0; less than challan → amber row "Short by 3" |
| Line: Bags | Whole number, **Feed All only** (`isFeed`) | Feed: Yes | ≥ 1, "Enter the number of bags". Stock stays in KG; bags are recorded, not converted (client #26). Other items: empty cell, not focusable |
| Line: Weight | Number + kg | No | |
| Remarks | Text, Urdu ok, ≤ 200 characters, after the lines | No | One note for the whole slip |

### F3 Receive transfer
Header read-only (From farm, OGP No., Date sent, Driver, Vehicle). Lines pre-filled (Item, Unit, Qty As Per Delivery Challan = sent). Only **Qty Actual Received** editable, and **Bags** on a feed line (pre-filled from the OGP, required when something arrived), plus optional **Remarks**, e.g. "2 bags torn". "Received all" fills every row. More than sent → blocked: "Cannot receive more than 9,000. Extra items need a separate IGP."

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
| Line: Bags | Whole number, Feed All only (client #26) | Feed: Yes |
| Line: Weight | Number + kg | No |
| Remarks | Text, Urdu ok, ≤ 200 characters, after the lines | No |

After save → a blank OGP with the green "OGP-0123 saved" banner: **Print** (the driver's pass) / View / New slip — like IGP and SIS (client #29, 25 Nov 2026; it used to jump to the print view).

### F5 New SIS
**Items** only: S. No. auto, Name of Item (C1 with in-stock; feed is picked here like any item), Quantity used (≤ stock; 9 rem wide so "15,413 KG" shows), **Bags** (feed lines only, whole number, required — client #26), Ledger Folio (**typed** — the storekeeper's own ledger page), Purpose of Use (wide text). Lines are a table from 768 px, cards below.

~~Feed & Mortality per shed~~ — removed at the client's request (30 Oct 2026): mortality doesn't touch stock, and feed goes in as an item. Old slips still show their shed rows.

Before save → **Summary sheet (C9)**: "Diesel: 2,550 → 2,465 LTR" per line (feed adds "50 bags"). Back to edit / Confirm and save.

### F6–F10
- **F6:** search (paper or system No., item), chips IGP/OGP/SIS + date, cards (No., type, date, line count). Opened from Home's Find with `?q=` / `?date=`. When the search matches an item, each card shows that item's quantity: `+12` in (IGP), `−1` out (OGP / SIS).
- **F7:** paper-like read-only; Print, Share PDF, Request correction. Corrected/cancelled → banner linking the correction.
- **Return unused (F7 / A3, SIS only, 21 Nov 2026):** button "Return unused / بچا ہوا واپس" on a saved SIS with something left to return. Sheet: per line Item · Issued · Returned so far · "Can return n" · **Qty returned** (empty), live "Stock: 2,465 → 2,665"; **Return date** (today, min = issue date, max = today); **Remarks** (optional). Enter → next box, Ctrl/⌘+S or Ctrl/⌘+Enter saves, Esc closes. After saving: banner "Return saved", the SIS table gains **Returned** and **Used** columns and a "Returned unused" list (date, item, +qty, by, remarks); cancelled returns stay struck through with the reason. Same on the print. Stock card row: "SIS-0123 Returned +200" opening the SIS. Admin (A3) gets **Cancel return** per return (reason required, focus on Keep it).
- **F8:** search, category filter, list (EN + UR name — the category when there is no Urdu name yet — qty, unit). Items at 0 greyed at bottom; with ~1,950 items they show only when searching, picking a category or pressing "Show N items at 0". **Excel** (what's listed) and **PDF / Print**; `?print=1` prints once loaded (Home's PDF button).
- **F9:** item header with balance and Item No.; rows date, slip No., in, out, running balance. **Date range**: Last 7 days / This month / All or From–To; the range shows its opening balance and In / Out totals. **Excel** and **PDF / Print** take the range.
- **F10:** category or all; system qty + counted input; difference highlighted; reason required.

## Accounts Admin details
Layout: left sidebar (Dashboard, Slips, Stock, Transfers, Corrections, Reports, Setup → Farms / Items / Users, Audit log; icons-only < 1024 px). Top bar farm filter (All farms / one) applies to every screen. Dense tables.

- **A1:** five clickable tiles — Slips today, In transit, In transit > 2 days, Open shortfalls, Correction requests. "Farms today" table (11 rows: IGP, OGP, SIS ✓ or amber "missing", last slip time). Latest 20 slips (time, farm, No., type, first item).
- **A2:** columns No., Type, Farm, Date, From/To, Lines, Prepared by, Status. Filters type, farm, date range, item, status; search by No. **New slip ▾** above the table: Inward Gate Pass / Outward Gate Pass / Stock Issue Slip / Stock count (↑ ↓ Enter, Esc closes) → A12.
- **A12:** the admin types in a paper slip received from a farm. Farm picked in the top bar → used straight away; "All farms" → "Which farm is this slip from?" first (Enter continues). Then the farm's own form (same fields, paper No. required, same rules and messages) with an "Entering slip for AW-05 · Change farm" bar; the farm is fixed once the form opens, Change farm asks "Leave without saving?" and clears it. Prepared by = the admin's name (the audit log shows the admin). After saving, View opens A3; New slip on the saved banner starts another. Receiving a transfer stays with the farm (not in A12).
- **A3:** F7 + **Correct** (editable qtys + required reason → before/after diff) + **Cancel** (reason; warns/blocks for received transfers) + Return unused / Cancel return on an SIS. Original ↔ correction linked both ways.
- **A4:** all-farms matrix (items × 11 farms + All Farms + In transit), sticky first column + header, category filter, search. One farm → F8 list with stock card links.
- **A5:** OGP No., From, To, Sent, Received, Status, Shortfall, Age (days). Row opens sent vs received side by side + **Resolve** (write off with reason / keep open).
- **A6:** farm, slip No., line, requested qty, reason, date. Approve → A3 Correct pre-filled; Reject → note shown on F7.
- **A7:** Stock on hand, Item stock card, Consumption, Feed & mortality (+ small line chart per shed), Gate register, Transfers, Out for repair, Corrections. Filter bar + table + Print / PDF / Excel (Excel not wired in phase 1).
- **A8–A11:** see table above. Farms/sheds/items are deactivated, never deleted.
