# AW Farms Inventory System — Requirements

Oct 26, 2026 · @Moosa

## Overview

We will replace the paper slips and the QuickBooks re-typing with a web app. Each farm records its own stock movements as they happen, and one Accounts Admin sees every farm live.

Today each farm writes three kinds of slips by hand: inward gate passes, outward gate passes and stock issue slips. The slips are carried to the accounts office, where one person types them into QuickBooks. The books are always behind the farms, transfers between farms are entered twice and never matched, and anything on a slip that QuickBooks has no place for, such as bird mortality, is lost.

In the new system, the farm's one data-entry person fills in the **same three slips** on a phone or PC, with the same names and the same columns, but with the arithmetic, translating and matching done for them. Stock updates the moment a slip is saved, transfers between farms link automatically, and the Accounts Admin sees everything live instead of re-typing it. Like QuickBooks today, the system tracks **quantities only, not money**.

## How it works today

We based this section on a 2.5-minute screen recording of the accounts person at work, three sample slips, and the item list workbook.

**The system.** QuickBooks Enterprise Accountant 13.0, company file "AW Farms Inventory". The home screen shows "Service has expired" and a last local backup of 12 September 2025. Every cost and amount field is 0.00, so it is used for quantities only.

**The paper slips**, each a pre-printed book in three copies (white for Head Office, pink for Purchase, blue for the farm):

| Slip | Example | What is written on it | How it is entered in QuickBooks |
| --- | --- | --- | --- |
| Inward Gate Pass (IGP) | No. 2048, 05 Breeder, 17/9/26 | Bilty no., truck no., driver, sender, item, unit, qty as per delivery challan, qty actually received, weight | Item Receipt, with the farm picked as "vendor" and the IGP number as reference |
| Outward Gate Pass (OGP) | No. 2075, 05 Breeder, 20/9/26 | Party (M/s), driver, vehicle, item, unit, qty, weight | Adjust Quantity on Hand, typing the new quantity, with the destination in the memo |
| Stock Issue Slip (SIS) | No. 483, AW-05, 25/9/26 | Item, quantity, ledger folio, purpose of use. Also feed used (6,067 kg) and mortality (male 2, female 7) | Adjust Quantity on Hand, typing the new quantity for each item |

**What the recording shows:**

- **IGP-1662 into AW-02 Patoki Farm**, sent by the Hatchery on OGP-46: egg boxes 180, egg trays 9,000, nylon chappals 90, worker uniforms 10, assistant uniforms 5, aluminium foil 14 rolls, Gentylo injection 100 vials.
- **OGP-1366 out of Patoki** to Layer-04 Khan: drill machine 6 → 5.
- **SIS-203 at Patoki**: feed 23,739 → 14,941 kg, diesel 2,550 → 2,465 L, nylon rope 80 → 59, Aqua Kair tablets 300 → 0, HCL 240 → 180 L, Accid Pro 200 → 175 L, chips 7,552 → 7,547 bags, plus polythene, brush and holder.

**Farms (QuickBooks "sites") seen so far:** AW-01, AW-02 Patoki Farm, AW-04, AW-05, AW-06, AW-3A, AW-3B, AW-Hatchery, AW Layer-01 Jagoki, AW Layer-03 Imran Bhullar, Layer-04 Khan. That is 11, and the list may be longer.

**Item list:** 1,970 items in 18 categories. The largest are Stock in Store (884), Medicine & Vaccine (308), Electric Items (182) and Shed Items (144). It has no units, codes or balances, and it contains duplicates and spelling variants.

**Problems this shows:**

1. **Data is days behind.** Stock is only current once the slips reach the office and get typed in.
2. **Transfers are entered twice and never matched.** The sending farm's OGP and the receiving farm's IGP are separate, unlinked entries.
3. **Approval is not happening.** "Approved By" is blank on the issue slip, and "Qty Actual Received" is blank on the inward pass.
4. **The accounts person translates while typing.** Slips are written in Urdu and QuickBooks item names are in English.
5. **He does the arithmetic by hand.** QuickBooks asks for the new quantity, not the amount used.
6. **Mortality is lost.** It is on the issue slip, but QuickBooks has nowhere to put it.
7. **Stock is kept three times:** on the slip, in the farm's ledger (the folio numbers), and in QuickBooks.

## Goals and decisions

The goal is live, trustworthy stock for every farm, entered once, at the source, by people who already know the slips.

**Goals**

1. Every slip is entered at the farm on the day it happens, not typed in later at the office.
2. The Accounts Admin can see any farm's stock at any moment, plus the total across all farms.
3. A transfer between farms is one linked record, so nothing goes missing in transit unnoticed.
4. Feed used and mortality are recorded per shed.
5. Nothing is ever deleted, and every change shows who made it, when and why.

**Decisions taken**

| Decision | Choice |
| --- | --- |
| Terms | Keep the client's own words everywhere: Inward Gate Pass, Outward Gate Pass, Stock Issue Slip, Farm / Hatchery, M/s, Bilty No., Delivery Challan, Ledger Folio, Purpose of Use, the same item names and units |
| Data entry | The same three slips with the same columns, made easier (see The slips) |
| Farms | 11 farms |
| Admin | One Accounts Admin with access to all farms |
| Data entry at the farm | One person per farm enters every slip |
| Review | None. A saved slip changes stock immediately and is final unless corrected |
| Stock separation | Each farm has its own stock, and farms never share balances |
| Mortality and feed per shed | In scope, on the Stock Issue Slip as today |
| Money | Quantities only, as in QuickBooks today. No cost, price or value |
| Suppliers | Goods can come from any supplier to any farm directly |
| Devices and internet | Every farm has a smartphone and internet |
| Data migration | Not part of this document for now |

## Users and roles

The system has two roles: a Farm User for each farm and one Accounts Admin over all farms. A third, view-only login for Head Office and Purchase is suggested below.

|  | Farm User | Accounts Admin |
| --- | --- | --- |
| How many | One per farm (11) | One |
| Sees | Their own farm only | Every farm, plus totals across all farms |
| Enters | Inward Gate Pass, Outward Gate Pass, Stock Issue Slip, receipts of transfers from other farms, stock counts | Everything a Farm User can, for any farm |
| Changes a saved slip | No. They can ask for a correction, with a reason | Yes, through a correction that keeps the original |
| Manages | Nothing | Farms, sheds, items, units, users |
| Reports | Their farm's stock and history | All reports for any farm or all farms |

**No review step.** When the Farm User saves a slip, stock changes immediately and the slip is final. The Farm User's name fills the "Prepared by" line automatically. The Accounts Admin can still correct any slip later (see Corrections and audit trail).

**Suggested: a view-only login for Head Office and Purchase.** Today the white copy of every gate pass goes to Head Office and the pink copy to Purchase. A view-only login lets those people see the same gate passes and stock live, without being able to enter or change anything. It replaces two of the three paper copies and costs little to add.

## Farms, sheds and stock

Stock is held per farm. Sheds are where feed and mortality are recorded, but they do not hold stock of their own.

- **Farm / Hatchery.** The 11 sites, with the same codes and names as in QuickBooks (AW-02 Patoki Farm, AW-Hatchery, AW Layer-01 Jagoki …). Each has one Farm User and its own balance for every item.
- **Shed.** Belongs to one farm. Used on the Stock Issue Slip for feed used and mortality. Stock is not split by shed.
- **Item.** One shared list for all farms, with the same names and categories as today. Each item has a unit (KG, LTR, Qty/عدد, BG, Roll), its Urdu name and common aliases.
- **Balance.** Farm × item = quantity on hand. It is calculated from the slips, never typed in. The Accounts Admin also sees each item's total across all farms, as in the QuickBooks "All Sites" column.
- **In transit.** Stock that has left one farm on an Outward Gate Pass and has not yet been received by another farm. It belongs to neither farm's balance until received, and it is listed separately so it cannot disappear.

**Rules**

- Stock cannot go below zero. If the Farm User tries to issue more than the farm has, the slip shows how much is available and stops.
- Every slip has a farm, a date, a number and the user who prepared it.
- Slip numbers are automatic, separate per farm, and use the same prefixes the accounts person already uses as QuickBooks references: **IGP**, **OGP** and **SIS** (for example AW05-SIS-0484).

## The slips

The Farm User fills in the same three slips as today, with the same title, fields and columns in the same order, so the screen looks like the paper they already know. The difference is in what the app does for them.

### 1. Inward Gate Pass (IGP)

| On the paper slip | In the app |
| --- | --- |
| No., Sr. No. | Automatic |
| Date, Time | Automatic, editable if entered later the same day |
| Bilty No., Truck No., Driver Name | Same, typed in |
| Received the following material from M/s | Pick another farm, or pick or type a supplier |
| Demand No., Vide D. Challan No., Dated | Same, typed in |
| Item, Unit | Item searched by English, Urdu or common name. Unit fills in from the item |
| Qty As Per Delivery Challan | Same. **From another farm, this fills in from the sender's OGP** |
| Qty Actual Received | Same, and required. A shortfall is shown in red |
| Weight | Same, optional |
| Prepared by | The Farm User's name, automatic |

**Effect:** stock goes up by the Qty Actual Received.

### 2. Outward Gate Pass (OGP)

| On the paper slip | In the app |
| --- | --- |
| No., Date, Time | Automatic |
| M/s … is allowed to take out the following items | Pick another farm, or type the outside party (for repair, return to supplier, other) |
| Driver Name, Vehicle No. | Same, typed in |
| Description, Unit, Qty, Weight | Item searched by name, unit fills in, qty and weight typed. Qty cannot exceed the farm's stock |
| Prepared by | The Farm User's name, automatic |

**Effect:** stock goes down at once. To another farm, the items go *in transit* and the other farm sees them waiting to be received (see Transfers). To an outside party for repair, the item is listed as "out for repair" until it comes back on an IGP.

**Printout:** the same layout as the paper pass, bilingual, with a QR code and blank Project Manager signature line, to send with the driver. It can also be shared as a PDF on WhatsApp.

### 3. Stock Issue Slip (SIS)

The paper slip already carries feed used and mortality on its first lines. The app keeps them on the same slip but in their own section, per shed.

| On the paper slip | In the app |
| --- | --- |
| No., Farm / Hatchery, Date | Automatic |
| Feed used, Mort Male, Mort Female (first lines) | **Feed & Mortality section:** one row per shed with Feed used (KG), Mort Male, Mort Female |
| S. No., Name of Item, Quantity | Item searched by name, unit fills in, **quantity used** typed. Never the new balance |
| Ledger Folio | Filled in automatically with the item's number, and tapping it opens the item's stock card |
| Purpose of Use | Same, free text in Urdu or English, plus an optional shed |
| Prepared By | The Farm User's name, automatic |

**Effect:** stock goes down by each quantity used, and by the feed used. Mortality is stored per shed per day and does not affect stock.

### What is better on every slip

- **No arithmetic.** The Farm User enters what came in, went out or was used, and the system works out the balance.
- **No translating.** Typing "belt" or "بیلٹ" finds the fan belts. The same item name then appears everywhere.
- **No mixed units.** The unit comes from the item and cannot be changed on the line.
- **No duplicates.** A second tap on Save, or a slow connection, does not save the slip twice.
- **Nothing lost.** Every saved slip has its number and a print / share button, and can be found again by number, date or item.

## Transfers between farms

A transfer is one record that the sending farm opens and the receiving farm closes. It is no longer two unrelated QuickBooks entries.

&#91;embedded content: transfer between farms · from OGP to receipt\]

The sending farm's Outward Gate Pass creates the transfer. The receiving farm only confirms what arrived, and any gap goes to the Accounts Admin, not into thin air.

- The receiving farm cannot receive more than was sent. Extra items need their own IGP.
- A transfer still in transit after 2 days (adjustable) shows on the Accounts Admin's dashboard.
- The printed OGP carries the transfer number and a QR code, so the receiving farm can open the right waiting IGP by scanning it.
- The Hatchery-to-Patoki receipt in the recording (Hatchery OGP-46 → Patoki IGP-1662) is exactly this flow, done today as two separate entries.

## Corrections and audit trail

There is no review step, so mistakes are fixed after the fact. Nothing is ever deleted: a correction points back to the slip it fixes.

- **Correction requests.** The Farm User cannot change a saved slip. They tap "request correction" on it and give the right quantity and a reason. The request appears on the Accounts Admin's screen.
- **Corrections.** The Accounts Admin can correct any slip, at a farm's request or on their own. This creates a correction entry for the difference. The original slip stays visible, marked "corrected", with a link to the correction.
- **Cancel.** A slip saved by mistake is cancelled by the Accounts Admin with a reason, which reverses its effect on stock. An OGP whose transfer has already been received cannot be cancelled. It needs an OGP back the other way.
- **Stock count.** The Farm User or the Accounts Admin enters a physical count for the farm. The system shows the difference for each item, and saving it requires a reason. This replaces the "Adjust Quantity on Hand" screen in QuickBooks.
- **Audit trail.** Every save, correction, cancellation and settings change is logged with the user, the time, the old and new values and the reason. No one, including the Accounts Admin, can edit or remove the log.

## Item master cleanup

The 1,970-item workbook has to be cleaned before go-live, because every form depends on finding the right item quickly.

| Category | Items |
| --- | --- |
| Stock in Store | 884 |
| Medicine & Vaccine | 308 |
| Electric Items | 182 |
| Shed Items | 144 |
| Generator Items | 80 |
| Kitchen Items | 71 |
| Diesel Filter | 55 |
| Air Filter | 44 |
| Discard & Scrap | 35 |
| Oil Filter | 34 |
| Building Items | 33 |
| AI Items | 32 |
| Printing & Stationery | 22 |
| Furniture | 17 |
| Uniforms | 15 |
| Motor Repair Stock | 8 |
| RO Plant Filter | 4 |
| Packing Material | 2 |

**What needs doing, by us with the client's accounts person.** Item names stay as the staff know them. The cleanup only removes confusion:

1. **Merge duplicates and spelling variants**, for example "Chain Lock No.60(half)" and "Chian Lock No.60(half)", or the several 36-inch and 56-inch fan entries.
2. **Give every item its unit**, using the units already used in QuickBooks: KG, LTR, Qty, BG.
3. **Add Urdu names and common aliases**, taken from real slips (فین بیلٹ for fan belt, ڈیزل for diesel).
4. **Split "Feed All" into feed types**, if the client wants feed tracked by type (open question).
5. **Decide what "Discard & Scrap" means.** It may be better handled as a status than as items.

## Dashboard and reports

The Accounts Admin's home screen shows today's slips and anything unresolved across all farms. Every report can be filtered by farm and date and exported to Excel or PDF.

**Accounts Admin home screen**

- Today's slips from every farm (IGP, OGP, SIS), newest first.
- Transfers in transit, with those older than 2 days highlighted.
- Shortfalls on IGPs that have not been resolved.
- Correction requests from farms.
- Farms that have not saved a Stock Issue Slip today.

**Reports**

| Report | What it answers |
| --- | --- |
| Stock on hand | How much of each item each farm has now, plus the total across all farms |
| Item stock card | Every movement of one item at one farm, with a running balance. This replaces the Ledger Folio |
| Consumption | How much of each item each farm used over a period |
| Feed and mortality | Feed used and Mort Male / Mort Female per shed per day, with totals per farm |
| Gate register | All IGPs and OGPs for a farm, by date |
| Transfers | Everything sent between farms, with status and any shortfall |
| Out for repair | Items sent out on an OGP that have not come back |
| Corrections | Every correction, cancellation and stock-count difference, with reasons |

**Farm User home screen:** three big buttons for the three slips, today's slips, IGPs waiting to be received, and the farm's stock list.

## Language, usability and devices

The Farm Operator side is built for one person on a phone, with patchy internet and Urdu as their first language.

- **Two languages.** Every label and button shows English and Urdu together (Save / محفوظ کریں). Slip names and field names stay in the English the slips use today. Urdu uses a Nastaliq font. Numbers, dates and slip numbers stay left to right.
- **Free text in either language.** Purpose of Use, remarks and M/s names can be typed in Urdu, as on the paper slips today.
- **One slip per screen.** It looks like the paper slip, has large buttons and no accounting words.
- **Devices.** A web app that works in the phone browser and on the office PC, with nothing to install. Every farm has a smartphone, so it must run well on a low-cost Android phone.
- **Internet.** All farms have internet, so there is no offline mode. If the connection drops while saving, the slip keeps what was typed and says clearly that it was **not** saved.
- **Printing.** Gate passes and issue slips print on A4 or A5 in the same layout as today, bilingual, with a QR code that opens the record. They can also be shared as PDF on WhatsApp.

## Out of scope for version 1

These are excluded so the first version stays focused on stock. Each can be quoted separately later.

- Prices, cost, stock value, purchase bills and payments. QuickBooks stays for accounting if they still need it.
- Data migration and opening balances. To be planned separately later.
- A review or approval step for slips.
- Low-stock alerts and minimum levels.
- Purchase orders and supplier management.
- Egg production, egg sales and bird sales.
- Flock records beyond feed used and mortality, such as placement, age, weight, vaccination schedules and egg counts.
- Payroll, attendance and HR.
- Offline entry without internet.
- A native Android or iOS app. The phone browser is used instead.
- Automatic sync with QuickBooks.

## Phases and timeline

We estimate about 12 weeks from scope sign-off to every farm live. That is 8 weeks of building, then a 2-week pilot and a 2-week rollout.

&#91;embedded content: delivery phases · 5 phases, 2 gates\]

No farm stops using paper until the pilot farm's app records have matched its paper slips for 2 weeks. The timeline depends most on how quickly the item list is cleaned and the opening counts are done, because both need the client's people.

## Open questions for the client

Settled so far: 11 farms, no review step, suppliers can deliver to any farm, every farm has a smartphone and internet, Farm Users may enter stock counts, and no low-stock alerts for now.

Still open:

- [ ] **Farm and shed list:** the names of the 11 farms and the sheds at each.
- [ ] **Feed:** is feed tracked as one item ("Feed All") or by feed type?
- [ ] **Mortality:** is it always Mort Male and Mort Female? Do layer farms and the hatchery record it differently? Are culls needed?
- [ ] **Stock Issue Slip timing:** is it filled once a day per farm, or whenever items are issued? This decides when a farm counts as "missing" today's slip.
- [ ] **Head Office and Purchase:** do they want the suggested view-only login?
- [ ] **Printers:** which farms have one, and is it A4 or A5?
