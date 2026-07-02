-- Policy mid-term transaction actions (mirror the workbook's INPUT-CHECKOUT
-- Section 3 endorsement + cancellation/reinstatement flows). Each inserts a NEW
-- policies row linked to the head of the policy chain via parent_policy_id, so
-- the original New Business POL-ID always anchors the lineage. All are
-- security definer (bypass RLS internally) and callable by `authenticated`.

-- ---------------------------------------------------------------------------
-- create_endorsement: a mid-term change to an existing policy. The endorsement's
-- own term is [p_txn_eff_date, p_txn_exp_date] (independent of the policy term).
-- p_premium_change is the FLAT additional/return premium for that term; we solve
-- annual_premium so policies_computed.term_premium (annual * term_days/365) ≈
-- the entered change, regardless of how much term remains.
create or replace function public.create_endorsement(
  p_policy_id      bigint,
  p_txn_eff_date   date,
  p_premium_change decimal,
  p_reason         text    default null,
  p_txn_exp_date   date    default null,
  p_cov_a_limit    decimal default null,
  p_cov_c_limit    decimal default null,
  p_deductible_amt decimal default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  parent   public.policies%rowtype;
  head_id  bigint;
  exp_date date;
  days     integer;
  annual   decimal(14,2);
  new_id   bigint;
begin
  select * into parent from public.policies where id = p_policy_id;
  if not found then
    raise exception 'Policy % not found', p_policy_id;
  end if;

  head_id  := coalesce(parent.parent_policy_id, parent.id);
  exp_date := coalesce(p_txn_exp_date, parent.policy_exp_date);
  days     := greatest((exp_date - p_txn_eff_date), 1);
  annual   := round(p_premium_change * 365.0 / days, 2);

  insert into public.policies (
    parent_policy_id, client_id, agent_id, carrier_id, binder_id, subscription_id,
    transaction_type, status, placement_type,
    line_of_business, policy_number, binder_number,
    policy_eff_date, policy_exp_date, txn_date, txn_eff_date, txn_exp_date,
    annual_premium, agency_com_pct, gross_com_pct_override, min_earned_prem_pct,
    cov_a_limit, cov_b_limit, cov_c_limit, cov_d_limit, deductible_amt, deductible_base,
    jurisdiction, home_state, agency_name_sl_key, sl_licensee_override_agent_id,
    yoa, lloyds_umr, section_number, assigned_to_uw_id, notes
  ) values (
    head_id, parent.client_id, parent.agent_id, parent.carrier_id, parent.binder_id, parent.subscription_id,
    'endorsement', 'active', parent.placement_type,
    parent.line_of_business, parent.policy_number, parent.binder_number,
    parent.policy_eff_date, parent.policy_exp_date, current_date, p_txn_eff_date, exp_date,
    annual, parent.agency_com_pct, parent.gross_com_pct_override, parent.min_earned_prem_pct,
    coalesce(p_cov_a_limit, parent.cov_a_limit), parent.cov_b_limit,
    coalesce(p_cov_c_limit, parent.cov_c_limit), parent.cov_d_limit,
    coalesce(p_deductible_amt, parent.deductible_amt), parent.deductible_base,
    parent.jurisdiction, parent.home_state, parent.agency_name_sl_key, parent.sl_licensee_override_agent_id,
    parent.yoa, parent.lloyds_umr, parent.section_number, parent.assigned_to_uw_id, p_reason
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_policy: books a cancellation transaction (negative/return premium over
-- the remaining term) and flags the head policy cancelled.
create or replace function public.cancel_policy(
  p_policy_id      bigint,
  p_txn_eff_date   date    default current_date,
  p_return_premium decimal default 0,
  p_reason         text    default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  parent  public.policies%rowtype;
  head_id bigint;
  days    integer;
  annual  decimal(14,2);
  new_id  bigint;
begin
  select * into parent from public.policies where id = p_policy_id;
  if not found then
    raise exception 'Policy % not found', p_policy_id;
  end if;

  head_id := coalesce(parent.parent_policy_id, parent.id);
  days    := greatest((parent.policy_exp_date - p_txn_eff_date), 1);
  annual  := round(-abs(p_return_premium) * 365.0 / days, 2);

  insert into public.policies (
    parent_policy_id, client_id, agent_id, carrier_id, binder_id, subscription_id,
    transaction_type, status, placement_type,
    line_of_business, policy_number, binder_number,
    policy_eff_date, policy_exp_date, txn_date, txn_eff_date, txn_exp_date,
    annual_premium, agency_com_pct, gross_com_pct_override, min_earned_prem_pct,
    jurisdiction, home_state, agency_name_sl_key,
    yoa, lloyds_umr, section_number, assigned_to_uw_id, notes
  ) values (
    head_id, parent.client_id, parent.agent_id, parent.carrier_id, parent.binder_id, parent.subscription_id,
    'cancellation', 'cancelled', parent.placement_type,
    parent.line_of_business, parent.policy_number, parent.binder_number,
    parent.policy_eff_date, parent.policy_exp_date, current_date, p_txn_eff_date, parent.policy_exp_date,
    annual, parent.agency_com_pct, parent.gross_com_pct_override, parent.min_earned_prem_pct,
    parent.jurisdiction, parent.home_state, parent.agency_name_sl_key,
    parent.yoa, parent.lloyds_umr, parent.section_number, parent.assigned_to_uw_id, p_reason
  )
  returning id into new_id;

  update public.policies set status = 'cancelled' where id = head_id;
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- reinstate_policy: books a zero-premium reinstatement and re-activates the head.
create or replace function public.reinstate_policy(
  p_policy_id    bigint,
  p_txn_eff_date date default current_date,
  p_reason       text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  parent  public.policies%rowtype;
  head_id bigint;
  new_id  bigint;
begin
  select * into parent from public.policies where id = p_policy_id;
  if not found then
    raise exception 'Policy % not found', p_policy_id;
  end if;

  head_id := coalesce(parent.parent_policy_id, parent.id);

  insert into public.policies (
    parent_policy_id, client_id, agent_id, carrier_id, binder_id, subscription_id,
    transaction_type, status, placement_type,
    line_of_business, policy_number, binder_number,
    policy_eff_date, policy_exp_date, txn_date, txn_eff_date, txn_exp_date,
    annual_premium, agency_com_pct, gross_com_pct_override, min_earned_prem_pct,
    jurisdiction, home_state, agency_name_sl_key,
    yoa, lloyds_umr, section_number, assigned_to_uw_id, notes
  ) values (
    head_id, parent.client_id, parent.agent_id, parent.carrier_id, parent.binder_id, parent.subscription_id,
    'reinstatement', 'reinstated', parent.placement_type,
    parent.line_of_business, parent.policy_number, parent.binder_number,
    parent.policy_eff_date, parent.policy_exp_date, current_date, p_txn_eff_date, parent.policy_exp_date,
    0, parent.agency_com_pct, parent.gross_com_pct_override, parent.min_earned_prem_pct,
    parent.jurisdiction, parent.home_state, parent.agency_name_sl_key,
    parent.yoa, parent.lloyds_umr, parent.section_number, parent.assigned_to_uw_id, p_reason
  )
  returning id into new_id;

  update public.policies set status = 'reinstated' where id = head_id;
  return new_id;
end;
$$;

grant execute on function public.create_endorsement(bigint, date, decimal, text, date, decimal, decimal, decimal) to authenticated;
grant execute on function public.cancel_policy(bigint, date, decimal, text)  to authenticated;
grant execute on function public.reinstate_policy(bigint, date, text)        to authenticated;
