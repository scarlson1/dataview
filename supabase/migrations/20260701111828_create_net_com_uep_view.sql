-- net_com_uep: UEP / funded net-commission reserve report.
-- No data stored; all values derived from POL (policies) + INV (invoices) +
-- AR (accounts_receivable / _payments), as of a report_date.
--
-- The report_date parameter (DEFAULT CURRENT_DATE) needs a function (views can't
-- take parameters), so the logic lives in net_com_uep_asof(p_report_date); the
-- view net_com_uep is a convenience wrapper for "as of today".
--
-- Sourcing notes (assumptions to confirm):
--   * total_term_premium, mga_net_com_amt read from the INV snapshot (invoices),
--     not recomputed from POL (policies_computed is still deferred).
--   * status_as_of_rpt_date derived from report_date vs the policy term.
--   * Grain: one row per policy transaction; assumes <= 1 invoice per policy row
--     (multiple invoices per pol would multiply rows).

create or replace function public.net_com_uep_asof(p_report_date date default current_date)
returns table (
  policy_id                   bigint,
  report_date              date,
  client_id                   bigint,
  client_name              text,
  line_of_business         text,
  carrier_name             text,
  transaction_type         text,
  status_as_of_rpt_date    text,
  txn_eff_date             date,
  txn_exp_date             date,
  total_term_premium       numeric,
  min_earned_prem_pct      numeric,
  mga_net_com_amt          numeric,
  term_days                integer,
  days_elapsed             integer,
  pro_rata_elapsed_pct     numeric,
  pro_rata_uep_pct         numeric,
  mep_max_uep_pct          numeric,
  uep_pct_required         numeric,
  received_nep_pct         numeric,
  selected_net_com_uep_pct numeric,
  mga_net_com_uep_amt      numeric
)
language sql
stable
as $$
  with ar_received as (
    -- total AR receipts per policy, on or before the report date
    select ar.policy_id, sum(arp.payment_amount) as received
    from public.accounts_receivable ar
    join public.accounts_receivable_payments arp on arp.ar_id = ar.id
    where arp.payment_date <= p_report_date
    group by ar.policy_id
  ),
  base as (
    select
      p.id                                                             as policy_id,
      p.client_id,
      coalesce(cl.company_name,
               nullif(trim(coalesce(cl.first_name, '') || ' ' || coalesce(cl.last_name, '')), ''))
                                                                       as client_name,
      p.line_of_business::text,
      car.carrier_name::text,
      p.transaction_type::text,
      case
        when p_report_date < p.policy_eff_date then 'pending'
        when p_report_date > p.policy_exp_date then 'expired'
        else p.status
      end                                                              as status_as_of_rpt_date,
      p.txn_eff_date,
      p.txn_exp_date,
      inv.total_term_premium,
      p.min_earned_prem_pct,
      inv.mga_net_com_amt,
      (p.txn_exp_date - p.txn_eff_date)                                as term_days,
      coalesce(arr.received, 0)                                        as ar_received
    from public.policies p
    left join public.clients   cl  on cl.id  = p.client_id
    left join public.carriers  car on car.id = p.carrier_id
    left join public.invoices  inv on inv.policy_id = p.id
    left join ar_received      arr on arr.policy_id = p.id
  ),
  elapsed as (
    select b.*,
      least(greatest(p_report_date - b.txn_eff_date, 0), b.term_days) as days_elapsed
    from base b
  ),
  pcts as (
    select e.*,
      case when e.term_days > 0 then e.days_elapsed::numeric / e.term_days end       as pro_rata_elapsed_pct,
      case when e.term_days > 0 then 1 - (e.days_elapsed::numeric / e.term_days) end  as pro_rata_uep_pct,
      (1 - e.min_earned_prem_pct)                                                     as mep_max_uep_pct,
      case when e.mga_net_com_amt is not null and e.mga_net_com_amt <> 0
           then least(e.ar_received / e.mga_net_com_amt, 1.0) end                     as received_nep_pct
    from elapsed e
  ),
  req as (
    select pc.*,
      greatest(pc.pro_rata_uep_pct, pc.mep_max_uep_pct)                               as uep_pct_required
    from pcts pc
  )
  select
    r.policy_id,
    p_report_date                                                                    as report_date,
    r.client_id,
    r.client_name,
    r.line_of_business,
    r.carrier_name,
    r.transaction_type,
    r.status_as_of_rpt_date,
    r.txn_eff_date,
    r.txn_exp_date,
    r.total_term_premium,
    r.min_earned_prem_pct,
    r.mga_net_com_amt,
    r.term_days,
    r.days_elapsed,
    r.pro_rata_elapsed_pct,
    r.pro_rata_uep_pct,
    r.mep_max_uep_pct,
    r.uep_pct_required,
    r.received_nep_pct,
    least(r.uep_pct_required, r.received_nep_pct)                                     as selected_net_com_uep_pct,
    least(r.uep_pct_required, r.received_nep_pct) * r.total_term_premium              as mga_net_com_uep_amt
  from req r;
$$;

-- Convenience view: the report as of today.
create view public.net_com_uep
  with (security_invoker = true) as
  select * from public.net_com_uep_asof(current_date);
