-- Accounts receivable (AR): one record per invoice, tracking collection.
-- Payments are normalized into accounts_receivable_payments (see design note in
-- docs/TABLE_IMPLEMENTATION_NOTES.md) rather than 4 denormalized slots.

create table public.accounts_receivable (
  -- identity
  id               bigint       generated always as identity primary key,
  -- string cast of id for clients that can't cast bigint in a query (e.g. supabase-js)
  id_str           text         generated always as (id::text) stored,
  inv_id           bigint       not null unique references public.invoices (id),  -- one AR per invoice
  -- human-readable reference id (e.g. AR-2026-0001); see agencies migration for rationale.
  ref_year         smallint     not null default extract(year from now())::smallint,
  ar_ref           varchar(24)  generated always as ('AR-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,
  policy_id           bigint       not null references public.policies (id),
  client_id           bigint       not null references public.clients (id),
  agent_id           bigint       not null references public.agencies (id),

  -- invoice amounts
  invoice_date     date         not null,
  due_date         date         not null,
  invoice_total    decimal(14,2) not null,   -- total amount billed to client

  -- status & adjustments
  ar_status        varchar(20)  not null default 'outstanding'
                      check (ar_status in ('outstanding','partial','paid','overdue','written_off')),
  write_off_amt    decimal(14,2) default 0.00,   -- bad-debt write-off
  collection_notes text,

  -- audit
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);

create index accounts_receivable_inv_id_idx    on public.accounts_receivable (inv_id);
create index accounts_receivable_policy_id_idx    on public.accounts_receivable (policy_id);
create index accounts_receivable_client_id_idx    on public.accounts_receivable (client_id);
create index accounts_receivable_agent_id_idx    on public.accounts_receivable (agent_id);
create index accounts_receivable_invoice_date_idx on public.accounts_receivable (invoice_date);
create index accounts_receivable_due_date_idx  on public.accounts_receivable (due_date);
create index accounts_receivable_ar_status_idx on public.accounts_receivable (ar_status);

create trigger accounts_receivable_set_updated_at
  before update on public.accounts_receivable
  for each row execute function public.set_updated_at();

-- Child table: individual payments against an AR record (replaces pmt1..pmt4).
-- Supports unlimited payments; AR summary columns aggregate from this table.
create table public.accounts_receivable_payments (
  id               bigint       generated always as identity primary key,
  -- string cast of id for clients that can't cast bigint in a query (e.g. supabase-js)
  id_str           text         generated always as (id::text) stored,
  ar_id            bigint       not null references public.accounts_receivable (id) on delete cascade,
  -- human-readable reference id (e.g. ARPM-2026-0001); see agencies migration for rationale.
  ref_year         smallint     not null default extract(year from now())::smallint,
  arpm_ref         varchar(24)  generated always as ('ARPM-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,
  payment_date     date         not null,
  payment_amount   decimal(14,2) not null check (payment_amount > 0),
  payment_method   varchar(20)  check (payment_method in ('ach','check','wire','credit_card','other')),
  reference_number varchar(50),             -- check #, ACH trace, wire ref, etc.
  notes            text,
  created_at       timestamptz  not null default now(),
  created_by       varchar(100)             -- user or system that recorded the payment
);

create index accounts_receivable_payments_ar_id_idx        on public.accounts_receivable_payments (ar_id);
create index accounts_receivable_payments_payment_date_idx  on public.accounts_receivable_payments (payment_date);
create index accounts_receivable_payments_reference_number_idx on public.accounts_receivable_payments (reference_number);

-- Computed balances as a view (security_invoker = true so it respects caller RLS):
--   total_paid        = SUM of child payment amounts
--   last_payment_date = MAX of child payment dates
--   balance_due       = invoice_total - total_paid - write_off_amt
--   days_outstanding  = current_date - due_date  (negative = not yet due)
create view public.accounts_receivable_computed
  with (security_invoker = true) as
select ar.*,
  coalesce(p.total_paid, 0)                                          as total_paid,
  ar.invoice_total - coalesce(p.total_paid, 0) - coalesce(ar.write_off_amt, 0) as balance_due,
  (current_date - ar.due_date)                                      as days_outstanding,
  p.last_payment_date
from public.accounts_receivable ar
left join (
  select ar_id,
         sum(payment_amount) as total_paid,
         max(payment_date)   as last_payment_date
  from public.accounts_receivable_payments
  group by ar_id
) p on p.ar_id = ar.id;

-- Row Level Security
alter table public.accounts_receivable          enable row level security;
alter table public.accounts_receivable_payments enable row level security;

-- NOTE: RLS enabled with NO policies on either table -> service_role only until
-- you add policies. Example (repeat per table):
--
-- create policy "authenticated read"  on public.accounts_receivable
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.accounts_receivable
--   for all    to authenticated using (true) with check (true);

-- Now that accounts_receivable exists, activate the invoices back-reference FK.
-- invoices.ar_id is nullable, so a normal (non-deferrable) FK is sufficient:
-- create invoice -> create AR (inv_id) -> set invoice.ar_id.
alter table public.invoices
  add constraint invoices_ar_id_fkey
  foreign key (ar_id) references public.accounts_receivable (id);
