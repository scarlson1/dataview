-- Reporting & export projections (read-only). These back the AGD aging report,
-- the Carrier Prem/Com report, the QBO CSV exports, and the Lloyd's bordereaux.
-- All are security_invoker views so they respect the caller's RLS.

-- ---------------------------------------------------------------------------
-- AGD — Aged receivables: bucket each open AR balance by due date vs today.
create view public.accounts_receivable_aging
  with (security_invoker = true) as
select
  ar.ar_ref,
  coalesce(c.company_name, trim(c.first_name || ' ' || c.last_name)) as client_name,
  ar.due_date,
  ar.invoice_total,
  ar.balance_due,
  ar.days_outstanding,
  ar.ar_status,
  case
    when ar.balance_due <= 0                     then 'paid'
    when ar.days_outstanding <= 0                then 'current'
    when ar.days_outstanding <= 30               then '1-30'
    when ar.days_outstanding <= 60               then '31-60'
    when ar.days_outstanding <= 90               then '61-90'
    else '90+'
  end as aging_bucket
from public.accounts_receivable_computed ar
left join public.clients c on c.id = ar.client_id;

grant select on public.accounts_receivable_aging to authenticated;

-- ---------------------------------------------------------------------------
-- Carrier Prem/Com report: single-carrier policy premium/commission by carrier,
-- combined (UNION) with each subscription participant's share of premium. Never
-- run a by-carrier total off POL's carrier_id alone for subscription policies.
create view public.carrier_prem_com_report
  with (security_invoker = true) as
with single_carrier as (
  select
    p.carrier_id,
    p.total_term_premium                                    as premium,
    p.gross_com_amt                                         as gross_com,
    p.mga_net_com_amt                                       as mga_net_com,
    p.carrier_net_amt                                       as carrier_net
  from public.policies_computed p
  where p.placement_type = 'single_carrier' and p.carrier_id is not null
),
subscription_share as (
  select
    sp.carrier_id,
    sp.participation_amt                                    as premium,
    sp.participation_amt * coalesce(p.gross_com_pct, 0)     as gross_com,
    sp.participation_amt * coalesce(p.mga_net_com_pct, 0)   as mga_net_com,
    sp.participation_amt * coalesce(p.carrier_net_pct, 0)   as carrier_net
  from public.subscription_participant_computed sp
  join public.policies_computed p on p.id = sp.policy_id
),
combined as (
  select * from single_carrier
  union all
  select * from subscription_share
)
select
  car.id                                as carrier_id,
  car.carrier_name,
  count(*)                              as transaction_count,
  round(sum(cb.premium), 2)             as total_premium,
  round(sum(cb.gross_com), 2)           as total_gross_com,
  round(sum(cb.mga_net_com), 2)         as total_mga_net_com,
  round(sum(cb.carrier_net), 2)         as total_carrier_net
from combined cb
join public.carriers car on car.id = cb.carrier_id
group by car.id, car.carrier_name;

grant select on public.carrier_prem_com_report to authenticated;

-- ---------------------------------------------------------------------------
-- QBO-AR: sales invoices (premium billed to the client/agency).
create view public.qbo_ar_invoices
  with (security_invoker = true) as
select
  i.inv_ref                                                as invoice_no,
  coalesce(c.company_name, trim(c.first_name || ' ' || c.last_name)) as customer,
  to_char(i.invoice_date, 'MM/DD/YYYY')                    as invoice_date,
  to_char(i.due_date, 'MM/DD/YYYY')                        as due_date,
  p.line_of_business || ' Premium'                         as item,
  1                                                        as item_quantity,
  i.total_term_prem_fees                                   as item_rate,
  i.total_term_prem_fees                                   as item_amount,
  'USD'                                                    as currency
from public.invoices i
join public.policies p on p.id = i.policy_id
left join public.clients c on c.id = p.client_id;

grant select on public.qbo_ar_invoices to authenticated;

-- ---------------------------------------------------------------------------
-- QBO-AP: carrier vendor bills (net premium payable, Funds Held liability).
create view public.qbo_ap_bills
  with (security_invoker = true) as
select
  cap.cap_ref                                              as bill_no,
  car.carrier_name                                         as vendor,
  to_char(current_date, 'MM/DD/YYYY')                      as bill_date,
  to_char(current_date + 30, 'MM/DD/YYYY')                 as due_date,
  'Funds Held on Behalf of Carriers'                       as line_account,
  cap.net_premium_due_carrier                              as line_amount,
  'USD'                                                    as currency
from public.capacity_computed cap
join public.carriers car on car.id = cap.carrier_id;

grant select on public.qbo_ap_bills to authenticated;

-- ---------------------------------------------------------------------------
-- QBO-JE: 4-line commission allocation journal entry per policy.
create view public.qbo_je_commission
  with (security_invoker = true) as
select
  p.pol_ref                                                as journal_no,
  to_char(p.accounting_date, 'MM/DD/YYYY')                 as journal_date,
  line.account,
  line.debit,
  line.credit
from public.policies_computed p
cross join lateral (values
  ('Cash - Premium Trust',              round(p.total_term_prem_fees, 2), 0::numeric),
  ('MGA Net Commission Income',         0::numeric, round(p.mga_net_com_amt, 2)),
  ('Agency Commission Payable',         0::numeric, round(p.agency_com_amt, 2)),
  ('Funds Held on Behalf of Carriers',  0::numeric, round(p.carrier_net_amt, 2))
) as line(account, debit, credit);

grant select on public.qbo_je_commission to authenticated;

-- ---------------------------------------------------------------------------
-- LLY-A: Lloyd's premium bordereau (core columns).
create view public.lly_a_premium
  with (security_invoker = true) as
select
  p.lloyds_umr                                             as umr,
  p.yoa                                                    as year_of_account,
  p.section_number                                         as section_no,
  p.line_of_business                                       as class_of_business,
  p.policy_number                                          as certificate_ref,
  to_char(p.policy_eff_date, 'MM/DD/YYYY')                 as risk_inception_date,
  to_char(p.policy_exp_date, 'MM/DD/YYYY')                 as risk_expiry_date,
  coalesce(c.company_name, trim(c.first_name || ' ' || c.last_name)) as insured_name,
  p.home_state                                             as risk_location_state,
  p.transaction_type,
  to_char(p.txn_eff_date, 'MM/DD/YYYY')                    as effective_date_of_transaction,
  p.total_term_premium                                     as gross_written_premium,
  p.gross_com_pct                                          as commission_pct,
  p.gross_com_amt                                          as commission_amount
from public.policies_computed p
left join public.clients c on c.id = p.client_id;

grant select on public.lly_a_premium to authenticated;

-- ---------------------------------------------------------------------------
-- LLY-B: Lloyd's claims bordereau (core columns).
create view public.lly_b_claims
  with (security_invoker = true) as
select
  p.lloyds_umr                                             as umr,
  p.yoa                                                    as year_of_account,
  p.policy_number                                          as certificate_ref,
  p.line_of_business                                       as class_of_business,
  coalesce(c.company_name, trim(c.first_name || ' ' || c.last_name)) as insured_name,
  cl.clm_ref                                               as claim_reference,
  cl.status                                                as claim_status,
  to_char(cl.date_of_loss, 'MM/DD/YYYY')                   as date_of_loss,
  to_char(cl.date_reported, 'MM/DD/YYYY')                  as date_reported,
  cl.loss_type                                             as cause_of_loss,
  cl.paid_amt                                              as paid_indemnity,
  cl.reserve_amt                                           as reserve_indemnity,
  (coalesce(cl.paid_amt,0) + coalesce(cl.reserve_amt,0))   as total_incurred
from public.claims cl
join public.policies_computed p on p.id = cl.policy_id
left join public.clients c on c.id = cl.client_id;

grant select on public.lly_b_claims to authenticated;
