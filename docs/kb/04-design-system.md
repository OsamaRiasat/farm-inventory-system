# 04 · Design system — simple on purpose

**Principle: plain, calm, high-contrast.** It must read in sunlight on a cheap Android phone, and the three slip types must be impossible to mix up. The screen looks like the paper slip. No decoration, gradients, shadows-for-effect, animations or illustration. If a choice is between "pretty" and "fast to enter", pick fast.

## Simplicity rules
- One slip per screen; reads top to bottom like the paper: header → lines → footer → Save.
- One primary action per screen. Secondary actions are plain text buttons.
- Labels always visible above fields (no placeholder-only labels).
- Colour always comes with a word or icon. Never colour alone.
- No modal stacks. Only sheets for: item search (phone), summary sheet, confirm leave/cancel.
- Light mode only. Dark mode is not needed.

## Colour tokens (`src/app/globals.css` → Tailwind `@theme`)
| Token | Use | Value |
| --- | --- | --- |
| primary | Buttons, links, active nav | `#1F6B4A` |
| igp | IGP chip + icon | `#2E7D32` |
| ogp | OGP chip + icon | `#C2571A` |
| sis | SIS chip + icon | `#1E5AA8` |
| warning / warning-bg | Shortfall, missing SIS, > 2 days in transit | `#B7791F` on `#FDF4E3` |
| danger / danger-bg | Errors, not saved, over stock | `#C62828` on `#FDECEC` |
| ink / muted | Text | `#1A1D1F` / `#5B6166` |
| surface / surface-2 / line | Background, panels, borders | `#FFFFFF` / `#F5F6F4` / `#E1E4E0` |

All text WCAG AA.

## Typography
| Use | English (Inter) | Urdu (Noto Nastaliq Urdu) |
| --- | --- | --- |
| Body | 16 / 24 | 18 / 36 |
| Small (helper, table) | 14 / 20 | 16 / 32 |
| Slip title | 20 semibold | 22 |
| Numbers in tables | Inter tabular-nums, right-aligned | — |

Fonts self-hosted (`next/font/local` or `next/font/google` which self-hosts at build). Nastaliq needs ~2× line height: **never give a fixed height to a container holding Urdu.**

## Bilingual text
- Every label, button, title and menu item shows **English and Urdu** together via the `<Bi>` component (C5). Default: English on top, Urdu below at 1.15×. User can swap order (setting).
- Page direction stays **LTR**. Urdu sits in its own element with `dir="rtl" lang="ur"`.
- Numbers, dates, slip numbers, item codes: always English digits 0–9, LTR.
- Free-text inputs (Driver Name, M/s, Purpose of Use): `dir="auto"`.
- All strings in `src/messages/en.json` + `ur.json`, keyed by id. **No hard-coded UI text in components.**
- Slip and field names stay in the English the slips use; Urdu is the secondary line.

## Spacing, touch, layout
- 4 px scale: 4, 8, 12, 16, 24, 32, 48.
- Touch targets ≥ 48 × 48 on Farm screens. Save button 56 px tall, sticky at bottom.
- Radius: 8 px cards/inputs, full on chips.
- Icons: lucide-react, 24 px, always next to a word.

## Breakpoints
| Width | Layout |
| --- | --- |
| < 640 | Phone: one column, bottom nav, slip lines as cards |
| 640–1023 | Tablet: one wide column, slip lines as a table |
| ≥ 1024 | Desktop: sidebar + content, full-width admin tables |

Farm screens designed at 360 px, Admin at 1366 px; both must work at every width.

## Shared components (build first)
| ID | Component | Key details |
| --- | --- | --- |
| C1 | Item search | EN name, UR name, alias, code; mixed input ("belt 89A", "فین بیلٹ"); normalise Urdu ی/ي and ک/ك; shows EN + UR + "in stock"; recent first. Full-screen sheet on phone, dropdown on desktop. **Fully keyboard operable.** |
| C2 | Quantity input | `inputMode="decimal"`/`numeric`, thousands separators, decimals only for KG/LTR, unit fixed beside it, error below |
| C3 | Slip lines | Card per line on phone, table row ≥ 640. Add/remove line, auto S. No. |
| C4 | Slip header | Title, No., Farm, Date, Time — same on every slip, bilingual title |
| C5 | Bilingual label `<Bi>` | Both texts, order from user setting |
| C6 | Type chip | IGP / OGP / SIS colour + icon |
| C7 | Status chip | Saved, Corrected, Cancelled, In transit, Received, Short — colour + word |
| C8 | Farm picker | code + name; "All farms" for admin |
| C9 | Summary sheet | "before → after" per line, confirm before save |
| C10 | Data table | Sort, filter bar, sticky header + first column, pagination 50, keyboard row navigation |
| C11 | Filter bar | Farm, date range, type, item — same on every admin list/report |
| C12 | Print frame | A5 portrait default, A4 option, print CSS, B/W |
