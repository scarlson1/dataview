-- Payments: scheduled/received payments against a policy (POL).

create table public.payments (
  -- identity
  id             bigint       generated always as identity primary key,
  policy_id         bigint       not null references public.policies (id),
  client_id         bigint       not null references public.clients (id),
  -- human-readable reference id (e.g. PMT-2026-0001); see agencies migration for rationale.
  ref_year       smallint     not null default extract(year from now())::smallint,
  pmt_ref        varchar(24)  generated always as ('PMT-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,

  -- payment details
  due_date       date         not null,
  payment_date   date,
  amount_due     decimal(14,2) not null,
  amount_paid    decimal(14,2) default 0.00,
  -- same-row computed -> stored generated column
  balance        decimal(14,2) generated always as (amount_due - amount_paid) stored,
  payment_method varchar(20)  check (payment_method in ('ach','check','wire','credit_card','other')),
  invoice_number varchar(50),             -- cross-reference to INV (not a FK)
  status         varchar(20)  not null default 'outstanding'
                    check (status in ('outstanding','partial','paid','overdue','waived')),

  -- audit
  created_at     timestamptz  not null default now()
);

-- indexes (Indexed = YES in spec; PK already covers id)
create index payments_policy_id_idx         on public.payments (policy_id);
create index payments_client_id_idx         on public.payments (client_id);
create index payments_due_date_idx       on public.payments (due_date);
create index payments_payment_date_idx   on public.payments (payment_date);
create index payments_invoice_number_idx on public.payments (invoice_number);
create index payments_status_idx         on public.payments (status);

-- Row Level Security
alter table public.payments enable row level security;

-- NOTE: RLS enabled with NO policies -> service_role only until you add policies:
--
-- create policy "authenticated read"  on public.payments
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.payments
--   for all    to authenticated using (true) with check (true);
