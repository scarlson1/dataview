-- Fix: the QBO carrier-bill export stamped bill_date = current_date and
-- due_date = current_date + 30 at query time, so every re-export re-dated the
-- bills to "today" and lost the real accounting date. A carrier bill for net
-- premium should be recognized when the premium was booked, i.e. the premium
-- invoice that spawned the CAP record.
--
-- Source the dates from the originating invoice (capacity.inv_id -> invoices):
--   bill_date = invoice_date (= POL accounting date), stable across re-exports
--   due_date  = invoice due_date, falling back to invoice_date + 30 when unset
-- Output columns are unchanged, so replace in place.

create or replace view public.qbo_ap_bills
  with (security_invoker = true) as
select
  cap.cap_ref                                              as bill_no,
  car.carrier_name                                         as vendor,
  to_char(i.invoice_date, 'MM/DD/YYYY')                    as bill_date,
  to_char(coalesce(i.due_date, i.invoice_date + 30), 'MM/DD/YYYY') as due_date,
  'Funds Held on Behalf of Carriers'                       as line_account,
  cap.net_premium_due_carrier                              as line_amount,
  'USD'                                                    as currency
from public.capacity_computed cap
join public.carriers car on car.id = cap.carrier_id
join public.invoices i on i.id = cap.inv_id;

grant select on public.qbo_ap_bills to authenticated;
