-- Shared rater lookup tables.
-- A rater `lookup` step can carry its reference grid inline (columns + rows in
-- the definition) OR reference a shared table stored here. Shared tables let
-- one rate grid (territory factors, base-rate bands, …) be edited once and
-- reused across many raters. The run-rater edge function resolves a referenced
-- table into an inline lookup at run time (via the CALLER's client, so RLS
-- gates access) and snapshots the materialized definition into rater_runs, so
-- past runs stay reproducible even after the shared table is edited.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.rater_lookup_tables (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  columns     jsonb not null,   -- [{ name, type: text|number|boolean }]
  rows        jsonb not null,   -- [[cell, ...], ...] (cell = text|number|boolean|null)
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);
comment on table public.rater_lookup_tables is 'Shared reference grids for rater lookup steps; a lookup step references one by id and the run-rater edge function materializes it inline at run time.';

create trigger rater_lookup_tables_set_updated_at
  before update on public.rater_lookup_tables
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants (object-level privilege; RLS still gates rows)
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.rater_lookup_tables to authenticated;

-- ---------------------------------------------------------------------------
-- Row-Level Security (mirrors raters: read gated on 'read', mutations on 'write')
-- ---------------------------------------------------------------------------

alter table public.rater_lookup_tables enable row level security;

create policy "rater_lookup_tables read" on public.rater_lookup_tables
  for select to authenticated
  using (public.authorize('rater_lookup_tables', 'read'));

create policy "rater_lookup_tables insert" on public.rater_lookup_tables
  for insert to authenticated
  with check (public.authorize('rater_lookup_tables', 'write'));

create policy "rater_lookup_tables update" on public.rater_lookup_tables
  for update to authenticated
  using (public.authorize('rater_lookup_tables', 'write'))
  with check (public.authorize('rater_lookup_tables', 'write'));

create policy "rater_lookup_tables delete" on public.rater_lookup_tables
  for delete to authenticated
  using (public.authorize('rater_lookup_tables', 'write'));

-- ---------------------------------------------------------------------------
-- Seed role_permissions (mirrors raters: read for all; write for admin/underwriter)
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role, resource, can_read, can_write) values
  ('admin',       'rater_lookup_tables', true,  true),
  ('underwriter', 'rater_lookup_tables', true,  true),
  ('accounting',  'rater_lookup_tables', true,  false),
  ('viewer',      'rater_lookup_tables', true,  false);
