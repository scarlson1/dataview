-- Rater builder — Wave 1 schema.
-- Raters are user-authored logic definitions (JSON DSL: typed inputs + steps
-- of calc / lookup / fetch / branch / output) executed by the run-rater edge
-- function. The definition is validated app-side (zod, _shared/rater/) and
-- every run snapshots the definition it executed — the v1 versioning story,
-- shaped so an immutable rater_versions table can be added later by lifting
-- the definition column.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.raters (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  definition     jsonb not null,   -- { schema_version, inputs, steps } (rater DSL)
  record_mapping jsonb,            -- { table, mappings: [{input, column}] } | null
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  last_run_at    timestamptz,
  archived_at    timestamptz
);
comment on table public.raters is 'User-authored rating logic (JSON DSL); executed deterministically by the run-rater edge function.';

-- Per-run audit + snapshot. Written only by the edge function (service role);
-- readable by all roles — runs history is a user-facing feature on the rater
-- detail page (unlike report_runs' admin-only read).
create table public.rater_runs (
  id                  bigint generated always as identity primary key,
  rater_id            uuid references public.raters(id),
  user_id             uuid not null references auth.users(id),
  inputs              jsonb,       -- coerced input values
  outputs             jsonb,       -- { name: { label, value, format } }
  definition_snapshot jsonb,       -- exact definition executed
  trace               jsonb,       -- per-step results (status, value, detail)
  source_record       jsonb,       -- { table, id } when pre-filled from a record
  duration_ms         int,
  error               text,
  created_at          timestamptz not null default now()
);
comment on table public.rater_runs is 'Audit of rater executions: inputs, outputs, step trace, and the definition snapshot that ran.';

-- updated_at maintenance; reuses public.set_updated_at() from the agencies migration.
create trigger raters_set_updated_at
  before update on public.raters
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants (object-level privilege; RLS still gates rows)
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.raters to authenticated;
-- Runs are readable but never written by the client; the edge function writes
-- them via the service role (which needs explicit object grants — see
-- 20260708120000_grant_service_role_report_tables.sql for the precedent).
grant select on public.rater_runs to authenticated;
grant insert on public.rater_runs to service_role;
grant select, update on public.raters to service_role;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.raters enable row level security;
alter table public.rater_runs enable row level security;

-- raters: read gated on authorize('raters','read'); mutations on ...,'write').
-- Per-command policies with explicit WITH CHECK, mirroring reports.
create policy "raters read" on public.raters
  for select to authenticated
  using (public.authorize('raters', 'read'));

create policy "raters insert" on public.raters
  for insert to authenticated
  with check (public.authorize('raters', 'write'));

create policy "raters update" on public.raters
  for update to authenticated
  using (public.authorize('raters', 'write'))
  with check (public.authorize('raters', 'write'));

create policy "raters delete" on public.raters
  for delete to authenticated
  using (public.authorize('raters', 'write'));

-- rater_runs: read for anyone who can read raters; NO write policies — the
-- edge function writes as service role, which bypasses RLS.
create policy "rater_runs read" on public.rater_runs
  for select to authenticated
  using (public.authorize('rater_runs', 'read'));

-- ---------------------------------------------------------------------------
-- Seed role_permissions
-- ---------------------------------------------------------------------------

-- raters: read for all four roles; write for admin/underwriter (viewer and
-- accounting can run saved raters but not create/edit).
insert into public.role_permissions (role, resource, can_read, can_write) values
  ('admin',       'raters', true,  true),
  ('underwriter', 'raters', true,  true),
  ('accounting',  'raters', true,  false),
  ('viewer',      'raters', true,  false);

-- rater_runs: read for all four roles (runs history is user-facing), no write
-- for anyone (service role bypasses).
insert into public.role_permissions (role, resource, can_read, can_write) values
  ('admin',       'rater_runs', true, false),
  ('underwriter', 'rater_runs', true, false),
  ('accounting',  'rater_runs', true, false),
  ('viewer',      'rater_runs', true, false);
