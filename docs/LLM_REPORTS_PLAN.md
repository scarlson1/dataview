# LLM-Generated Custom Reports — Plan

Status: **approved, implementation starting.** Referenced from [ROADMAP.md](ROADMAP.md).
Already in the tree: `supabase/functions/generate-report/` (withSupabase scaffold +
`deno.json`), an empty `supabase/functions/_shared/reportExecutor.ts`, the
`[functions.generate-report]` entry in `config.toml` (a `run-report` entry is still
needed), and `@ai-sdk/react@^4.0.17` in `package.json`.

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
- **Not an MCP server** — considered exposing the schema/SQL tools as a
  Supabase-hosted MCP server ([byo-mcp guide](https://supabase.com/docs/guides/ai-tools/byo-mcp)).
  Rejected for now: the guide's MCP-on-Edge-Functions pattern currently ships
  **without auth** — re-verified 2026-07-07: it mandates
  `supabase functions deploy --no-verify-jwt mcp` and states "Auth support for
  MCP on Edge Functions is coming soon," using `WebStandardStreamableHTTPServerTransport`
  (SSE) with the official `@modelcontextprotocol/sdk`. This feature is per-user
  RLS end to end, so the in-function agent loop with a verified JWT is the right
  shape today; revisit MCP once its auth lands if we ever want users' own agents
  querying these tools.

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

## RLS / RBAC enforcement (verified against the repo)

The generated SQL runs **as the requesting user**, not as a privileged role.
Verified specifics:

- **Claims must be the caller's verified JWT claims, verbatim.** Both edge
  functions use `withSupabase({ auth: ["user"] })`, which verifies the incoming
  access token. The executor takes that *verified* token's full claim set and
  passes it into `set_config('request.jwt.claims', <claims json>, true)` inside
  the transaction. Never build a claims object by hand and never accept claims
  from the request body — two claims matter and both ride in the real token:
  - `sub` → `auth.uid()` — every ownership-scoped RLS policy.
  - `user_role` → `authorize()` — the RBAC function
    (`20260703021911_rbac.sql`) reads `auth.jwt() ->> 'user_role'`, a custom
    claim injected by the access-token auth hook. A hand-built `{sub}` object
    would silently make `authorize()` return false everywhere (or worse, a
    hand-built `user_role` would forge it).
- **`SET LOCAL ROLE authenticated`** scopes table/view GRANTs identically to
  PostgREST, so the LLM's SQL can't touch anything the app itself can't.
- **Views**: Postgres views bypass RLS by default (they run as their owner).
  Audited: all 7 views in `20260702100000_reporting_export_views.sql` and the
  other report views (`create_policies`, `aging_expose_id`, `create_binder_part`,
  `create_license`) are `security_invoker = true`, so RLS + `authorize()` hold
  through the view substrate. **Pre-launch checklist item**: audit *every*
  `public` view (`select viewname from pg_views where schemaname='public'`
  cross-checked against `security_invoker`) and run `supabase db advisors` /
  MCP `get_advisors` — a single definer view would be an RLS hole reachable by
  LLM-generated SQL.
- **New tables**: `reports` and `report_generation_log` get RLS enabled in the
  same migration that creates them, policies via the existing
  `authorize('reports', …)` pattern with explicit `TO authenticated`, and the
  UPDATE policy carries **both `USING` and `WITH CHECK`** (without `WITH CHECK`
  a user could reassign rows; and note UPDATE silently no-ops without a SELECT
  policy). `report_generation_log` is service-role-write, admin-read only.
- **Claims freshness caveat**: `user_role` is as fresh as the access token — a
  demoted user keeps their old role until token refresh (the app already
  refreshes on role change via the Realtime subscription in `AuthContext`).
  Acceptable here; noted so nobody "fixes" it with a DB lookup that bypasses
  the hook.
- **Secrets**: the Anthropic key and `REPORT_DB_URL` are edge-function secrets;
  the browser only ever holds the publishable key. `report_generation_log`
  writes use `ctx.supabaseAdmin` (service role) — never exposed client-side.

## The agent (`generate-report`)

- **SDK/model**: Vercel AI SDK on the server — `ai` + `@ai-sdk/anthropic`
  (npm specifiers in Deno), `claude-opus-4-8`. The client already has
  `@ai-sdk/react@^4.0.17`, which locks in the AI SDK stream protocol, so the
  server emits it natively (`streamText` → UI-message stream response) instead
  of a hand-rolled SSE format: tool-loop, per-step callbacks (progress events,
  usage accounting), and a hard step cap are all first-class. **Match the
  server `ai` package major to the installed `@ai-sdk/react` major and verify
  exact API names against that version's docs, not memory** — the SDK renames
  these across majors. Keep the Anthropic prompt-cache breakpoint after the
  stable system prompt + tool defs (provider options), so retry loops hit the
  prompt cache.
- **Tools** (all read-only):
  | Tool | Returns |
  |---|---|
  | `list_tables` | name, kind (table/view), one-line comment for every `public` relation — views prominently flagged as preferred building blocks |
  | `get_table_schema` | for requested tables: columns (name, type, nullable), PK/FK (+ referenced table), CHECK-constraint enum values — same introspection SQL as `gen-schema.mjs`, run live |
  | `sample_rows` | up to 5 rows through the guarded executor (RLS applies), so the model sees real value formats (status strings, date shapes) |
  | `run_sql` | guarded executor at the 200-row preview cap; success → first rows + row count; failure → the structured Postgres error |
  | `submit_report` | terminal tool: `{name, description, sql, columns[]}` (strict schema); the loop ends when called |
- **Schema tool results are cached.** `list_tables` and `get_table_schema` hit
  `information_schema`, which is identical for every user and changes only on
  migration — cache them in a module-scope Map (edge-function isolates stay
  warm across invocations) with a ~5-minute TTL, keyed by tool + table name,
  plus per-loop dedupe (a repeated `get_table_schema("policies")` in one
  generation returns the cached JSON without a DB round-trip). **Repair mode
  busts the cache** — schema drift is exactly when stale schema would poison
  the fix. `sample_rows` and `run_sql` are NEVER cached: their results are
  user-specific (RLS) and caching them would leak rows across users sharing a
  warm isolate.
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
- **Streaming to the UI**: the AI SDK UI-message stream, consumed by
  `@ai-sdk/react` in the builder with a custom transport (`fetch` to the
  function URL + `Authorization: Bearer <session access token>` —
  `supabase.functions.invoke` doesn't expose streaming bodies). Progress
  surfaces as custom data parts on the stream: `step` ("inspecting schema",
  "running query (attempt 2)"), `sql` (current candidate), `preview` (rows),
  terminal `done` / `error`. Client renders those parts; it never needs the
  raw assistant text.
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

## Observability / monitoring / tracing (after the feature works)

Phase 1 ships with the built-in floor: `report_generation_log` (spend ledger:
model, tokens, steps, outcome per invocation), structured executor rejections
(cost gate / caps / timeouts distinguishable from SQL errors), and Supabase
edge-function logs. Recommendations to layer on once the feature is live:

- **LLM tracing** — the AI SDK has built-in OpenTelemetry instrumentation
  (`experimental_telemetry` or its current equivalent); pointing it at
  **Langfuse** (self-hostable) or **Braintrust** gives per-generation traces:
  every tool call, SQL candidate, Postgres error, retry, and token count in
  one waterfall. This is the single highest-value add — "why did this report
  take 9 steps" is unanswerable from logs alone.
- **Error tracking** — Sentry's Deno SDK in both edge functions (they're the
  only new backend surface); tag events with `report_id` / mode so repair-loop
  failures cluster.
- **Database side** — enable `pg_stat_statements` filtered to the
  `report_runner` role for slow-query review; run `supabase db advisors`
  (or MCP `get_advisors`) in CI so a future non-invoker view or missing RLS
  policy gets caught before the LLM can find it.
- **Alerting** — a scheduled check (or log drain alert) on: daily token spend
  above budget, quota-exceeded spikes (someone scripting the endpoint), and
  executor rejection rate (schema drift breaking saved reports en masse after
  a migration).
- **`report_runs` audit table** (already phase 3) — who ran what, duration,
  row count, error; joins the ledger to answer "which saved reports are dead
  weight".

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
4. **Parameterized reports** *(shipped)* — `{{snake_case}}` placeholders in the
   saved SQL + a `reports.params` jsonb config declared by the model at
   submit time. Server compiles placeholders to positional bind parameters
   (never string interpolation) in `_shared/reportParams.ts`; `run-report`
   validates/coerces values against the saved config; the detail page renders
   a params form (date pickers with range presets, static selects,
   EntitySelect pickers over an allowlisted table set) from the config.
5. **Later** — scheduled runs + email delivery (pairs with the roadmap's "email
   notifications" item), simple chart rendering from `columns` meta, relative
   date defaults (e.g. `start_of_current_month`), params inputs on the
   builder's hand-fix path.

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
