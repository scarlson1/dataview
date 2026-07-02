-- Policies (POL): the central transaction table. Referenced by NBS, RNW,
-- claims, payments, invoices, AR. Most financial fields are DERIVED and live in
-- the policies_computed view (deferred until binder exists; see bottom).

create table public.policies (
  -- identity & relationships
  id                          bigint       generated always as identity primary key,
  -- string cast of id for clients that can't cast bigint in a query (e.g. supabase-js)
  id_str                      text         generated always as (id::text) stored,
  parent_policy_id               bigint       references public.policies (id),   -- NULL = New Business
  -- human-readable reference id (e.g. POL-2026-0001); see agencies migration for rationale.
  ref_year                    smallint     not null default extract(year from now())::smallint,
  pol_ref                     varchar(24)  generated always as ('POL-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,
  client_id                      bigint       not null references public.clients (id),
  agent_id                      bigint       not null references public.agencies (id),
  carrier_id                      bigint       references public.carriers (id),    -- NULL if Subscription
  binder_id                      bigint       references public.binder (id),
  subscription_id             bigint,      -- FK -> public.subscription(id) (deferred)

  -- transaction classification
  transaction_type            varchar(20)  not null
                                 check (transaction_type in ('new_business','renewal','endorsement','cancellation','reinstatement')),
  status                      varchar(20)  not null default 'active'
                                 check (status in ('active','cancelled','expired','pending','reinstated')),
  -- NOTE: spec default 'single_carrier' (underscore) contradicted its CHECK
  -- 'single carrier' (space); normalized both to 'single_carrier'.
  placement_type              varchar(20)  not null default 'single_carrier'
                                 check (placement_type in ('single_carrier','subscription')),

  -- policy identification
  line_of_business            varchar(50)  not null,   -- e.g. GL, Property, WC, Cyber
  policy_number               varchar(50),
  common_policy_prefix        varchar(50),
  common_named_insured        varchar(200),
  binder_number               varchar(50),             -- denormalized copy; authoritative in binder

  -- dates
  policy_eff_date             date         not null,
  policy_exp_date             date         not null,
  txn_date                    date         not null,
  txn_eff_date                date,
  txn_exp_date                date,
  -- same-row computed -> stored generated column (GREATEST verified valid here)
  accounting_date             date         generated always as (greatest(txn_date, txn_eff_date)) stored,
  -- current_policy_exp_date is cross-row (per parent chain) -> policies_computed view

  -- premium & fees
  annual_premium              decimal(14,2),
  -- term_premium, total_term_premium, total_term_prem_fees -> policies_computed view
  term_terrorism_premium      decimal(14,2) default 0.00,
  policy_fee                  decimal(10,2) default 0.00,
  inspection_fee              decimal(10,2) default 0.00,
  other_fees                  decimal(10,2) default 0.00,
  other_fee_description       varchar(200),

  -- commission (only the stored inputs; all derived rates/amounts -> view)
  gross_com_pct_override      decimal(7,5),            -- NULL = use binder rate
  agency_com_pct              decimal(7,5)  not null,
  min_earned_prem_pct         decimal(7,5),

  -- coverage
  cov_a_limit                 decimal(16,2),
  cov_b_limit                 decimal(16,2),
  cov_c_limit                 decimal(16,2),
  cov_d_limit                 decimal(16,2),
  deductible_amt              decimal(14,2),
  deductible_base             varchar(50),

  -- surplus lines
  jurisdiction                varchar(50),
  home_state                  char(2),                 -- primary SL filing state
  agency_name_sl_key          varchar(200),            -- denormalized SL lookup key
  sl_licensee_override_agent_id bigint       references public.agencies (id),   -- NULL = auto-resolve
  -- sl_licensee_name, sl_eligible_licensees -> policies_computed view (join LIC)

  -- Lloyd's specific
  yoa                         smallint,
  lloyds_umr                  varchar(30),
  section_number              varchar(20),

  -- audit
  assigned_to_uw_id           bigint       references public.underwriters (id),
  notes                       text,
  created_at                  timestamptz  not null default now(),
  updated_at                  timestamptz  not null default now()
);

-- indexes (Indexed = YES in spec; PK already covers id)
create index policies_parent_policy_id_idx     on public.policies (parent_policy_id);
create index policies_client_id_idx            on public.policies (client_id);
create index policies_agent_id_idx            on public.policies (agent_id);
create index policies_carrier_id_idx            on public.policies (carrier_id);
create index policies_binder_id_idx            on public.policies (binder_id);
create index policies_subscription_id_idx   on public.policies (subscription_id);
create index policies_transaction_type_idx  on public.policies (transaction_type);
create index policies_status_idx            on public.policies (status);
create index policies_placement_type_idx    on public.policies (placement_type);
create index policies_line_of_business_idx  on public.policies (line_of_business);
create index policies_policy_number_idx     on public.policies (policy_number);
create index policies_binder_number_idx     on public.policies (binder_number);
create index policies_policy_eff_date_idx   on public.policies (policy_eff_date);
create index policies_policy_exp_date_idx   on public.policies (policy_exp_date);
create index policies_txn_date_idx          on public.policies (txn_date);
create index policies_accounting_date_idx   on public.policies (accounting_date);
create index policies_jurisdiction_idx      on public.policies (jurisdiction);
create index policies_home_state_idx        on public.policies (home_state);
create index policies_agency_name_sl_key_idx on public.policies (agency_name_sl_key);
create index policies_lloyds_umr_idx        on public.policies (lloyds_umr);
create index policies_assigned_to_uw_id_idx on public.policies (assigned_to_uw_id);

-- updated_at maintenance; reuses public.set_updated_at() from the agencies migration
create trigger policies_set_updated_at
  before update on public.policies
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.policies enable row level security;

-- NOTE: RLS enabled with NO policies -> service_role only until you add policies:
--
-- create policy "authenticated read"  on public.policies
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.policies
--   for all    to authenticated using (true) with check (true);

-- ============================================================================
-- DEFERRED FK: run this AFTER public.subscription exists.
--
-- alter table public.policies
--   add constraint policies_subscription_id_fkey foreign key (subscription_id) references public.subscription (id);
-- ============================================================================

-- ============================================================================
-- VIEW: policies_computed — derived premium & commission math for POL.
-- BUSINESS ASSUMPTIONS (confirm before trusting revenue/commission numbers):
--   * term_days = transaction term (txn_eff/exp), falling back to policy term.
--   * "chain" = COALESCE(parent_policy_id, id) for current_policy_exp_date.
--   * SL licensee resolution approximated to the license's own agent_id;
--     sl_licensee_name pulls agencies.display_name via license.agent_id
--     (LIC has no name column). Refine for the agency vertical chain later.
-- "Active" license = exp_date >= current_date (matches license_computed.status).
create view public.policies_computed
  with (security_invoker = true) as
with derived as (
  select p.*,
    (coalesce(p.txn_exp_date, p.policy_exp_date)
       - coalesce(p.txn_eff_date, p.policy_eff_date))                 as term_days,
    max(p.txn_exp_date) over (partition by coalesce(p.parent_policy_id, p.id))
                                                                      as current_policy_exp_date,
    coalesce(p.gross_com_pct_override, b.gross_com_pct)               as gross_com_pct
  from public.policies p
  left join public.binder b on b.id = p.binder_id
)
select d.*,
  round(d.annual_premium * d.term_days / 365.0, 2)                    as term_premium,
  round(d.annual_premium * d.term_days / 365.0, 2)
    + coalesce(d.term_terrorism_premium, 0)                           as total_term_premium,
  round(d.annual_premium * d.term_days / 365.0, 2)
    + coalesce(d.term_terrorism_premium, 0)
    + coalesce(d.policy_fee, 0) + coalesce(d.inspection_fee, 0)
    + coalesce(d.other_fees, 0)                                       as total_term_prem_fees,
  (d.gross_com_pct - d.agency_com_pct)                                as mga_net_com_pct,
  (1 - d.gross_com_pct)                                               as carrier_net_pct,
  -- *_amt use total_term_premium (= pro-rata + terrorism):
  (round(d.annual_premium * d.term_days / 365.0, 2) + coalesce(d.term_terrorism_premium,0)) * d.gross_com_pct               as gross_com_amt,
  (round(d.annual_premium * d.term_days / 365.0, 2) + coalesce(d.term_terrorism_premium,0)) * d.agency_com_pct              as agency_com_amt,
  (round(d.annual_premium * d.term_days / 365.0, 2) + coalesce(d.term_terrorism_premium,0)) * (d.gross_com_pct - d.agency_com_pct) as mga_net_com_amt,
  (round(d.annual_premium * d.term_days / 365.0, 2) + coalesce(d.term_terrorism_premium,0)) * (1 - d.gross_com_pct)         as carrier_net_amt,
  (select a.display_name from public.license l
     join public.agencies a on a.id = l.agent_id
     where l.default_sl_licensee and l.state = d.home_state
       and l.agent_id = coalesce(d.sl_licensee_override_agent_id, d.agent_id)
     limit 1)                                                         as sl_licensee_name,
  (select count(*) from public.license l
     where l.state = d.home_state and l.exp_date >= current_date
       and l.agent_id = d.agent_id)                                   as sl_eligible_licensees
from derived d;

grant select on public.policies_computed to authenticated;
-- ============================================================================
