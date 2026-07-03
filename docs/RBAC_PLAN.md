# RBAC Plan

Status: **implemented (backend + invite/auth + frontend enforcement).** Only
per-role verification (Phase 6) and optional nav read-filtering remain — see
[Implementation status](#implementation-status) below. The design sections that
follow describe the shipped system; note the `viewer` role was named `read_only`
in the original proposal.

Adds role-based access control to the Evertas MGA dashboard. Previously
authorization was effectively "has a valid session": every `authenticated` user
got permissive `using (true)` read + write on all ~20 tables
(`supabase/migrations/20260701174102_grant_authenticated_read_access.sql`), the
only gate was `src/routes/_dashboard.tsx` checking a session exists, and the
`invite-user` edge function treated any session as authorized.

## Implementation status

| Phase | Area | Status | Where |
|---|---|---|---|
| 1 | `app_role` enum, `user_roles`, `role_permissions`, `authorize()` | ✅ done | `20260703021911_rbac.sql` |
| 1 | Admin backfill for the dev/seed user | ✅ done | `supabase/seed.sql` |
| 2 | Custom Access Token Hook injects `user_role` claim | ✅ done | `20260703023018_auth-hook.sql`, `config.toml` |
| 3 | Role-based RLS (`rbac read`/`rbac write` → `authorize()`) + seed `role_permissions` | ✅ done | `20260703040348_rbac_policies.sql` |
| 4 | `invite-user` gated to admins; accepts + persists `role` | ✅ done | `supabase/functions/invite-user/index.ts` |
| 4 | Role dropdown on invite form | ✅ done | `src/components/auth/InviteUserForm.tsx` |
| 5 | Session role loaded into an auth provider/hook | ✅ done | `src/context/AuthContext.tsx` (`useAuth().role`) |
| 5 | Hide/disable write actions by role (New, Edit, PolicyActions) | ✅ done | `TableViewer.tsx`, `_dashboard.$table.$id.tsx`, `PolicyActions.tsx` |
| 5 | Nav read-filtering by role | ⬜ deferred (moot: every role reads every table today) | `Sidebar.tsx` |
| 5 | Team/Users admin screen: list users + change role | ✅ done | `_dashboard.users.tsx`, `supabase/functions/manage-users/index.ts` |
| 5 | Realtime subscription on own `user_roles` row → `refreshSession()` | ✅ done | `src/context/AuthContext.tsx` |
| 6 | psql RLS tests per role; per-role UI pass | ⬜ pending | — |

**Deviations from the original proposal:**

- The read-only role shipped as **`viewer`**, not `read_only`.
- The seed permission mapping uses the actual table names: `budget_targets`
  (not `budget`), `subscription` + `subscription_participant` (not
  `subscriptions`), and adds `air_exposure` / `air_equipment` / `lob_defaults`.
- The auth hook currently sets the claim to JSON `null` (not `viewer`) when a
  user has no `user_roles` row, so a roleless user is denied everywhere.

## Decisions (locked)

- **Roles:** `admin`, `underwriter`, `accounting`, `viewer`, backed by a
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

## Seed permission mapping (as shipped — tunable)

Seeded in `20260703040348_rbac_policies.sql`. Every role reads every table;
write is the only lever.

- **admin** — all tables read/write + user management / invites.
- **underwriter** — write: policies, binder, binder_section, binder_part,
  new_business_submissions, renewals, claims, agencies, carriers, clients,
  underwriters, capacity, license, air_exposure, air_equipment; read:
  everything else.
- **accounting** — write: invoices, payments, accounts_receivable,
  accounts_receivable_payments, capacity_remittance, budget_targets,
  subscription, subscription_participant; read: the rest.
- **viewer** — read all, write none.

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
