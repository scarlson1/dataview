-- Fix SL Licensee resolution in policies_computed to match the SingleSource
-- workbook's POL!AE / POL!AF formulas (verified against SingleSource260630v81_5).
--
-- The prior implementation matched licenses on the raw producing agent_id, which
-- diverged from the workbook in three ways:
--   1. BILLING ROLL-UP. The workbook resolves the policy agent to its Billing
--      AGT-ID (AGT!J = billing_entity='parent' ? parent : self) and matches the
--      license HOLDER's Billing AGT-ID. That is exactly agencies.billing_id, a
--      one-hop parent roll-up. Matching raw agent_id missed licenses attributed
--      to the billing parent (the common MGA/wholesale-holds-the-SL-license case).
--   2. OVERRIDE. When SL Licensee Override (AD) is set, the workbook returns that
--      agency's name DIRECTLY (VLOOKUP into AGT), with no license lookup. The old
--      code required the override agent to also hold a matching default license,
--      else returned NULL.
--   3. LICENSE TYPE. The workbook filters License Type = 'Surplus Lines'; the old
--      code did not, so a non-SL default flag could resolve.
--
-- The entity-vs-individual rule (SL State Rules cols C/D) does NOT gate this
-- resolution in the workbook — it only feeds the advisory "Suggested Default"
-- helper on the LIC tab — so it is intentionally not applied here.
--
-- This is a column-preserving CREATE OR REPLACE (same names, types, order), so
-- the six dependent views are undisturbed.

create or replace view public.policies_computed
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
  (round(d.annual_premium * d.term_days / 365.0, 2) + coalesce(d.term_terrorism_premium,0)) * d.gross_com_pct               as gross_com_amt,
  (round(d.annual_premium * d.term_days / 365.0, 2) + coalesce(d.term_terrorism_premium,0)) * d.agency_com_pct              as agency_com_amt,
  (round(d.annual_premium * d.term_days / 365.0, 2) + coalesce(d.term_terrorism_premium,0)) * (d.gross_com_pct - d.agency_com_pct) as mga_net_com_amt,
  (round(d.annual_premium * d.term_days / 365.0, 2) + coalesce(d.term_terrorism_premium,0)) * (1 - d.gross_com_pct)         as carrier_net_amt,
  -- SL Licensee Name — mirrors POL!AE:
  --   override set  -> that agency's display_name directly (no license lookup)
  --   otherwise     -> Default SL "Surplus Lines" license whose HOLDER shares the
  --                    policy agent's billing group (agencies.billing_id), for Home State.
  case
    when d.sl_licensee_override_agent_id is not null then
      (select ao.display_name from public.agencies ao
        where ao.id = d.sl_licensee_override_agent_id)
    else
      (select h.display_name
         from public.license l
         join public.agencies h on h.id = l.agent_id
        where l.default_sl_licensee
          and l.license_type = 'Surplus Lines'
          and l.state = d.home_state
          and h.billing_id = (select pa.billing_id from public.agencies pa where pa.id = d.agent_id)
        limit 1)
  end                                                                  as sl_licensee_name,
  -- SL Eligible Licensees — mirrors POL!AF: count of ACTIVE "Surplus Lines"
  -- licenses in the policy agent's billing group for the Home State.
  (select count(*) from public.license l
     join public.agencies h on h.id = l.agent_id
    where l.license_type = 'Surplus Lines'
      and l.state = d.home_state
      and l.exp_date >= current_date
      and h.billing_id = (select pa.billing_id from public.agencies pa where pa.id = d.agent_id))
                                                                       as sl_eligible_licensees
from derived d;

grant select on public.policies_computed to authenticated;
