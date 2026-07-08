-- LLM-Generated Custom Reports — Wave 1 schema.
-- See docs/LLM_REPORTS_PLAN.md ("Database changes"). Adds the saved-reports
-- table, the LLM usage/quota ledger, the per-run audit table, RBAC via the
-- existing authorize() pattern, and the low-privilege `report_runner` role the
-- guarded executor connects as.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Saved reports. The stored `sql` re-runs deterministically through the guarded
-- executor (no LLM in the re-run path); `columns` drives the DataGrid + CSV.
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  prompt      text,            -- original natural-language request (provenance + repair context)
  sql         text not null,
  columns     jsonb,           -- [{field, label, kind}] → DataGrid + CSV headers
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  last_run_at timestamptz,
  archived_at timestamptz
);
comment on table public.reports is 'Saved LLM-generated reports; stored SQL re-runs via the guarded executor without the LLM.';

-- LLM usage / quota ledger — one row per generate-report invocation. Written
-- only by the edge function (service role); read restricted to admin.
create table public.report_generation_log (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id),
  report_id     uuid references public.reports(id),
  prompt        text,
  model         text,
  input_tokens  int,
  output_tokens int,
  steps         int,
  outcome       text,          -- succeeded | failed | quota_exceeded | cancelled
  created_at    timestamptz not null default now()
);
comment on table public.report_generation_log is 'Spend ledger: one row per generate-report invocation (model, tokens, steps, outcome).';

-- Per-run audit (plan phase 3): who ran what, duration, row count, error.
-- Written only by the edge function (service role); read restricted to admin.
create table public.report_runs (
  id          bigint generated always as identity primary key,
  report_id   uuid references public.reports(id),
  user_id     uuid not null references auth.users(id),
  duration_ms int,
  row_count   int,
  error       text,
  created_at  timestamptz not null default now()
);
comment on table public.report_runs is 'Audit of report executions (saved reports): duration, row count, error.';

-- updated_at maintenance; reuses public.set_updated_at() from the agencies migration.
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants (object-level privilege; RLS still gates rows)
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.reports to authenticated;
-- Log + runs are readable (admin-only via RLS) but never written by the client;
-- writes go through the service role, which bypasses RLS.
grant select on public.report_generation_log, public.report_runs to authenticated;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.reports enable row level security;
alter table public.report_generation_log enable row level security;
alter table public.report_runs enable row level security;

-- reports: read gated on authorize('reports','read'); mutations on ...,'write').
-- The UPDATE policy carries BOTH USING and WITH CHECK (without WITH CHECK a user
-- could reassign rows). Split into per-command policies so UPDATE is explicit.
create policy "reports read" on public.reports
  for select to authenticated
  using (public.authorize('reports', 'read'));

create policy "reports insert" on public.reports
  for insert to authenticated
  with check (public.authorize('reports', 'write'));

create policy "reports update" on public.reports
  for update to authenticated
  using (public.authorize('reports', 'write'))
  with check (public.authorize('reports', 'write'));

create policy "reports delete" on public.reports
  for delete to authenticated
  using (public.authorize('reports', 'write'));

-- report_generation_log / report_runs: admin-read only (via authorize on their
-- own resource names), NO write policies — the edge function writes as service
-- role, which bypasses RLS.
create policy "report_generation_log read" on public.report_generation_log
  for select to authenticated
  using (public.authorize('report_generation_log', 'read'));

create policy "report_runs read" on public.report_runs
  for select to authenticated
  using (public.authorize('report_runs', 'read'));

-- ---------------------------------------------------------------------------
-- Seed role_permissions
-- ---------------------------------------------------------------------------

-- reports: read for all four roles; write for admin/underwriter/accounting
-- (viewer can run saved reports but not create/edit).
insert into public.role_permissions (role, resource, can_read, can_write) values
  ('admin',       'reports', true,  true),
  ('underwriter', 'reports', true,  true),
  ('accounting',  'reports', true,  true),
  ('viewer',      'reports', true,  false);

-- Ledger + audit: admin-read only, no write for anyone (service role bypasses).
insert into public.role_permissions (role, resource, can_read, can_write) values
  ('admin', 'report_generation_log', true, false),
  ('admin', 'report_runs',           true, false);

-- ---------------------------------------------------------------------------
-- Executor role
-- ---------------------------------------------------------------------------

-- The guarded executor connects as `report_runner`, then per transaction does
-- SET LOCAL ROLE authenticated + sets the caller's JWT claims — reproducing
-- PostgREST's environment so RLS + authorize() apply to LLM-generated SQL.
-- Guarded so re-running the migration per environment doesn't fail. The
-- password is set out-of-band (alter role report_runner password '...'), not
-- in the migration, and stored as the REPORT_DB_URL edge-function secret.
do $$ begin
  if not exists (select from pg_roles where rolname = 'report_runner') then
    create role report_runner login;
  end if;
end $$;

grant authenticated to report_runner;                 -- allows SET ROLE authenticated
alter role report_runner set statement_timeout = '10s';
alter role report_runner set idle_in_transaction_session_timeout = '15s';
