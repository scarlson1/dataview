-- Agencies: agency hierarchy, classification, contact, D&O coverage, audit.

create table public.agencies (
  -- identity & hierarchy
  id                 bigint       generated always as identity primary key,
  -- string cast of id for clients that can't cast bigint in a query (e.g. supabase-js)
  id_str             text         generated always as (id::text) stored,
  parent_id          bigint       references public.agencies (id),
  billing_id         bigint       generated always as (
                        case when billing_entity = 'parent'
                             then parent_id else id end
                     ) stored,
  -- human-readable reference id (e.g. AGT-2026-0001). ref_year is stamped at
  -- insert; id is zero-padded (global, not per-year) so the value is immutable.
  ref_year           smallint     not null default extract(year from now())::smallint,
  agt_ref            varchar(24)  generated always as ('AGT-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,

  -- classification
  agency_level       varchar(20)  not null
                        check (agency_level in ('mga','wholesale','retail','sub-producer')),
  licensee_type      varchar(20)  not null
                        check (licensee_type in ('entity','individual')),
  billing_entity     varchar(10)  not null
                        check (billing_entity in ('self','parent')),

  -- name
  entity_name        varchar(200),
  first_name         varchar(100),
  last_name          varchar(100),
  display_name       varchar(200) generated always as (
                        case when licensee_type = 'entity'
                             then entity_name
                             else last_name || ', ' || first_name end
                     ) stored,

  -- contact
  phone              varchar(30),
  email              varchar(200),

  -- address
  address_line1      varchar(200),
  address_line2      varchar(200),
  city               varchar(100),
  state              char(2),
  zip                varchar(10),
  country            varchar(50),

  -- E&O / D&O coverage
  do_policy_number   varchar(50),
  do_carrier         varchar(100),
  do_expiration_date date,
  -- do_status is derived at read time (depends on current date); see view below

  -- audit
  status             varchar(20)  not null default 'active'
                        check (status in ('active','inactive')),
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now(),

  constraint agencies_billing_id_fkey
    foreign key (billing_id) references public.agencies (id)
);

-- indexes (Indexed = YES in spec; PK already covers id)
create index agencies_parent_id_idx     on public.agencies (parent_id);
create index agencies_billing_id_idx    on public.agencies (billing_id);
create index agencies_agency_level_idx  on public.agencies (agency_level);
create index agencies_licensee_type_idx on public.agencies (licensee_type);
create index agencies_entity_name_idx   on public.agencies (entity_name);
create index agencies_last_name_idx     on public.agencies (last_name);
create index agencies_display_name_idx  on public.agencies (display_name);
create index agencies_email_idx         on public.agencies (email);
create index agencies_status_idx        on public.agencies (status);

-- updated_at maintenance (Postgres has no ON UPDATE clause)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger agencies_set_updated_at
  before update on public.agencies
  for each row execute function public.set_updated_at();

-- do_status derived on read; security_invoker so the view respects the caller's RLS
create view public.agencies_with_status
  with (security_invoker = true) as
select *,
  case when do_expiration_date is null then null
       when do_expiration_date > current_date then 'active'
       else 'expired' end as do_status
from public.agencies;

-- Row Level Security
alter table public.agencies enable row level security;

-- NOTE: RLS is enabled with NO policies below, so only the service_role key
-- (which bypasses RLS) can read/write. The anon and authenticated keys are
-- denied until you add policies. Uncomment/adjust to grant access:
--
-- create policy "authenticated read"   on public.agencies
--   for select to authenticated using (true);
-- create policy "authenticated write"  on public.agencies
--   for all    to authenticated using (true) with check (true);
