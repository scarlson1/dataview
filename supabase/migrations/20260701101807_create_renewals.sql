-- Renewals: renewal pipeline for expiring policies (POL).

create table public.renewals (
  -- identity
  id                          bigint       generated always as identity primary key,
  policy_id                      bigint       not null references public.policies (id),  -- expiring policy
  new_policy_id                  bigint       references public.policies (id),           -- NULL until bound

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
-- DEFERRED: computed view.
-- public.policies now exists, but this view still needs an LOB-default source
-- (for renew_prob_pct) and a prior-year-adjustments source (for
-- annualized_premium), both still undefined. Fields to derive:
--   current_renewal_date = MAX(policy_exp_date) for the policy_id chain (from POL)
--   days_to_renewal      = current_renewal_date - current_date
--   term_premium         = from the expiring POL
--   annualized_premium   = term_premium + prior-year adjustments   (source TBD)
--   renew_prob_pct       = COALESCE(renew_prob_pct_override, <LOB default>)
--   ev_rnw_gwp           = annualized_premium * renew_prob_pct
-- ============================================================================
