# RBAC Plan

Status: **proposed** — decisions locked, implementation not started.

Adds role-based access control to the Evertas MGA dashboard. Today authorization
is effectively "has a valid session": every `authenticated` user gets permissive
`using (true)` read + write on all ~20 tables
(`supabase/migrations/20260701174102_grant_authenticated_read_access.sql`), the
only gate is `src/routes/_dashboard.tsx` checking a session exists, and the
`invite-user` edge function treats any session as authorized.

## Decisions (locked)

- **Roles:** `admin`, `underwriter`, `accounting`, `read_only`, backed by a
  data-driven `role_permissions` table (role × table → read/write) rather than
  hand-written per-table policies.
- **Refresh model:** role lives in a JWT claim (via the Custom Access Token
  Hook) so RLS stays cheap; each client subscribes to its own `user_roles` row
  and calls `supabase.auth.refreshSession()` on change → new permissions apply
  in ~1–2s. Fallback for other/offline sessions: next token refresh (≤ `jwt_expiry`, currently 3600s).

## Answering the three design questions

### 1. How roles are assigned (invite timing)

`inviteUserByEmail` creates the `auth.users` row **immediately** at invite time
(unconfirmed state) — the user exists *before* they accept. Acceptance
(`src/components/auth/AcceptInviteForm.tsx`) only sets their password. So:

- Role is chosen **at invite time** and persists through acceptance; no
  post-acceptance assignment step is needed.
- `user_roles` (source of truth) is keyed by `user_id` → `auth.users(id)`. The
  `invite-user` edge function, after `inviteUserByEmail` returns the new user
  id, upserts `(user_id, role)`. Upsert handles re-invites / delete + re-invite.
- Admins can change a role later from a Team/Users admin screen.

### 2. How roles map to tables

Defense-in-depth, two layers:

**A. Database (authoritative).** Data-driven RLS to match the schema-driven app:

- `role_permissions(role, resource, can_read, can_write)` where `resource` = table name; seeded via migration.
- `authorize(resource text, action text) returns bool` (STABLE) reads the
  caller's role from the JWT claim and checks `role_permissions`.
- The `do $$ … foreach $$` loop in the existing grant migration is reused to
  replace `using (true)` with `using (authorize(<table>, 'read'))` /
  `with check (authorize(<table>, 'write'))`, so policies stay in sync with the schema.

**B. Frontend (UX only, not a security boundary).** Filter the schema-driven
nav in `src/data/tables.ts` / `src/components/dashboard/Sidebar.tsx` and
hide/disable write actions (the `New…` forms, `PolicyActions`, etc.) based on
the session's role, so users don't see actions that would RLS-fail.

### 3. How updates propagate (refresh)

JWT claims are frozen at issuance and the token lives until `jwt_expiry` (1h),
so a role change is **not** automatically instant. To get near-instant refresh:

- `user_roles` stays the live source of truth.
- The owning client subscribes via Supabase Realtime to its own `user_roles`
  row; on change → `supabase.auth.refreshSession()` re-runs the access-token
  hook and mints a new JWT with the updated claim. UI + RLS reflect the new role in ~1–2s.
- Other/offline sessions pick up the change on next token refresh (≤1h);
  optionally shorten `jwt_expiry` to tighten the worst case.

## Seed permission mapping (tunable)

- **admin** — all tables read/write + user management / invites.
- **underwriter** — write: policies, binder, binder_section, binder_part,
  new_business_submissions, renewals, claims, agencies, carriers, clients,
  underwriters, capacity, license; read: everything else.
- **accounting** — write: invoices, payments, accounts_receivable,
  accounts_receivable_payments, capacity_remittance, budget, subscriptions;
  read: the rest.
- **read_only** — read all, write none.

## Implementation phases

**Phase 1 — Data model (migrations)**
1. `app_role` enum + `user_roles` table (RLS: user reads own row; admins read/write all).
2. `role_permissions` table + seed rows for each role × resource.
3. `authorize(resource, action)` helper reading the JWT claim.
4. Backfill: assign `admin` to the existing/first user so we're not locked out.

**Phase 2 — Custom access token hook**
5. SQL hook injecting `user_role` (optionally a compact permissions map) into the
   JWT; enable `[auth.hook.custom_access_token]` in `config.toml` and on the hosted project.

**Phase 3 — RLS rollout**
6. Rewrite the permissive policies to call `authorize(...)` via the existing
   table loop. Verify per-role via psql (dashboard is auth-gated; see memory note).

**Phase 4 — Invite & admin surface**
7. Gate `invite-user` to admins; accept + persist `role`.
8. Add role dropdown to `src/components/auth/InviteUserForm.tsx`.
9. New Team/Users admin route: list users + roles, change role (triggers Realtime refresh).

**Phase 5 — Frontend enforcement (UX)**
10. Load session role/permissions into a provider/hook.
11. Filter nav; hide/disable write actions; optional per-route `beforeLoad` role checks in `_dashboard.tsx`.
12. Realtime subscription on own `user_roles` row → `refreshSession()`.

**Phase 6 — Verify**
13. psql RLS tests per role; manual UI pass per role; `pnpm gen:types`.

## Notes / gotchas

- Enabling the Custom Access Token Hook and the admin-gated invite function
  requires config changes that apply to the **hosted** Supabase project too, not
  just local — wire up local `config.toml` + migrations, then flip the matching hosted-dashboard toggles.
- Do the admin backfill (Phase 1 step 4) before rewriting RLS (Phase 3), or the
  first admin gets locked out.
