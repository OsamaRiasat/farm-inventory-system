# 01 · Domain

Source: `docs/source/requirements.md`. This file is the short version.

## The problem
Each farm writes paper slips. One accounts person re-types them into QuickBooks: days late, transfers entered twice and never matched, arithmetic done by hand, Urdu→English translated while typing, mortality lost.

The app: the farm's one data-entry person fills in **the same three slips** on phone or PC. Stock updates on save. Transfers link automatically. **Quantities only, never money.**

## Glossary — use these words exactly, everywhere (UI, code, comments)
| Term | Meaning |
| --- | --- |
| **Inward Gate Pass (IGP)** | Goods coming into a farm. Stock **up** by Qty Actual Received |
| **Outward Gate Pass (OGP)** | Goods leaving a farm (to another farm or an outside party). Stock **down** |
| **Stock Issue Slip (SIS)** | Items used at the farm, plus Feed & Mortality per shed. Stock **down** |
| **Farm / Hatchery** | A site (11). Holds its own stock |
| **Shed** | Belongs to a farm. Only for feed used + mortality. Holds no stock |
| **M/s** | The party name (supplier, sender, receiver) |
| **Bilty No.** | Transport receipt number |
| **Delivery Challan (D. Challan)** | Sender's delivery note. "Qty As Per Delivery Challan" |
| **Qty Actual Received** | What really arrived. Required |
| **Ledger Folio** | The item's number; opens the item stock card |
| **Purpose of Use** | Free text (Urdu or English) on SIS lines |
| **Mort Male / Mort Female** | Mortality counts per shed per day. Does not affect stock |
| **In transit** | Left on an OGP to another farm, not yet received. Belongs to neither farm |
| **Out for repair** | Left on an OGP to outside party (repair) until back on an IGP |
| **Prepared by** | The logged-in user's name, automatic |

Never use accounting words in the Farm User UI (debit, credit, adjustment, vendor, journal…).

## Roles
| | Farm User | Accounts Admin |
| --- | --- | --- |
| Count | 1 per farm (11) | 1 |
| Sees | Own farm only | All farms + All Farms totals |
| Enters | IGP, OGP, SIS, receive transfers, stock counts | Same, for any farm |
| Changes saved slip | No — "Request correction" with reason | Correct / Cancel (original kept) |
| Manages | Nothing | Farms, sheds, items, units, users |

Possible 3rd role (not decided): view-only for Head Office / Purchase → reuses A1–A5, A7 with actions hidden.

## Hard rules (enforce in the mock API **and** the form schemas)
1. **No review step.** Save = final; stock changes immediately.
2. **Stock never below zero.** Issue/OGP qty > on-hand → blocked with "Only 6 in stock".
3. **Balances are calculated from movements**, never typed.
4. **Slip numbers automatic, per farm**: `AW05-SIS-0484`, `AW02-IGP-1663`, `AW02-OGP-1367`.
5. Every slip has farm, date, time, number, preparedBy.
6. **Unit comes from the item** and cannot be changed on a line.
7. **Nothing is deleted.** Corrections point to the original; cancel reverses stock with a reason.
8. An OGP whose transfer is already received **cannot be cancelled**.
9. Receiving farm **cannot receive more than was sent** ("Extra items need a separate IGP").
10. Shortfall (received < challan/sent) is **amber, not an error** — the slip still saves.
11. Transfer in transit > 2 days (configurable) → flagged on the admin dashboard.
12. **Double save must not create two slips** (button disables + idempotency on the save call).

## Transfers
OGP (farm A → farm B) creates a Transfer `in_transit`. Farm B sees it under "Waiting to receive" → opens F3 (IGP pre-filled from the OGP; only Qty Actual Received is entered). Result: `received` or `short`. Admin resolves shortfalls (write off with reason, or keep open).

## Farms (QuickBooks sites, use as-is)
AW-01, AW-02 Patoki Farm, AW-04, AW-05, AW-06, AW-3A, AW-3B, AW-Hatchery, AW Layer-01 Jagoki, AW Layer-03 Imran Bhullar, Layer-04 Khan. Type: breeder | layer | hatchery. Print header: "SUTLEJ FEEDS BREEDERS" or "SUTLEJ FEEDS LAYER" by farm type.

## Units
`KG | LTR | QTY | BG | ROLL | VIAL`. Urdu on slips: عدد (pieces), کلو, لیٹر, گڈی. Decimals only for KG and LTR.

## Out of scope (v1)
Money/prices, data migration, approval step, low-stock alerts, POs, egg/bird sales, flock records beyond feed + mortality, HR, offline mode, native app, QuickBooks sync.
