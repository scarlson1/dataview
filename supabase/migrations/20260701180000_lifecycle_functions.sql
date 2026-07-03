-- ============================================================================
-- Lifecycle workflow functions — the policy-cycle state transitions the workbook
-- describes prose-only. All are `security definer` (they bypass RLS to perform
-- controlled multi-table writes) with a pinned search_path, and each runs inside
-- the calling statement's transaction so its multi-table writes are atomic.
--
--   bind_new_business(nbs_id)     NBS  -> POL   (mirror fields transferred)
--   bind_renewal(renewal_id)      RNW  -> POL   (new term from expiring POL + overrides)
--   seed_renewals(days_ahead)     POL  -> RNW   (pre-populate the renewal pipeline)
--   generate_invoice(policy_id)   POL  -> INV -> AR -> CAP   (snapshot + fiduciary)
--   record_ar_payment(...)        child insert into accounts_receivable_payments
--   record_cap_remittance(...)    child insert into capacity_remittance
-- ============================================================================

-- ----------------------------------------------------------------------------
-- bind_new_business: create a POL from a bound NBS submission and link it back.
-- ----------------------------------------------------------------------------
create or replace function public.bind_new_business(p_nbs_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.new_business_submissions%rowtype;
  v_policy_id bigint;
begin
  select * into n from public.new_business_submissions where id = p_nbs_id;
  if not found then
    raise exception 'NBS % not found', p_nbs_id;
  end if;
  if n.policy_id is not null then
    raise exception 'NBS % is already bound to policy %', p_nbs_id, n.policy_id;
  end if;
  if n.line_of_business is null or n.policy_eff_date is null or n.policy_exp_date is null then
    raise exception 'NBS % cannot be bound: line_of_business, policy_eff_date and policy_exp_date are required', p_nbs_id;
  end if;

  insert into public.policies (
    transaction_type, status, placement_type,
    client_id, agent_id, carrier_id, binder_id,
    line_of_business, policy_number, binder_number,
    common_policy_prefix, common_named_insured,
    policy_eff_date, policy_exp_date, txn_date, txn_eff_date, txn_exp_date,
    annual_premium, term_terrorism_premium, policy_fee, inspection_fee,
    other_fees, other_fee_description,
    gross_com_pct_override, agency_com_pct, min_earned_prem_pct,
    cov_a_limit, cov_b_limit, cov_c_limit, cov_d_limit,
    deductible_amt, deductible_base,
    jurisdiction, home_state, sl_licensee_override_agent_id,
    yoa, lloyds_umr, section_number, assigned_to_uw_id
  ) values (
    'new_business', 'active', 'single_carrier',
    n.client_id, n.agent_id, n.carrier_id, n.binder_id,
    n.line_of_business, n.policy_number, n.binder_number,
    n.common_policy_prefix, n.common_named_insured,
    n.policy_eff_date, n.policy_exp_date,
    coalesce(n.bound_date, current_date), n.policy_eff_date, n.policy_exp_date,
    n.annual_premium, coalesce(n.terrorism_premium, 0), coalesce(n.policy_fee, 0),
    coalesce(n.inspection_fee, 0), coalesce(n.other_fees, 0), n.other_fee_description,
    n.gross_com_pct_override, coalesce(n.agency_com_pct, 0), n.min_earned_prem_pct,
    n.cov_a_limit, n.cov_b_limit, n.cov_c_limit, n.cov_d_limit,
    n.deductible_amt, n.deductible_base,
    n.jurisdiction, n.home_state, n.sl_licensee_override_agent_id,
    n.yoa, n.lloyds_umr, n.section_number, n.assigned_to
  )
  returning id into v_policy_id;

  update public.new_business_submissions
     set policy_id  = v_policy_id,
         stage      = 'bound',
         bound_date = coalesce(bound_date, current_date)
   where id = p_nbs_id;

  return v_policy_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- bind_renewal: create a renewal POL from the expiring policy + RNW overrides.
-- ----------------------------------------------------------------------------
create or replace function public.bind_renewal(p_renewal_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.renewals%rowtype;
  e public.policies%rowtype;   -- expiring policy
  v_policy_id bigint;
  v_eff  date;
  v_exp  date;
begin
  select * into r from public.renewals where id = p_renewal_id;
  if not found then
    raise exception 'Renewal % not found', p_renewal_id;
  end if;
  if r.new_policy_id is not null then
    raise exception 'Renewal % is already bound to policy %', p_renewal_id, r.new_policy_id;
  end if;
  if r.txn_type = 'non-renewal' then
    raise exception 'Renewal % is marked non-renewal and cannot be bound', p_renewal_id;
  end if;

  select * into e from public.policies where id = r.policy_id;
  if not found then
    raise exception 'Expiring policy % not found', r.policy_id;
  end if;

  v_eff := coalesce(r.new_policy_eff_date, e.policy_exp_date);
  v_exp := coalesce(r.new_policy_exp_date, (e.policy_exp_date + interval '1 year')::date);

  insert into public.policies (
    transaction_type, status, placement_type, parent_policy_id,
    client_id, agent_id, carrier_id, binder_id,
    line_of_business, policy_number, binder_number,
    common_policy_prefix, common_named_insured,
    policy_eff_date, policy_exp_date, txn_date, txn_eff_date, txn_exp_date,
    annual_premium, term_terrorism_premium, policy_fee, inspection_fee,
    other_fees, other_fee_description,
    gross_com_pct_override, agency_com_pct, min_earned_prem_pct,
    cov_a_limit, cov_b_limit, cov_c_limit, cov_d_limit,
    deductible_amt, deductible_base,
    jurisdiction, home_state, agency_name_sl_key, sl_licensee_override_agent_id,
    yoa, lloyds_umr, section_number, assigned_to_uw_id
  ) values (
    'renewal', 'active', e.placement_type, e.id,
    e.client_id, e.agent_id, e.carrier_id, e.binder_id,
    e.line_of_business, coalesce(r.new_policy_number, e.policy_number), e.binder_number,
    coalesce(r.common_policy_prefix, e.common_policy_prefix),
    coalesce(r.common_named_insured, e.common_named_insured),
    v_eff, v_exp, coalesce(r.bound_date, current_date), v_eff, v_exp,
    coalesce(r.annual_premium, e.annual_premium), e.term_terrorism_premium, e.policy_fee,
    coalesce(r.inspection_fee, e.inspection_fee), coalesce(r.other_fees, e.other_fees),
    e.other_fee_description,
    coalesce(r.gross_com_pct_override, e.gross_com_pct_override),
    coalesce(r.agency_com_pct, e.agency_com_pct),
    coalesce(r.min_earned_prem_pct, e.min_earned_prem_pct),
    e.cov_a_limit, e.cov_b_limit, e.cov_c_limit, e.cov_d_limit,
    e.deductible_amt, e.deductible_base,
    e.jurisdiction, e.home_state, e.agency_name_sl_key,
    coalesce(r.sl_licensee_override_agent_id, e.sl_licensee_override_agent_id),
    coalesce(r.yoa, e.yoa), e.lloyds_umr, e.section_number,
    coalesce(r.assigned_to, e.assigned_to_uw_id)
  )
  returning id into v_policy_id;

  update public.renewals
     set new_policy_id  = v_policy_id,
         renewal_status = 'bound',
         bound_date     = coalesce(bound_date, current_date)
   where id = p_renewal_id;

  -- expiring policy transitions to expired once its successor is bound
  update public.policies set status = 'expired' where id = e.id and status = 'active';

  return v_policy_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- seed_renewals: create pending RNW rows for active head policies expiring
-- within the window that don't already have a renewal. Returns rows inserted.
-- ----------------------------------------------------------------------------
create or replace function public.seed_renewals(p_days_ahead integer default 120)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.renewals (policy_id, renewal_status, txn_type)
  select p.id, 'pending', 'renewal'
  from public.policies p
  where p.status = 'active'
    and p.policy_exp_date between current_date and (current_date + p_days_ahead)
    and not exists (select 1 from public.policies c where c.parent_policy_id = p.id)
    and not exists (select 1 from public.renewals r where r.policy_id = p.id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ----------------------------------------------------------------------------
-- generate_invoice: snapshot POL (via policies_computed) into INV, then create
-- the AR row, back-fill invoices.ar_id, and create the CAP fiduciary row.
-- One invoice per policy (net_com_uep assumes <= 1 invoice per policy row).
-- ----------------------------------------------------------------------------
create or replace function public.generate_invoice(p_policy_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  pc public.policies_computed%rowtype;
  v_invoice_id bigint;
  v_ar_id bigint;
  v_invoice_date date;
begin
  select * into pc from public.policies_computed where id = p_policy_id;
  if not found then
    raise exception 'Policy % not found', p_policy_id;
  end if;
  if exists (select 1 from public.invoices where policy_id = p_policy_id) then
    raise exception 'Policy % already has an invoice', p_policy_id;
  end if;

  v_invoice_date := coalesce(pc.accounting_date, current_date);

  insert into public.invoices (
    policy_id, agent_id, transaction_type,
    invoice_date, due_date,
    policy_eff_date, policy_exp_date, txn_eff_date, txn_exp_date,
    annual_premium, term_premium, term_terrorism_premium, total_term_premium,
    policy_fee, inspection_fee, other_fees, other_fee_description,
    total_term_prem_fees, mga_net_com_pct, mga_net_com_amt,
    invoice_status
  ) values (
    pc.id, pc.agent_id, pc.transaction_type,
    v_invoice_date, (v_invoice_date + 30),
    pc.policy_eff_date, pc.policy_exp_date, pc.txn_eff_date, pc.txn_exp_date,
    pc.annual_premium, pc.term_premium, pc.term_terrorism_premium, pc.total_term_premium,
    pc.policy_fee, pc.inspection_fee, pc.other_fees, pc.other_fee_description,
    pc.total_term_prem_fees, pc.mga_net_com_pct, pc.mga_net_com_amt,
    'outstanding'
  )
  returning id into v_invoice_id;

  insert into public.accounts_receivable (
    inv_id, policy_id, client_id, agent_id,
    invoice_date, due_date, invoice_total, ar_status
  ) values (
    v_invoice_id, pc.id, pc.client_id, pc.agent_id,
    v_invoice_date, (v_invoice_date + 30), coalesce(pc.total_term_prem_fees, 0), 'outstanding'
  )
  returning id into v_ar_id;

  update public.invoices set ar_id = v_ar_id where id = v_invoice_id;

  -- Carrier payable (fiduciary) — only for single-carrier placements (CAP.carrier_id NOT NULL).
  if pc.carrier_id is not null then
    insert into public.capacity (
      inv_id, ar_id, policy_id, carrier_id, client_id,
      term_premium, commission_pct, ap_status
    ) values (
      v_invoice_id, v_ar_id, pc.id, pc.carrier_id, pc.client_id,
      pc.total_term_premium, pc.gross_com_pct, 'outstanding'
    );
  end if;

  return v_invoice_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- record_ar_payment: insert a client payment and refresh the AR status column.
-- ----------------------------------------------------------------------------
create or replace function public.record_ar_payment(
  p_ar_id     bigint,
  p_amount    decimal,
  p_date      date    default current_date,
  p_method    varchar default null,
  p_reference varchar default null,
  p_notes     text    default null,
  p_created_by varchar default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  ar public.accounts_receivable%rowtype;
  v_payment_id bigint;
  v_total_paid decimal(14,2);
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be > 0';
  end if;
  select * into ar from public.accounts_receivable where id = p_ar_id;
  if not found then
    raise exception 'AR % not found', p_ar_id;
  end if;

  insert into public.accounts_receivable_payments (
    ar_id, payment_date, payment_amount, payment_method, reference_number, notes, created_by
  ) values (
    p_ar_id, p_date, p_amount, p_method, p_reference, p_notes, p_created_by
  )
  returning id into v_payment_id;

  select coalesce(sum(payment_amount), 0) into v_total_paid
  from public.accounts_receivable_payments where ar_id = p_ar_id;

  update public.accounts_receivable
     set ar_status = case
           when v_total_paid >= (ar.invoice_total - coalesce(ar.write_off_amt, 0)) then 'paid'
           when v_total_paid > 0 then 'partial'
           else 'outstanding'
         end
   where id = p_ar_id;

  return v_payment_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- record_cap_remittance: remit funds to the carrier (bounded by the live
-- available_for_payment) and refresh the CAP status column.
-- ----------------------------------------------------------------------------
create or replace function public.record_cap_remittance(
  p_cap_id bigint,
  p_amount decimal,
  p_date   date default current_date
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available decimal(14,2);
  v_net_due   decimal(14,2);
  v_total_remitted decimal(14,2);
  v_remittance_id bigint;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Remittance amount must be > 0';
  end if;

  select available_for_payment, net_premium_due_carrier
    into v_available, v_net_due
  from public.capacity_computed where id = p_cap_id;
  if not found then
    raise exception 'CAP % not found', p_cap_id;
  end if;

  if p_amount > coalesce(v_available, 0) + 0.005 then
    raise exception 'Remittance % exceeds available_for_payment %', p_amount, v_available;
  end if;

  insert into public.capacity_remittance (cap_id, remit_date, remit_amount)
  values (p_cap_id, p_date, p_amount)
  returning id into v_remittance_id;

  select coalesce(sum(remit_amount), 0) into v_total_remitted
  from public.capacity_remittance where cap_id = p_cap_id;

  update public.capacity
     set ap_status = case
           when v_total_remitted >= coalesce(v_net_due, 0) then 'paid'
           when v_total_remitted > 0 then 'partial'
           else 'outstanding'
         end
   where id = p_cap_id;

  return v_remittance_id;
end;
$$;

-- Callable by the app (authenticated). security definer bypasses RLS internally.
grant execute on function public.bind_new_business(bigint)                                   to authenticated;
grant execute on function public.bind_renewal(bigint)                                        to authenticated;
grant execute on function public.seed_renewals(integer)                                      to authenticated;
grant execute on function public.generate_invoice(bigint)                                    to authenticated;
grant execute on function public.record_ar_payment(bigint, decimal, date, varchar, varchar, text, varchar) to authenticated;
grant execute on function public.record_cap_remittance(bigint, decimal, date)                to authenticated;
