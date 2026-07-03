# Database tests

pgTAP tests for the Postgres layer. Each `*_test.sql` file wraps its assertions
in a single `BEGIN … ROLLBACK`, so runs leave the database untouched.

## Running

With the Supabase CLI (installs pgTAP and runs everything under `tests/`):

```sh
supabase test db
```

Without the CLI, against the running local DB container (`supabase start`):

```sh
supabase/tests/run.sh            # defaults to the supabase_db_evertas container
```

## `rbac_test.sql`

Covers the role-based access control stack:

- **`authorize(resource, action)`** — the read/write decision for every role,
  plus deny paths (unknown resource, unknown action, missing/null role claim).
- **`role_permissions` seed** — 25 resources × 4 roles = 100 rows; admin writes
  all, viewer writes none, underwriter writes 15, accounting writes 8, everyone
  reads everything.
- **RLS wiring** — RLS enabled on every governed table with `rbac read` /
  `rbac write` policies present, and `authorize()` is `SECURITY DEFINER`.
- **End-to-end RLS on `agencies`** — read/insert behaviour per role, including a
  roleless authenticated user seeing zero rows.
- **`user_roles` RLS** — a user reads only its own role row, cannot self-escalate
  (no write policy), and admins read all rows.
- **`custom_access_token_hook`** — stamps the assigned role into
  `claims.user_role`, and JSON `null` when the user has no role.

### How a signed-in user is simulated

`auth.jwt()` reads `current_setting('request.jwt.claims')` and `auth.uid()` reads
its `sub` key. The tests set that GUC and switch to the `authenticated` Postgres
role — the same thing PostgREST does per request — so RLS runs exactly as it does
in production.
