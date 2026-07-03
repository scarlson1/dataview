-- Renewals: renewal pipeline for expiring policies (POL).

-- Reference table: per-line-of-business default renewal probability. This is the
-- LOB-default source that renewals_computed.renew_prob_pct falls back to when a
-- row has no renew_prob_pct_override. Maintained by the business; seed below.
create table public.lob_defaults (
  line_of_business        varchar(50)  primary key,
  default_renew_prob_pct  decimal(7,5) not null,
  created_at              timestamptz  not null default now()
);

insert into public.lob_defaults (line_of_business, default_renew_prob_pct) values
  ('GL',       0.85000),
  ('Property', 0.80000),
  ('WC',       0.82000),
  ('Cyber',    0.75000),
  ('Auto',     0.83000),
  ('Umbrella', 0.80000);

alter table public.lob_defaults enable row level security;

create table public.renewals (
  -- identity
  id                          bigint       generated always as identity primary key,
  policy_id                      bigint       not null references public.policies (id),  -- expiring policy
  new_policy_id                  bigint       references public.policies (id),           -- NULL until bound
  -- human-readable reference id (e.g. RNW-2026-0001); see agencies migration for rationale.
  ref_year                    smallint     not null default extract(year from now())::smallint,
  rnw_ref                     varchar(24)  generated always as ('RNW-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,

  -- pipeline status
  renewal_status              varchar(30)  not null default 'pending'
                                 check (renewal_status in ('pending','in_progress','quoted','bind_order','bound','non-renewed','lost')),
  assigned_to                 bigint       references public.underwriters (id),   -- UW registry
  bind_order_date             date,
  bound_date                  date,

  -- renewal terms (overrides for new term)
  txn_type                    varchar(20)  default 'renewal'
                                 check (txn_type in ('renewal','non-renewal')),
  new_policy_number           varchar(50),
  new_policy_eff_date         date,
  new_policy_exp_date         date,
  annual_premium              decimal(14,2),
  gross_com_pct_override      decimal(7,5),
  agency_com_pct              decimal(7,5),
  min_earned_prem_pct         decimal(7,5),
  sl_licensee_override_agent_id bigint       references public.agencies (id),
  inspection_fee              decimal(10,2) default 0.00,
  other_fees                  decimal(10,2) default 0.00,

  -- computed-from-expiring-POL: only the override input is stored; the derived
  -- values live in a view once POL / LOB defaults exist (see note below).
  renew_prob_pct_override     decimal(7,5),            -- NULL = use LOB default

  -- audit / report normalization
  common_policy_prefix        varchar(50),
  common_named_insured        varchar(200),
  yoa                         smallint,
  notes                       text,
  created_at                  timestamptz  not null default now(),
  updated_at                  timestamptz  not null default now()
);

-- indexes (Indexed = YES in spec; PK covers id)
create index renewals_policy_id_idx         on public.renewals (policy_id);
create index renewals_new_policy_id_idx     on public.renewals (new_policy_id);
create index renewals_renewal_status_idx on public.renewals (renewal_status);
create index renewals_assigned_to_idx    on public.renewals (assigned_to);
-- NOTE: current_renewal_date is marked Indexed in the spec but it's a computed
-- (view) column; index it on the view's base source or use a materialized view.

-- updated_at maintenance; reuses public.set_updated_at() from the agencies migration
create trigger renewals_set_updated_at
  before update on public.renewals
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.renewals enable row level security;

-- NOTE: RLS enabled with NO policies -> service_role only until you add policies:
--
-- create policy "authenticated read"  on public.renewals
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.renewals
--   for all    to authenticated using (true) with check (true);

-- ============================================================================
-- VIEW: renewals_computed — pipeline weighting derived from the expiring POL.
-- Sourcing:
--   current_renewal_date = policies_computed.current_policy_exp_date (chain MAX)
--   days_to_renewal      = current_renewal_date - current_date
--   term_premium         = expiring POL pro-rata term premium (policies_computed)
--   annualized_premium   = term_premium + prior-year adjustments (source still
--                          TBD, treated as 0 for now)
--   renew_prob_pct       = COALESCE(renew_prob_pct_override, lob_defaults default)
--   ev_rnw_gwp           = annualized_premium * renew_prob_pct
create view public.renewals_computed
  with (security_invoker = true) as
select r.*,
  pc.current_policy_exp_date                                        as current_renewal_date,
  (pc.current_policy_exp_date - current_date)                       as days_to_renewal,
  pc.term_premium                                                   as term_premium,
  pc.term_premium                                                   as annualized_premium,
  coalesce(r.renew_prob_pct_override, ld.default_renew_prob_pct)    as renew_prob_pct,
  pc.term_premium * coalesce(r.renew_prob_pct_override, ld.default_renew_prob_pct)
                                                                    as ev_rnw_gwp
from public.renewals r
join public.policies_computed pc on pc.id = r.policy_id
left join public.lob_defaults ld on ld.line_of_business = pc.line_of_business;

grant select on public.renewals_computed to authenticated;
-- ============================================================================
