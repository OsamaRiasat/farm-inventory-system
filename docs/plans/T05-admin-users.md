# T05 — Admin: add users, edit users, set a new password

**Tracker:** T05 · **Priority:** Normal
**Decision (developer, 28 Nov 2026):** on the Admin Users page (A10) the Admin can **add** a user, **edit** a user (name, username, phone, role, farm, active) and **set a new password**. Today A10 is read-only and only the seed creates logins.

## Today
- `src/features/admin/users-list.tsx` — read-only table (note "Phase 1: demo data, read-only").
- `src/app/api/users/route.ts` — `GET` only (`listUsers` in `src/server/services/setup.ts`).
- `src/server/password.ts` (bcrypt hash/verify), `src/server/auth.ts` (sessions; sign-in and session lookup already refuse inactive users).

## Change
**API** (thin routes, `handler("admin", …)` from `src/server/route.ts`; `by` from the session, never the body)
- `POST /api/users` — create. `PATCH /api/users/[id]` — edit. `POST /api/users/[id]/password` — set a new password.
- Client: `src/lib/api/index.ts` + `http.ts` (`api.saveUser`, `api.setPassword`), hooks in `src/lib/api/queries.ts` invalidating `users`.

**Rules** — Zod schema `src/features/admin/user-schema.ts`, used by the form and the service; messages as ids, EN + UR:
- name required; username required, trimmed, lower-case, `[a-z0-9._-]`, unique ("This username is taken").
- role `farm` → farm required; role `admin` → no farm.
- password ≥ 8 characters, confirm must match (form only); hashed with `src/server/password.ts`.
- The Admin can't deactivate or demote themselves, and the last active Admin can't be deactivated/demoted.
- Password change **or** deactivation deletes that user's `Session` rows → signed out everywhere.
- Service functions in `src/server/services/setup.ts` inside `inTx`; return `toUser` (never the hash).
- Audit: `add_user`, `edit_user`, `set_password` — record who/when, **never** the password. Check the action union in `src/types/domain.ts` and the audit screen's labels.

**UI** (`src/features/admin/users-list.tsx`, A10)
- "Add user" button + click on a row → sheet modelled on `src/features/admin/items-setup.tsx` (Enter → next, Ctrl/⌘+S save, Esc close; focus first field after `showModal()`).
- Edit sheet has a separate **Set new password** block (password + confirm + its own button), so editing details never touches the password.
- Remove the "read-only" note. Every label `<Bi>` EN + UR.

**Docs**: `docs/kb/02-screens.md` A10, `03-data-and-api.md` endpoints, `09-backend-architecture.md` auth note; tick "Users: change / reset password…" in `docs/progress.md` Next.

## Tests (`e2e/backend.spec.ts` for rules, screen test for A10)
- Admin creates a Farm User for a test farm → can sign in.
- Set new password → the user's old session gets 401 / redirected to login; new password works, old doesn't.
- Deactivate → can't sign in. Duplicate username refused. Last-admin guard. Farm User calling the endpoints → 403.
- Keyboard: open Add user, fill with Enter, save with Ctrl+S.

## Live note
After deploy the developer can hand out real passwords from A10 instead of the seed's — mention it in the session summary.
