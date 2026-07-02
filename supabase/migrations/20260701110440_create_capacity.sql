-- Capacity (CAP): carrier remittance / fiduciary tracking per invoice.
-- Remittances are normalized into capacity_remittance (replaces remit1..remit4).
-- Live funding math lives in the capacity_computed view.

create table public.capacity (
  -- identity & relationships (all targets exist -> live FKs)
  id                      bigint       generated always as identity primary key,
  inv_id                  bigint       not null references public.invoices (id),
  -- human-readable reference id (e.g. CAP-2026-0001); see agencies migration for rationale.
  ref_year                smallint     not null default extract(year from now())::smallint,
  cap_ref                 varchar(24)  generated always as ('CAP-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,
  ar_id                   bigint       not null references public.accounts_receivable (id),
  policy_id                  bigint       not null references public.policies (id),
  carrier_id                  bigint       not null references public.carriers (id),
  client_id                  bigint       not null references public.clients (id),

  -- snapshot from POL / INV at CAP creation (point-in-time, stored)
  term_premium            decimal(14,2),          -- from INV snapshot
  commission_pct          decimal(7,5),           -- gross_com_pct from POL
  -- derived from the same-row snapshots -> stored generated columns
  gross_commission_amt    decimal(14,2) generated always as (term_premium * commission_pct) stored,
  net_premium_due_carrier decimal(14,2) generated always as (term_premium - term_premium * commission_pct) stored,
  -- Live/AR-driven figures (ar_total_collected, ar_balance_still_due,
  -- previously_paid_carrier, available_for_payment, funding_status, funding_pct,
  -- total_remitted, balance_owing) are in the capacity_computed view below.

  -- status & audit
  ap_status               varchar(20)  not null default 'outstanding'
                             check (ap_status in ('outstanding','partial','paid')),
  notes                   text,
  created_at              timestamptz  not null default now(),
  updated_at              timestamptz  not null default now()
);

-- indexes (Indexed = YES in spec; PK covers id)
create index capacity_inv_id_idx    on public.capacity (inv_id);
create index capacity_ar_id_idx     on public.capacity (ar_id);
create index capacity_policy_id_idx    on public.capacity (policy_id);
create index capacity_carrier_id_idx    on public.capacity (carrier_id);
create index capacity_client_id_idx    on public.capacity (client_id);
create index capacity_ap_status_idx on public.capacity (ap_status);
-- NOTE: funding_status is marked Indexed in the spec but it's a computed (view)
-- column; index it on the base source or use a materialized view if needed.

-- updated_at maintenance; reuses public.set_updated_at() from the agencies migration
create trigger capacity_set_updated_at
  before update on public.capacity
  for each row execute function public.set_updated_at();

-- Child table: individual carrier remittances (replaces remit1..remit4 slots).
create table public.capacity_remittance (
  id           bigint       generated always as identity primary key,
  cap_id       bigint       not null references public.capacity (id) on delete cascade,
  -- human-readable reference id (e.g. CPRM-2026-0001); see agencies migration for rationale.
  ref_year     smallint     not null default extract(year from now())::smallint,
  cprm_ref     varchar(24)  generated always as ('CPRM-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,
  remit_date   date         not null,
  remit_amount decimal(14,2) not null,
  created_at   timestamptz  not null default now()
);

create index capacity_remittance_cap_id_idx on public.capacity_remittance (cap_id);

-- Live funding math as a view (security_invoker = true so it respects caller RLS).
-- carrier_net_pct is derived locally as (1 - commission_pct) from the CAP snapshot.
-- NOTE (assumption): funding_status CASE logic below is an interpretation of
-- "balance_owing vs available_for_payment" — confirm the intended thresholds.
create view public.capacity_computed
  with (security_invoker = true) as
with remit as (
  select cap_id, sum(remit_amount) as total_remitted
  from public.capacity_remittance
  group by cap_id
),
ar_coll as (
  select ar_id, sum(payment_amount) as ar_total_collected
  from public.accounts_receivable_payments
  group by ar_id
)
select c.*,
  coalesce(ac.ar_total_collected, 0)                                   as ar_total_collected,
  ar.invoice_total - coalesce(ac.ar_total_collected, 0)               as ar_balance_still_due,
  coalesce(r.total_remitted, 0)                                        as previously_paid_carrier,
  coalesce(r.total_remitted, 0)                                        as total_remitted,
  (coalesce(ac.ar_total_collected, 0) * (1 - coalesce(c.commission_pct, 0)))
    - coalesce(r.total_remitted, 0)                                    as available_for_payment,
  c.net_premium_due_carrier - coalesce(r.total_remitted, 0)           as balance_owing,
  case when c.net_premium_due_carrier is null or c.net_premium_due_carrier = 0 then null
       else coalesce(r.total_remitted, 0) / c.net_premium_due_carrier end as funding_pct,
  case
    when c.net_premium_due_carrier - coalesce(r.total_remitted, 0) <= 0 then 'paid'
    when (coalesce(ac.ar_total_collected, 0) * (1 - coalesce(c.commission_pct, 0)))
           - coalesce(r.total_remitted, 0) > 0                          then 'partially_funded'
    else 'awaiting_collection'
  end                                                                   as funding_status
from public.capacity c
join public.accounts_receivable ar on ar.id = c.ar_id
left join remit r    on r.cap_id = c.id
left join ar_coll ac on ac.ar_id = c.ar_id;

-- Row Level Security
alter table public.capacity            enable row level security;
alter table public.capacity_remittance enable row level security;

-- NOTE: RLS enabled with NO policies on either table -> service_role only until
-- you add policies (repeat per table):
--
-- create policy "authenticated read"  on public.capacity
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.capacity
--   for all    to authenticated using (true) with check (true);
