# 09 · Backend architecture

**Status (24 Nov 2026): decided and built, except hosting.** Stack confirmed by the developer: Next.js route handlers + PostgreSQL with **Prisma 7**; the browser mock was removed. Steps 2–6 of the build order below are done; the AWS deploy (step 1) and opening balances / pilot (step 7) are next. The requirements and the design spec name no backend stack; they only say the backend implements the API in `src/lib/api` so no screen changes.

## Decision in one line
One Next.js app serves both the screens and the API (route handlers), backed by one PostgreSQL database, deployed as one Docker container on AWS App Runner.

## Why TypeScript in the same app (not a separate Python / FastAPI service)
- The rules already existed in TypeScript (the phase 1 mock engine and reports); they were ported to `src/server/services/` with the in-memory arrays swapped for SQL.
- **One copy of the rules.** The Zod schemas in `src/features/*/schema.ts` check the form in the browser and the request on the server, so messages like "Only 6 in stock" can't drift.
- Shared types (`src/types/domain.ts`, `src/lib/api/types.ts`) and messages (`src/messages/*.json`) — no generated client to keep in sync.
- One language, one deploy, one service to run for a small team.
- Load is tiny (11 farms, ~12 users); any stack copes, so the deciding factor is reuse.

FastAPI is still workable if the backend developer is Python-first: then the engine, schemas and reports are rewritten in Python/Pydantic, every error must return the same message id + values + field path, and the shared contract tests (see `08-testing-roadmap.md` → After phase 1) are mandatory, written first. It becomes two services (Next.js + API) plus the database.

## The big picture

```
 Farm User (phone browser)      Accounts Admin (office PC)
            │                              │
            └──────────── HTTPS ───────────┘
                           │
                  AWS App Runner (Mumbai)
        ┌──────────────────┴──────────────────┐
        │      ONE Next.js container            │
        │                                       │
        │  FRONTEND (browser)                   │
        │   pages → TanStack Query hooks        │
        │     → src/lib/api  (fetch /api/...)   │
        │                 │                     │
        │  BACKEND (server)                     │
        │   /api/* route handlers               │
        │     → check login + farm access       │
        │     → service (engine rules)          │
        │     → Prisma → SQL transaction       │
        └──────────────────┬──────────────────┘
                           │
                  RDS PostgreSQL (private)
                  automated daily backups
```

## A save, end to end (OGP)
1. Farm User fills the slip; the Zod schema checks it in the browser ("Only 6 in stock").
2. `api.saveOGP(input)` → `POST /api/slips/ogp` with the session cookie.
3. The route handler checks the user is logged in and may act on this farm (a Farm User only their own farm; the Admin any farm).
4. The service re-runs the **same** Zod schema, then in **one transaction**:
   - locks this farm's stock for the items on the slip (so two saves racing for the last stock: exactly one wins),
   - checks no balance goes below zero,
   - takes the next number from `counters` (`AW02-OGP-…`),
   - returns the existing slip if the idempotency key was already used,
   - inserts slip, lines, movements, transfer, audit entry.
5. Commit → slip returned. Any failure → nothing saved; the screen shows the error's message id in EN + UR (`ApiError`).
6. Other users' screens pick it up on their next refetch (replaces today's cross-tab `storage` event behind `onExternalChange`; polling via TanStack Query `refetchInterval` first, server-sent events later if needed).

## Code layout
```
prisma/
  schema.prisma                     tables (see 03-data-and-api.md → Database)
  migrations/                       SQL; the first one adds the audit trigger + paper No. index by hand
  seed.ts                           npm run db:seed (demo) / db:seed:base
prisma.config.ts                    Prisma 7 config (DATABASE_URL from .env)
docker-compose.yml                  local Postgres 17 on port 5433
src/
  app/
    (farm)/ (admin)/ login/ print/   screens — unchanged except login + Sign out
    api/                            route handlers, thin: handler(role, fn) → service → JSON
  proxy.ts                          no session cookie → /login (optimistic; real checks in every route)
  features/*/schema.ts              Zod rules — shared by browser AND server
  types/domain.ts                   shared types — the contract
  messages/en.json, ur.json         shared labels and error text
  lib/
    api/http.ts                     fetch client, same function names the mock had
    api/index.ts                    `export const api = httpApi`
    session.ts                      useSession() from GET /api/me; signIn / signOut
    slip-rules.ts                   pure helpers shared by services (deltas, numbers, returned per line)
  server/                           never imported by screens (ESLint rule)
    db.ts                           one PrismaClient (adapter-pg)
    repo.ts                         withFarmLock, rulesFor (RuleContext from the DB), balances, numbers, audit
    mappers.ts                      rows ↔ domain types
    route.ts                        handler(), farmFor / requireFarm, error JSON
    auth.ts, password.ts            sessions, bcrypt
    visible.ts                      which slips a Farm User may see
    services/                       slips, transfers, corrections, returns, stock-counts, stock, reports,
                                    dashboard (+ audit), setup (farms, items, users, item search)
    seed/                           base (farms, items, logins) + demo (two weeks through the services)
  generated/prisma/                 Prisma client (generated on npm install; git-ignored)
```

## Database (PostgreSQL)
| Area | Tables |
| --- | --- |
| Setup | `farms`, `sheds`, `items`, `users` (role, farm), `suppliers` |
| Slips | `slips` (IGP / OGP / SIS header), `slip_lines`, `transfers`, `sis_returns` |
| Stock | `movements` (the only source of balances), `stock_counts` |
| Control | `counters` (slip numbers per farm + type), `idempotency_keys`, `correction_requests`, `audit_log` |

- Balances stay derived from `movements` (`01-domain.md` rule 3). Add an indexed / materialised view later only if reports get slow.
- `AuditEntry`: a trigger refuses UPDATE, DELETE and TRUNCATE (requirements: nobody can edit or remove the log). A separate INSERT-only database role can be added on AWS.
- Nothing is deleted anywhere: corrections and cancellations are new rows linked to the original.
- "Today" and `postedAt` come from the server clock in Pakistan time (`Asia/Karachi`, explicit in `src/lib/dates.ts`).

## Login and permissions
- `users` table with hashed passwords; roles Farm User (with a farm) and Accounts Admin. View-only Head Office / Purchase login only if the client asks (`07-roadmap-and-open-questions.md`).
- Server-only session cookie: a random token, stored hashed in `Session` (no Auth.js needed for username + password).
- S1 login (username + password) replaced the mock role + farm picker; `FarmGate` / `AdminGate` keep their job but read the real session. Sign out on Farm Home and the admin top bar.
- Every route handler checks role and farm — never trust the farm id in the request.

## AWS
| Need | Service |
| --- | --- |
| App (frontend + API) | App Runner, one Docker image (`output: "standalone"`, `next start`) |
| Database | RDS PostgreSQL, `db.t4g.small`, automated backups, private subnet |
| Secrets | Secrets Manager (database URL, session secret) |
| Container registry | ECR — stores the app's Docker image (not pictures; the app stores no images) |
| Deploy | GitHub Actions: test → build image → push to ECR → App Runner deploys |
| Logs | CloudWatch (built into App Runner) |
| Domain + HTTPS | Route 53 + App Runner's certificate |
| Region | Mumbai `ap-south-1` (or UAE `me-central-1`) — closest to the farms |

- Cheaper alternative: Lightsail container service + Lightsail managed database (flat monthly price; enough for ~12 users).
- Not Amplify: the app uses Next 16.4 with `cacheComponents` and `partialPrefetching`; a container runs `next start` exactly as locally, while Amplify's Next.js support tends to lag new releases.
- Not serverless functions: a long-running container keeps a small database connection pool; serverless would need RDS Proxy.
- No file storage needed. If slip photos are ever attached, add S3.

## Build order
1. **Next:** `output: "standalone"` + Dockerfile; App Runner + RDS + Secrets Manager; `prisma migrate deploy` on release; `db:seed:base` once. The Vercel demo needs a database now (the mock is gone).
2. ✓ Prisma tables + migrations + seed script (farms, sheds, items, users; demo history).
3. ✓ Engine ported to `src/server/services/`: slips, transfers, corrections and returns, stock counts, reports.
4. ✓ `/api/*` route handlers + `src/lib/api/http.ts`; `src/lib/api/index.ts` switched; mock removed.
5. ✓ Real login, server-side permission checks.
6. ✓ Rule tests run on the services against a test database; concurrency, permission, idempotency and audit tests in `e2e/backend.spec.ts`.
7. Load opening balances (client's counts), then the two-week pilot with paper side by side.

## Open points
- ~~Confirm stack vs FastAPI~~ — TypeScript + Prisma, 24 Nov 2026.
- Confirm AWS region and App Runner vs Lightsail (cost vs control).
- Lists (`listSlips`, reports) load everything matching the filter; add paging / date limits once a year of data makes them slow.
- Password change / reset: not built. Today the Admin re-runs a seed script or sets a hash by hand; an A10 "reset password" is the next auth feature.
- Review the types added in week 2 that are not in the spec (`03-data-and-api.md`).
- Live updates: polling first; decide if server-sent events are worth it.
