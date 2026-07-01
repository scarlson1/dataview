-- Licenses: state licenses held by an agency (agent) record.

create table public.license (
  -- identity
  id                  bigint       generated always as identity primary key,
  agent_id              bigint       not null
                         references public.agencies (id),   -- agent that holds this license

  -- license details
  license_type        varchar(50)  not null,   -- e.g. Surplus Lines, Resident P&C
  state               char(2)      not null,   -- US 2-char state code
  license_number      varchar(50)  not null,   -- state-issued license number
  eff_date            date         not null,
  exp_date            date         not null,
  -- status, days_to_expiration, entity_license_accepted are non-immutable/cross-table
  -- computed values -> derived in public.license_computed view (below).

  -- SL default flag
  default_sl_licensee boolean      not null default false,

  -- audit
  notes               text,
  created_at          timestamptz  not null default now()
);

-- indexes (Indexed = YES in spec; PK already covers id)
create index license_agent_id_idx              on public.license (agent_id);
create index license_license_type_idx        on public.license (license_type);
create index license_state_idx               on public.license (state);
create index license_license_number_idx      on public.license (license_number);
create index license_exp_date_idx            on public.license (exp_date);
create index license_default_sl_licensee_idx on public.license (default_sl_licensee);

-- Only one default SL licensee per (agent_id, state).
-- NOTE: the spec says "per agency chain + State", but "agency chain" (the parent
-- hierarchy) is not a single stored column, so this enforces per-agent + state.
-- True chain-level enforcement needs a chain/root column or application logic.
create unique index license_one_default_sl_per_agent_state
  on public.license (agent_id, state)
  where default_sl_licensee;

-- Derived columns as a view (security_invoker = true so it respects caller RLS):
--   status               : active/expired vs current date
--   days_to_expiration   : exp_date - current_date (negative = expired)
--   entity_license_accepted : from surplus_lines_state_rules for the license's state
create view public.license_computed
  with (security_invoker = true) as
select l.*,
  case when l.exp_date > current_date then 'active' else 'expired' end as status,
  (l.exp_date - current_date)                                          as days_to_expiration,
  r.entity_license_accepted                                            as entity_license_accepted
from public.license l
left join public.surplus_lines_state_rules r on r.state = l.state;

-- Row Level Security
alter table public.license enable row level security;

-- NOTE: RLS enabled with NO policies -> service_role only until you add policies:
--
-- create policy "authenticated read"  on public.license
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.license
--   for all    to authenticated using (true) with check (true);
