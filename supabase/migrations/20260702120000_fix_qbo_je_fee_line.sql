-- Fix: the QBO commission journal entry did not balance. The cash debit uses
-- total_term_prem_fees (premium + policy/inspection/other fees) but the three
-- credit lines only allocate premium (MGA net + agency + carrier net). The fee
-- portion was collected as cash with no offsetting credit, leaving every JE out
-- of balance by the fee amount — QBO rejects unbalanced journal entries.
--
-- Add a 5th line crediting the fee residual (total_term_prem_fees minus premium)
-- to MGA fee income. Output columns are unchanged, so replace in place.

create or replace view public.qbo_je_commission
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
  ('Funds Held on Behalf of Carriers',  0::numeric, round(p.carrier_net_amt, 2)),
  ('MGA Fee Income',                    0::numeric, round(p.total_term_prem_fees - p.total_term_premium, 2))
) as line(account, debit, credit)
where line.debit <> 0 or line.credit <> 0;

grant select on public.qbo_je_commission to authenticated;
