-- New business submissions: pipeline records that mirror POL fields until bound.

create table public.new_business_submissions (
  -- identity
  id                          bigint       generated always as identity primary key,
  submission_number           varchar(20)  not null unique,   -- external ref (app-generated, e.g. SUB-YYYY-NNN)
  policy_id                      bigint       references public.policies (id),   -- NULL until bound

  -- pipeline status
  stage                       varchar(30)  not null default 'prospect'
                                 check (stage in ('prospect','submitted','quoted','bind_order','bound','lost','declined')),
  priority                    varchar(20)  check (priority in ('high','medium','low')),
  assigned_to                 bigint       references public.underwriters (id),   -- UW registry
  submission_date             date,
  quote_due_date              date,
  quote_received              date,
  bind_order_date             date,
  bound_date                  date,

  -- foreign keys
  client_id                      bigint       not null references public.clients (id),
  agent_id                      bigint       not null references public.agencies (id),
  carrier_id                      bigint       references public.carriers (id),
  binder_id                      bigint       references public.binder (id),

  -- policy data (mirrors POL manual fields; transferred to POL on bind)
  line_of_business            varchar(50),
  policy_number               varchar(50),
  policy_eff_date             date,
  policy_exp_date             date,
  jurisdiction                varchar(50),
  home_state                  char(2),
  annual_premium              decimal(14,2),
  terrorism_premium           decimal(14,2),
  policy_fee                  decimal(10,2),
  inspection_fee              decimal(10,2),
  other_fees                  decimal(10,2),
  other_fee_description       varchar(200),
  gross_com_pct_override      decimal(7,5),
  agency_com_pct              decimal(7,5),
  min_earned_prem_pct         decimal(7,5),
  sl_licensee_override_agent_id bigint,                          -- soft ref to an agency; not a FK per spec
  cov_a_limit                 decimal(16,2),
  cov_b_limit                 decimal(16,2),
  cov_c_limit                 decimal(16,2),
  cov_d_limit                 decimal(16,2),
  deductible_amt              decimal(14,2),
  deductible_base             varchar(50),
  yoa                         smallint,
  lloyds_umr                  varchar(30),
  section_number              varchar(20),
  binder_number               varchar(50),
  common_named_insured        varchar(200),
  common_policy_prefix        varchar(50),

  -- audit
  notes                       text,
  created_at                  timestamptz  not null default now(),
  updated_at                  timestamptz  not null default now()
);

-- indexes (Indexed = YES in spec; PK covers id, unique covers submission_number)
create index nbs_policy_id_idx          on public.new_business_submissions (policy_id);
create index nbs_stage_idx           on public.new_business_submissions (stage);
create index nbs_priority_idx        on public.new_business_submissions (priority);
create index nbs_assigned_to_idx     on public.new_business_submissions (assigned_to);
create index nbs_submission_date_idx on public.new_business_submissions (submission_date);
create index nbs_client_id_idx          on public.new_business_submissions (client_id);
create index nbs_agent_id_idx          on public.new_business_submissions (agent_id);
create index nbs_carrier_id_idx          on public.new_business_submissions (carrier_id);
create index nbs_binder_id_idx          on public.new_business_submissions (binder_id);

-- updated_at maintenance; reuses public.set_updated_at() from the agencies migration
create trigger nbs_set_updated_at
  before update on public.new_business_submissions
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.new_business_submissions enable row level security;

-- NOTE: RLS enabled with NO policies -> service_role only until you add policies:
--
-- create policy "authenticated read"  on public.new_business_submissions
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.new_business_submissions
--   for all    to authenticated using (true) with check (true);
