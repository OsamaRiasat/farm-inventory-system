# 06 · States, messages and print

Every screen designs its empty, loading and error states, not only the filled one. Messages are short, bilingual and say what to do next.

| State | Where | What the user sees |
| --- | --- | --- |
| Loading | Any list or slip | Skeleton rows in the content's shape, never blank |
| Empty | Lists, waiting to receive, search | One line + next action: "No slips today. Start with the buttons above." |
| Saving | Save button | Spinner, disabled — second tap does nothing |
| Saved | After any slip | Green banner "IGP AW02-IGP-1663 saved" + Print / Share / New slip. Form clears |
| Not saved | Connection lost | Red banner "Not saved. Check internet and tap Save again." Everything typed stays |
| Field error | Under a field | Red text: "Only 6 in stock", "Enter Qty Actual Received" |
| Shortfall | IGP line, transfer | Amber row + "Short by 3". Not an error — slip can be saved |
| Unsaved changes | Leaving a half-filled slip | "Leave without saving? The slip will be lost." Stay / Leave |
| Corrected / Cancelled | Slip detail | Top banner: date, by whom, reason, link to correction |
| Not allowed | Admin-only action, wrong farm | **Hidden**, not disabled, for the Farm User |

Half-filled slip draft is kept in `sessionStorage` while the tab is open, so a reload doesn't lose it.

## Print layouts (S2 / C12)
Copy the paper slip so gate staff and drivers recognise it.
- **Header:** "SUTLEJ FEEDS BREEDERS" / "SUTLEJ FEEDS LAYER" (by farm type), slip title in a box, farm code in the top-right box, No., Date, Time.
- **Body:** same fields and columns in the same order as paper. Empty rows not printed.
- **Footer:** Prepared by (name), blank signature line for Project Manager (gate passes) or Approved By (SIS). No copy-colour footer.
- **QR code** top right → opens the slip; on an OGP to another farm it opens F3 at the receiving farm.
- "Corrected" / "Cancelled" stamp when applicable.
- A5 portrait default, A4 option, black and white only.
- Share: same layout as PDF (react-pdf, Urdu font embedded) via the phone share sheet (WhatsApp).
- Test Urdu printing on a real printer early.

## Paper references (in `docs/source/frontend-design-spec-phase1.pdf`, pp. 2–9)
- **IGP** header: No., Sr. No., Time, Date, Bilty No., Truck No., Driver Name, M/s, Demand No., D. Challan No., Dated. Table: Sr. No, Item, Unit, Qty As Per Delivery Challan, Qty Actual Received (+ Weight). Footer: Prepared by, Project Manager.
- **OGP**: M/s "is allowed to take out the following items", No., Date, Driver Name, Vehicle No., Time. Table: Sr. No, Description, Unit, Qty, Weight. Footer: Prepared by, Project Manager.
- **SIS**: No., Farm / Hatchery, Date. Table: S. No., Name of Item, Quantity, Ledger Folio, Purpose of Use (first lines: Feed used, Mort Male, Mort Female). Footer: Prepared By, Approved By.
