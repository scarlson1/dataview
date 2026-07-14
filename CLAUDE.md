# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **Managing General Agent (MGA) back-office dashboard**, porting the "SingleSource MGA" Excel underwriting workbook into a browser-based application. The central object is a **policy transaction**; almost everything else either feeds a policy (submissions, renewals, binders), hangs off it (claims, invoices, receivables, carrier payables), or reports on it (QBO exports, Lloyd's bordereaux, aging).

Stack: React 19 + TypeScript, Vite, TanStack Router/Query/Form/Store, MUI (+ X Data Grid, X Date Pickers), Supabase (Postgres 17, auth, edge functions), Zod, Biome, Vitest.

## Commands

```bash
pnpm dev                  # Vite dev server, http://localhost:3000
pnpm supabase start       # local Supabase stack (required alongside dev)
pnpm supabase functions serve   # edge functions locally

pnpm test                 # vitest run (excludes supabase/** — those are Deno tests)
pnpm test <path>          # run a single test file
deno test <path>          # run a single edge-function test (supabase/functions/**)

pnpm check                # biome format + lint
pnpm format               # biome format --write
pnpm lint                 # biome lint

pnpm gen:schema           # regenerate src/data/schema.generated.ts from live DB (after a migration)
pnpm gen:types            # regenerate react + edge-function Supabase types (after a migration)
pnpm generate-routes       # regenerate TanStack Router route tree (src/routeTree.gen.ts)

pnpm reset:db:local       # reset local Supabase DB (migrations + seed)
pnpm apply-migration      # apply pending migrations to local DB
```

After any migration: run `reset:db:local` (or `apply-migration`), then `gen:schema` and `gen:types` so the frontend schema manifest and types stay in sync.

## Architecture

### Schema-driven table system (the core UI pattern)

Almost every entity table in the dashboard (`/​<table>`, `/​<table>/:id`) is rendered by one generic set of components driven by a schema manifest, not per-table hand-written pages:

- `scripts/gen-schema.mjs` introspects live Postgres (`information_schema`/`pg_catalog`) and writes `src/data/schema.generated.ts` (columns, types, PK/FK/UNIQUE, a UI `kind` per column). **Never hand-edit this file** — rerun `pnpm gen:schema`.
- `src/data/tableMeta.ts` — hand-authored overlay (labels, icons, descriptions, preferred column order, computed-view mapping) merged onto the generated schema.
- `src/data/tables.ts` — merges the two into the `TableDef` registry the rest of the app reads (columns, source relation, primary key(s), hidden columns).
- `src/data/entityForms.ts` / `columns.tsx` / `tableActions.tsx` — form field defs, DataGrid column defs, row actions, again keyed off the registry rather than one-off per table.
- Routes `src/routes/_dashboard.$table.tsx`, `.$table.index.tsx`, `.$table.$id.tsx` are the generic list/detail routes; `$table` is a route param resolved against the registry.

Adding a new table to the DB (migration) + `gen:schema` + a `tableMeta.ts` entry is usually enough to get list/detail/CRUD UI for free — no new route or page component needed.

### Database conventions (see `docs/DATABASE.md`, `docs/TABLE_IMPLEMENTATION_NOTES.md`)

- Surrogate PK: `id bigint generated always as identity` (two natural-key exceptions: `surplus_lines_state_rules`, `lob_defaults`). Every `bigint`-PK table also gets a generated `id_str text` column (supabase-js can't cast/ilike an int in a query).
- Human-readable ref columns (`POL-2026-0001` style) are stored generated columns.
- `updated_at` is maintained by the shared `public.set_updated_at()` trigger (no Postgres `ON UPDATE`).
- **Same-row math → stored generated columns.** **Cross-row/cross-table/date-dependent math → `security_invoker` `*_computed` views** (so RLS still applies to the caller, unlike `security definer`).
- RLS is enabled on every table; role-based `rbac read`/`rbac write` policies call `authorize(<table>, 'read'|'write')` against `role_permissions` (role × table grid). Roles: `admin`, `underwriter`, `accounting`, `viewer`, carried in a `user_role` JWT claim set by a Custom Access Token Hook. See `docs/RBAC_PLAN.md`.
- Multi-table writes go through `security definer` Postgres functions, not ad hoc multi-step client code.

### Rater builder (`docs/RATER_BUILDER.md`)

A **rater** is a saved, executable piece of rating logic (inputs → steps → outputs), the web replacement for SingleSource's pricing formulas. The definition is a single JSON DSL document — the form builder and the flow diagram (`@xyflow/react`) are both just views over that JSON.

- Canonical schema/evaluator/interpreter/validation lives once in `supabase/functions/_shared/rater/{schema,expr,validate,interpreter,coerce}.ts` and is shared into the frontend via the `#rater-shared/*` import alias (see `package.json` `imports` + `tsconfig.json` `paths`) — **do not duplicate these types on the frontend**, extend the shared module instead.
- Execution endpoint: `supabase/functions/run-rater/index.ts`. Frontend run client: `src/lib/raters.ts`. Builder UI: `src/components/raters/`.

### LLM-generated reports (`docs/LLM_REPORTS_PLAN.md`)

Natural-language → SQL report builder. Two edge functions share one executor: `generate-report` (holds the Anthropic key, runs the agent loop with `list_tables`/`get_table_schema`/`sample_rows`/`run_sql` tools, streams SSE progress) and `run-report` (no LLM — executes saved or candidate SQL through the same guarded `supabase/functions/_shared/reportExecutor.ts`). Execution connects directly to Postgres (not PostgREST RPC) as a low-privilege role, then per-transaction `SET LOCAL ROLE authenticated` + the caller's JWT claims, so normal `authorize()` RLS applies to LLM-generated SQL exactly as it does to app queries — read-only transaction, `statement_timeout`, row/byte caps.

### Path aliases

- `#/*` and `@/*` → `./src/*`
- `#rater-shared/*` → `./supabase/functions/_shared/rater/*`

### Edge functions (`supabase/functions/`)

Deno runtime, tested with `deno test` (excluded from the Vitest run in `vite.config.ts`). Shared code lives in `supabase/functions/_shared/` (database types, rater DSL, report executor, schema tools). Existing functions: `generate-report`, `run-report`, `run-rater`, `invite-user`, `manage-users`.

## Code style

- Biome (not ESLint/Prettier) — single quotes, `organizeImports` on save. Run `pnpm check` before considering frontend work done.
- TypeScript strict mode, `noUnusedLocals`/`noUnusedParameters` enforced — unused code is a build error, not a lint warning.
- Prefer `interface` over `type` where appropriate; prefer arrow functions.
- `src/routeTree.gen.ts` and `src/styles.css` are generated/excluded from Biome — don't hand-edit the route tree, run `pnpm generate-routes`.

## Docs worth reading before larger changes

- `docs/DATABASE.md` — full schema, ERD, RLS/view conventions
- `docs/RBAC_PLAN.md` — roles, permission model, implementation status
- `docs/TABLE_IMPLEMENTATION_NOTES.md` — per-table deviations from the original spreadsheet spec; read before writing/changing a migration
- `docs/RATER_BUILDER.md` — rater DSL reference
- `docs/LLM_REPORTS_PLAN.md` — report-builder architecture
- `docs/ROADMAP.md` — open TODOs and in-flight work
