# 07 · Roadmap and open questions

## Phase 1 scope
**In:** every screen (responsive), all three slips end to end in the browser (fill, validate, save, view, print), balances recalculated from mock data, transfers between two mock farms, print + PDF share, mock role switch, typed API module the backend will implement unchanged.

**Not in:** real backend/DB/login/permissions, real item data (≈60 mock items), data migration. Excel export: formatted .xlsx for the farm stock report (grouped by category), the item stock card and every admin report (28 Nov 2026).

**Since 24 Nov 2026 (after phase 1):** the real backend replaced the mock — PostgreSQL, username + password login, server-side rules and permissions (`09-backend-architecture.md`). Still not in: AWS hosting, opening balances from the client's counts, password reset.

## Build order (spec estimate: 7 weeks, 1 frontend dev)
| Week | Build | Client sees |
| --- | --- | --- |
| 1 | Tokens, fonts, bilingual label setup, low-fi F1–F5 + A1 | Wireframe link to confirm layout vs paper |
| 2 | C1–C12, mock store + seed | Item search EN/UR, slip lines on a phone |
| 3 | F1, F2, F3, F5 | Save an IGP and an SIS, balances change |
| 4 | F4, transfers end to end, F6–F8, S2 print | OGP at one farm, receive at another; print/PDF |
| 5 | A1–A5 | Admin live view of all 11 farms |
| 6 | F9, F10, A6–A11 | Reports, stock count, setup |
| 7 | Urdu review with native reader, low-cost Android, real printer, fixes | Final demo build |

Progress is tracked in `docs/progress.md`.

## Open questions (client) — don't block on these; use the default and flag it
| Question | Default until answered |
| --- | --- |
| Language order for Farm Users: EN or UR first? | English first, toggle available |
| Urdu slip names (آمد گیٹ پاس, روانگی گیٹ پاس, اشیاء جاری پرچی) correct? | Use these drafts |
| Branding / logo; "Sutlej Feeds Breeders/Layer" for print header? | Use those names, no logo |
| Feed: one item ("Feed All") or feed types? | One item, Feed All (as in the client's item list) |
| Units for the 1,970 items (the workbook has none) | Our guess by name — see `03-data-and-api.md` → Mock seed → Items |
| Urdu names / aliases for the items | Only the ~60 everyday items; the rest show the category |
| Duplicates and spelling variants ("Chain Lock No. 60(half)" / "Chian Lock No.60(half)"; 23 names in two categories) | **Decided 28 Nov 2026 (developer, T02):** the 23 same-name pairs are merged (Stock in Store copy kept, else lowest Item No.). Spelling variants are still separate items |
| "Discard & Scrap": items or a status? | Items in their own category, as in the workbook |
| Mortality: same Male/Female columns for layer farms & hatchery? Culls? | Male / Female everywhere |
| Shed names and count per farm | 3–6 mock sheds ("Shed 1"…) |
| SIS once a day or whenever issued? | Many per day allowed; "missing" = none today |
| Printers: A5 or A4? Which farms? | A5 default, A4 option |
| Phone models for testing | Test at 360 px |
| View-only login for Head Office / Purchase? | Not built; keep actions role-gated so it's easy to add |
| Return unused after an SIS: does the farm write a paper note for it? Can the Farm User do it without the Admin? | No paper note: system number `AW02-SIS-0484-R1`, no paper No. Farm User returns on their own SIS; only the Admin cancels a wrong return (21 Nov 2026) |
| Daily Report (T07): only one per farm per date? | **Yes, one per date** (a cancelled one frees the date). Ask the client if a farm ever sends two (e.g. morning + evening collection) |
| Daily Report: does the farm have a paper DR book (paper No. required)? | Paper No. `DR-…` required like every slip. If there's no book, make it optional |
| Daily Report: should Gatta Tray / Plastic Tray / Eggs Box ever move stock, and should "Gatta Tray" move to Current Assets? | No stock effect, recorded only (as asked). Gatta Tray stays the existing item No. 1687 in Packing Material |
| Daily Report: correction? | No Correct / Request correction: the Admin cancels and the farm re-enters |
| Backend stack and hosting (not named in requirements or spec) | Decided 24 Nov 2026: Next.js route handlers + PostgreSQL (Prisma 7), built. Hosting default: one Docker container on AWS App Runner, RDS in Mumbai — see `09-backend-architecture.md` |

## Answered (client issue list, 29–30 Oct 2026)
| Question | Answer |
| --- | --- |
| Show our automatic number or the paper book's? | Farm types the paper No. on every slip; farms and prints see only that. System number kept underneath, shown to the admin |
| Paper No. repeated? | Refused per farm + slip type |
| Can the slip date change? | Yes: arrival / dispatch / issue date, any earlier date incl. previous months (client, 6 Nov 2026 — issue #18), never future. Posting date shown separately |
| Feed & Mortality on the SIS? | Removed. Feed is an item line; mortality not recorded |
| Ledger Folio on the SIS? | Typed by the storekeeper (their ledger page), not the item number |
| Draft kept when leaving a slip? | No — every visit starts an empty slip |
