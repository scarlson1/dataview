-- The AGD aging report links each row to the AR detail page (/accounts_receivable/$id),
-- which looks up by the numeric primary key. The accounts_receivable_aging view
-- only exposed ar_ref, so surface the AR id as well. Drop+create because adding
-- a leading column isn't allowed by create-or-replace (which only appends).

drop view if exists public.accounts_receivable_aging;

create view public.accounts_receivable_aging
  with (security_invoker = true) as
select
  ar.id,
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
