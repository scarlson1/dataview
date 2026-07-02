-- Underwriters (UW): underwriting team registry. Referenced by NBS / RNW / POL.

create table public.underwriters (
  -- identity
  id           bigint       generated always as identity primary key,
  -- string cast of id for clients that can't cast bigint in a query (e.g. supabase-js)
  id_str       text         generated always as (id::text) stored,
  -- human-readable reference id (e.g. UW-2026-0001); see agencies migration for rationale.
  ref_year     smallint     not null default extract(year from now())::smallint,
  uw_ref       varchar(24)  generated always as ('UW-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,

  -- name
  first_name   varchar(100) not null,
  last_name    varchar(100) not null,
  -- same-row computed -> stored generated column
  display_name varchar(200) generated always as (last_name || ', ' || first_name) stored,

  -- role & contact
  title_role   varchar(100),   -- e.g. Senior Underwriter, UW Manager
  email        varchar(200),
  phone        varchar(30),

  -- status & audit
  status       varchar(20)  not null default 'active'
                  check (status in ('active','inactive','on_leave')),
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

-- indexes (Indexed = YES in spec; PK already covers id)
create index underwriters_last_name_idx    on public.underwriters (last_name);
create index underwriters_display_name_idx on public.underwriters (display_name);
create index underwriters_title_role_idx   on public.underwriters (title_role);
create index underwriters_email_idx        on public.underwriters (email);
create index underwriters_status_idx       on public.underwriters (status);

-- updated_at maintenance; reuses public.set_updated_at() from the agencies migration
create trigger underwriters_set_updated_at
  before update on public.underwriters
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.underwriters enable row level security;

-- NOTE: RLS enabled with NO policies -> service_role only until you add policies:
--
-- create policy "authenticated read"  on public.underwriters
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.underwriters
--   for all    to authenticated using (true) with check (true);
