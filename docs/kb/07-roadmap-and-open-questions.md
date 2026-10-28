# 07 · Roadmap and open questions

## Phase 1 scope
**In:** every screen (responsive), all three slips end to end in the browser (fill, validate, save, view, print), balances recalculated from mock data, transfers between two mock farms, print + PDF share, mock role switch, typed API module the backend will implement unchanged.

**Not in:** real backend/DB/login/permissions, real item data (≈60 mock items), Excel export (buttons shown, not wired), data migration.

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
| Feed: one item ("Feed All") or feed types? | Feed picker over `isFeed` items; seed has Feed All + 2 types |
| Mortality: same Male/Female columns for layer farms & hatchery? Culls? | Male / Female everywhere |
| Shed names and count per farm | 3–6 mock sheds ("Shed 1"…) |
| SIS once a day or whenever issued? | Many per day allowed; "missing" = none today |
| Printers: A5 or A4? Which farms? | A5 default, A4 option |
| Phone models for testing | Test at 360 px |
| View-only login for Head Office / Purchase? | Not built; keep actions role-gated so it's easy to add |
