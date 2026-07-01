-- Surplus lines state rules: one row per US state (state is a natural key).

create table public.surplus_lines_state_rules (
  -- state is the natural primary key -- no surrogate id here
  state                       char(2)      primary key,

  -- regulatory details
  state_full_name             varchar(50)  not null,
  entity_license_accepted     boolean      not null,   -- state allows entity SL license
  individual_license_required boolean      not null,   -- individual always required
  stamping_office             varchar(100),
  notes                       text,                    -- key state-specific SL filing requirements
  source                      varchar(200),            -- e.g. Troutman Pepper Locke SL Laws Manual
  last_verified               date                     -- date last reviewed; update annually
);

-- Row Level Security
alter table public.surplus_lines_state_rules enable row level security;

-- NOTE: RLS enabled with NO policies -> service_role only until you add policies:
--
-- create policy "authenticated read"  on public.surplus_lines_state_rules
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.surplus_lines_state_rules
--   for all    to authenticated using (true) with check (true);
