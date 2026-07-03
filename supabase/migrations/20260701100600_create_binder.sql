-- Binders (BDR): carrier binder; source of truth for commission rates on
-- policies placed under it.

create table public.binder (
  -- identity
  id             bigint       generated always as identity primary key,
  carrier_id         bigint       not null references public.carriers (id),
  -- human-readable reference id (e.g. BDR-2026-0001); see agencies migration for rationale.
  ref_year       smallint     not null default extract(year from now())::smallint,
  bdr_ref        varchar(24)  generated always as ('BDR-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,

  -- binder details
  binder_number  varchar(50)  not null unique,   -- carrier-assigned binder reference
  yoa            smallint,                        -- year of account
  eff_date       date         not null,
  exp_date       date         not null,
  gross_com_pct  decimal(7,5) not null,           -- 0.32500 = 32.5%; source of truth for commission

  -- audit
  notes          text,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now()
);

-- indexes (Indexed = YES in spec; PK covers id, unique covers binder_number)
create index binder_carrier_id_idx   on public.binder (carrier_id);
create index binder_yoa_idx      on public.binder (yoa);
create index binder_eff_date_idx on public.binder (eff_date);
create index binder_exp_date_idx on public.binder (exp_date);

-- updated_at maintenance; reuses public.set_updated_at() from the agencies migration
create trigger binder_set_updated_at
  before update on public.binder
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.binder enable row level security;

-- NOTE: RLS enabled with NO policies -> service_role only until you add policies:
--
-- create policy "authenticated read"  on public.binder
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.binder
--   for all    to authenticated using (true) with check (true);
