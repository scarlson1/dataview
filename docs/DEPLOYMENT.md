# Deployment

Commands assume the Supabase CLI is a dev dependency, so they're run via
`pnpm supabase …`. See [SUPABASE_QUICKSTART.md](./SUPABASE_QUICKSTART.md) for the
local development workflow.

## Edge Function environment variables

The edge functions read two **custom** secrets via `Deno.env.get()`:

| Var                 | Read in                     | Purpose                                                                  |
| ------------------- | --------------------------- | ------------------------------------------------------------------------ |
| `ANTHROPIC_API_KEY` | `generate-report/index.ts`  | LLM calls for report generation                                          |
| `REPORT_DB_URL`     | `_shared/reportExecutor.ts` | Low-privilege `report_runner` DB connection for the guarded SQL executor |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are **reserved
names auto-injected** by the platform on hosted Edge Functions — do not set them
manually. They appear in the local `supabase/functions/.env` only so the local
edge runtime has them.

### Local

`supabase/functions/.env` (gitignored) already contains everything for local dev.
Locally, `REPORT_DB_URL` uses the container-internal `db:5432` host.

### Hosted

Set the two custom secrets:

```bash
pnpm supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
pnpm supabase secrets set REPORT_DB_URL='postgresql://report_runner.<project_ref>:<password>@<pooler-host>:6543/postgres'
```

## The `report_runner` role and REPORT_DB_URL

The `report_runner` role is **created** by migration
`20260707100000_llm_reports.sql`, but with **no password** — the password is set
out-of-band so it never lands in a committed migration.

The guarded executor connects as `report_runner`, then per transaction does
`SET LOCAL ROLE authenticated` and sets the caller's JWT claims — reproducing
PostgREST's environment so RLS + `authorize()` apply to LLM-generated SQL.

### Where the password is set

- **Local:** `supabase/seed.sql` runs `alter role report_runner password
'report_runner_local';` on every `pnpm supabase db reset`. The local
  `REPORT_DB_URL` password matches this seed value.
- **Hosted:** nothing sets it for you. Run it **once** against the hosted DB (SQL
  Editor in the dashboard, or `psql`) with a strong password:

  ```sql
  alter role report_runner password '<strong-random-password>';
  ```

### Building REPORT_DB_URL

Format: `postgresql://report_runner:<password>@<host>:<port>/postgres`

|            | host                    | port   | password source                         |
| ---------- | ----------------------- | ------ | --------------------------------------- |
| **Local**  | `db`                    | `5432` | `report_runner_local` (from `seed.sql`) |
| **Hosted** | transaction pooler host | `6543` | value set via `alter role`              |

For hosted, get the pooler host from the dashboard: **Project Settings → Database
→ Connection string → Transaction pooler** (mode `transaction`, port `6543`). It
looks like `aws-0-<region>.pooler.supabase.com`. Swap in `report_runner` as the
user:

```
postgresql://report_runner:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

**Gotchas:**

- **Port matters.** Local uses `db:5432` (container-internal direct connection);
  hosted edge functions must use the pooler on `6543`. Don't use `5432` on hosted.
- **URL-encode the password** if it contains `@ : / ?` etc.
- Transaction-pooler safe: the executor uses `SET LOCAL ROLE` inside a
  transaction (no session-level state), so it works with the `6543` pooler.
