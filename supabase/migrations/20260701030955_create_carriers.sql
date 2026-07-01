-- Carriers: insurance carrier details, contact, address, audit.

create table public.carriers (
  -- identity
  id                 bigint       generated always as identity primary key,

  -- carrier details
  carrier_name       varchar(200) not null unique,   -- must exactly match QBO vendor name
  naic_number        char(5)      unique,             -- 5-digit NAIC code
  am_best_rating     varchar(10),                     -- e.g. A+, A, A-, B++
  lines_of_business  varchar(200),                    -- comma-separated LOB codes
  carrier_type       varchar(30)
                        check (carrier_type in ('Admitted','E&S','Lloyd''s Syndicate','Lloyd''s Managing Agent')),
  state_admitted     varchar(200),                    -- states admitted; 'E&S' if surplus lines only
  domicile_state     char(2),

  -- contact
  contact_name       varchar(100),
  phone              varchar(30),
  email              varchar(200),
  claims_phone       varchar(30),

  -- address
  address_line1      varchar(200),
  address_line2      varchar(200),
  city               varchar(100),
  state              char(2),
  zip                varchar(10),
  country            varchar(50),

  -- audit
  status             varchar(20)  not null default 'active'
                        check (status in ('active','inactive')),
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now()
);

-- indexes (Indexed = YES in spec; PK/unique already cover id, carrier_name, naic_number)
create index carriers_carrier_type_idx   on public.carriers (carrier_type);
create index carriers_domicile_state_idx on public.carriers (domicile_state);
create index carriers_status_idx         on public.carriers (status);

-- updated_at maintenance; reuses public.set_updated_at() created in the agencies migration
create trigger carriers_set_updated_at
  before update on public.carriers
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.carriers enable row level security;

-- NOTE: RLS is enabled with NO policies, so only the service_role key can access
-- the table until you add policies. Uncomment/adjust to grant access:
--
-- create policy "authenticated read"  on public.carriers
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.carriers
--   for all    to authenticated using (true) with check (true);
