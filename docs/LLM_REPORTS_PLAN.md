# LLM-Generated Custom Reports — Plan

Status: **proposed (not started).** Referenced from [ROADMAP.md](ROADMAP.md).

A user describes a report in plain English ("open AR by client, bucketed by
month, only surplus-lines policies"); an LLM agent inspects the live Postgres
schema, writes SQL, runs it against a guarded read-only executor, self-corrects
on errors, and returns a named, saved report. Saved reports re-run **without
the LLM** — the stored SQL executes through the same guarded path, renders in a
DataGrid, and exports to CSV like the existing reports on the Exports page.

> Note on the requirements: the ask mentioned "convex table schema" — this app
> is Supabase/Postgres (Convex is the castaway project), so everywhere below
> "schema tools" means Postgres introspection of the `public` schema. The
> agent-with-tools shape mirrors castaway's `convex/agent` + `convex/tools`
> pattern, ported to a Supabase Edge Function.

## Requirements → where they're handled

| Requirement | Design answer |
|---|---|
| Reports saved & reusable | `reports` table stores name/description/prompt/SQL/column meta; saved reports re-run deterministically via the `run-report` edge function — no LLM in the re-run path |
| Schema tools for the LLM | `list_tables` / `get_table_schema` / `sample_rows` tools backed by the same `information_schema` queries as `scripts/gen-schema.mjs` |
| Recover from failed SQL | Agent loop feeds Postgres errors (message, hint, position) back as tool results; capped retries; "Repair with AI" flow for saved reports broken by schema drift |
| Runaway-query / cost checks | DB side: read-only transaction, `statement_timeout`, `EXPLAIN` cost gate, row + byte caps. LLM side: step cap per generation, per-user daily quota, token usage logged per request |

## Architecture

```
Browser (React)                     Supabase Edge Functions                Postgres
┌─────────────────────┐   SSE   ┌──────────────────────────┐   pooler   ┌──────────────────┐
│ Report Builder       │────────▶│ generate-report           │───────────▶│ report_runner     │
│  prompt → progress → │         │  Claude agent loop:       │            │  BEGIN READ ONLY  │
│  preview → save      │         │  list_tables              │            │  SET ROLE authent.│
├─────────────────────┤         │  get_table_schema         │            │  set jwt claims   │
│ Saved report page    │  POST   │  sample_rows              │            │  timeout + LIMIT  │
│  run → grid → CSV    │────────▶│  run_sql ──────────┐      │            │  → RLS enforced   │
└─────────────────────┘         ├────────────────────┼─────┤            └──────────────────┘
                                │ run-report          │      │
                                │  (no LLM; saved or  ◀──────┘  shared _shared/reportExecutor.ts
                                │   candidate SQL)    │
                                └─────────────────────┘
```

Two edge functions, one shared executor:

- **`generate-report`** — holds the Anthropic API key, runs the agent loop,
  streams progress events (SSE) to the builder UI. Only invoked when creating
  or repairing a report.
- **`run-report`** — executes SQL (a saved report's stored SQL, or candidate
  SQL from the builder) through the guarded executor and returns rows. This is
  the *only* execution path; the agent's `run_sql` tool calls the same shared
  module, so guardrails can't be bypassed.

### Why this shape

- **LLM in an edge function, not the browser** — the Anthropic key stays
  server-side; matches the existing `invite-user` / `manage-users` pattern
  (`withSupabase({ auth: ["user"] })`).
- **Direct Postgres connection for execution, not PostgREST RPC** — a
  security-definer `execute_sql(text)` RPC can't enforce a read-only
  transaction (the transaction is already read-write by the time the function
  runs) and can't set per-run timeouts cleanly. A dedicated connection lets us
  do what PostgREST itself does: connect as a low-privilege role, then per
  transaction `SET LOCAL ROLE authenticated` + set the caller's JWT claims —
  so the existing `authorize()` RLS policies apply to LLM-generated SQL
  exactly as they do to normal app queries. No new authorization model.
- **Store SQL, not a query-builder AST** — the LLM's strength is writing real
  SQL against real views (`carrier_prem_com_report`, `accounts_receivable_aging`,
  `renewals_computed`, … are prime substrate — much of the report logic already
  exists as views). A constrained AST would fight that. Safety comes from the
  execution sandbox, not from restricting the query language.

## Database changes (one migration + seed rows)

```sql
-- Saved reports
create table reports (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  prompt      text,            -- original natural-language request (provenance + repair context)
  sql         text not null,
  columns     jsonb,           -- [{field, label, kind}] → DataGrid + CSV headers (reuse ColumnKind)
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  last_run_at timestamptz,
  archived_at timestamptz
);

-- LLM usage / quota ledger (one row per generate-report invocation)
create table report_generation_log (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id),
  report_id     uuid references reports(id),
  prompt        text,
  model         text,
  input_tokens  int,
  output_tokens int,
  steps         int,
  outcome       text,          -- succeeded | failed | quota_exceeded | cancelled
  created_at    timestamptz not null default now()
);
```

- RLS on both via the existing pattern: `authorize('reports', 'read'|'write')`;
  seed `role_permissions` rows — read for all four roles, write for
  `admin`/`underwriter`/`accounting` (viewer can run but not create/edit).
  `report_generation_log` is written only by the edge function (service role);
  read restricted to admin.
- **Executor role** (same migration):

```sql
create role report_runner login;                      -- password set out-of-band, not in the migration
grant authenticated to report_runner;                 -- allows SET ROLE authenticated
alter role report_runner set statement_timeout = '10s';
alter role report_runner set idle_in_transaction_session_timeout = '15s';
```

  The password is set once per environment (`alter role report_runner password
  '...'` via dashboard/psql) and stored as an edge-function secret
  (`REPORT_DB_URL` pointing at the Supavisor transaction pooler, port 6543).
- Optional (phase 3): `report_runs` audit table (who ran what, duration, row
  count, error).

## The guarded executor (`_shared/reportExecutor.ts`)

Single module used by both edge functions. Per execution:

1. Connect as `report_runner` through the transaction pooler (postgres.js).
2. One transaction wrapping everything:
   ```
   BEGIN READ ONLY;
     SET LOCAL ROLE authenticated;
     SELECT set_config('request.jwt.claims', $callerClaimsJson, true);
     SET LOCAL search_path = public;
     SET LOCAL statement_timeout = '10s';     -- belt + suspenders with the role default
     ...gates + query...
   ROLLBACK;  -- never commit; nothing to persist
   ```
   `READ ONLY` makes any write attempt — including inside function calls —
   error at the server. `SET ROLE authenticated` + the claims GUC reproduce
   PostgREST's environment, so RLS and `authorize()` behave identically to the
   app's normal queries (a viewer's report can't see rows a viewer can't see).
3. **Single-statement enforcement**: execute via the extended query protocol
   (`prepare: true` in postgres.js) — the server rejects multi-statement
   strings, so `; drop table` style suffixes are structurally impossible (and
   would be blocked by READ ONLY + missing grants anyway). Strip a trailing `;`
   before wrapping.
4. **Cost gate**: `EXPLAIN (FORMAT JSON) <query>` first; reject if estimated
   total cost or plan rows exceed thresholds (generous — this is a small
   internal DB; the gate exists to catch accidental cross joins). The rejection
   message ("query too expensive — add filters or joins on keys") is fed back
   to the model as a tool error it can act on.
5. **Row cap**: run `select * from (<query>) _r limit {cap}+1`; report
   `truncated: true` if cap+1 rows come back. Caps: 200 rows for agent
   previews, 500 for the builder preview grid, 50,000 for CSV export.
6. **Byte cap**: stop serializing past ~5 MB and mark truncated.
7. Return either `{ rows, fields, truncated, durationMs }` or a structured
   error `{ code, message, hint, position }` — never throw raw driver errors
   at the model or the UI.

## The agent (`generate-report`)

- **SDK/model**: `@anthropic-ai/sdk` (npm specifier in Deno),
  `claude-opus-4-8`, `thinking: {type: "adaptive"}`, streaming, manual tool
  loop (not the beta tool runner — we want per-step SSE progress events and a
  hard step cap). System prompt + tool defs are stable → `cache_control`
  breakpoint after them so retry loops hit the prompt cache.
- **Tools** (all read-only):
  | Tool | Returns |
  |---|---|
  | `list_tables` | name, kind (table/view), one-line comment for every `public` relation — views prominently flagged as preferred building blocks |
  | `get_table_schema` | for requested tables: columns (name, type, nullable), PK/FK (+ referenced table), CHECK-constraint enum values — same introspection SQL as `gen-schema.mjs`, run live |
  | `sample_rows` | up to 5 rows through the guarded executor (RLS applies), so the model sees real value formats (status strings, date shapes) |
  | `run_sql` | guarded executor at the 200-row preview cap; success → first rows + row count; failure → the structured Postgres error |
  | `submit_report` | terminal tool: `{name, description, sql, columns[]}` (strict schema); the loop ends when called |
- **Failure recovery**: `run_sql` errors go back as `tool_result` with
  `is_error: true` and the full Postgres message/hint/position — the model
  fixes and retries. Caps: **12 loop steps**, **4 consecutive failed
  executions**, then the function returns a graceful failure with the last
  error and the best candidate SQL so the user can edit it by hand.
- **Cost controls (LLM side)**:
  - Per-user daily quota (e.g. 25 generations/day) checked against
    `report_generation_log` before starting; 429 with a clear message when hit.
  - Every invocation logs model, token usage (summed across loop steps from
    `response.usage`), step count, and outcome — admin-visible spend ledger.
  - `max_tokens` ~8k per step; wall-clock budget under the edge-function limit
    (abort the loop at ~90s and return the best candidate).
- **Streaming to the UI**: SSE events — `step` ("inspecting schema",
  "running query (attempt 2)"), `sql` (current candidate), `preview` (rows),
  `done` / `error`. The browser calls the function with `fetch` + the session
  access token (`supabase.functions.invoke` doesn't expose streaming bodies).
- **Modes**: `create` (prompt only), `refine` (existing report + instruction —
  seeds the conversation with current SQL), `repair` (existing report + the
  runtime error it now throws — for schema drift after migrations).

## Frontend

- **`/_dashboard/reports`** — list of saved reports (name, description,
  last run) + "New report" builder. Builder: prompt box → streamed progress →
  candidate SQL (collapsible, monospace) → preview DataGrid → name/description
  → Save. Follows the Exports page visual pattern.
- **`/_dashboard/reports/$id`** — Run (via `run-report`), results in MUI
  DataGrid using stored `columns` meta (reuse `ColumnKind` rendering from the
  schema-driven tables), Export CSV via the existing `downloadCsv` +
  `CsvColumn` mapping, Refine / Repair buttons (re-enter builder in that mode).
- Write actions gated on `useAuth().role` like the rest of the app; DB is the
  real boundary.

## Phasing

1. **Executor + agent + preview** *(the vertical slice)* — migration
   (`reports`, `report_generation_log`, `report_runner` role), shared executor,
   `generate-report` with all tools + step caps + quota + usage logging,
   `run-report`, minimal builder UI with preview grid. Cost/runaway controls
   land here, not later — they're a stated minimum requirement.
2. **Saved reports** — save/list/run/rename/archive, report page with DataGrid
   + CSV export, RBAC seed rows, nav entry.
3. **Refine & repair** — refine mode, repair-on-error flow, `report_runs`
   audit, admin usage view over `report_generation_log`.
4. **Later** — parameterized reports (`{{start_date}}` placeholders prompted at
   run time), scheduled runs + email delivery (pairs with the roadmap's "email
   notifications" item), simple chart rendering from `columns` meta.

## Open questions

- **Quota numbers**: 25 generations/user/day and 10s statement timeout are
  starting guesses — tune after seeing real usage in the log.
- **Pooler + `SET ROLE`**: Supavisor transaction mode discards session state
  between transactions, which is exactly why everything is `SET LOCAL` inside
  one transaction — verify against the hosted pooler early in phase 1 (local
  Supabase uses the same Supavisor).
- **Schema-drift detection**: proactively fingerprint referenced tables at save
  time vs. just surfacing runtime errors + repair. Recommendation: skip the
  fingerprint; the repair flow covers it with less machinery.
