-- Invoices: point-in-time snapshot of a POL at invoice time. One per AR record.

create table public.invoices (
  -- identity
  id                     bigint       generated always as identity primary key,
  policy_id                 bigint       not null references public.policies (id),
  -- human-readable reference id (e.g. INV-2026-0001); see agencies migration for rationale.
  ref_year               smallint     not null default extract(year from now())::smallint,
  inv_ref                varchar(24)  generated always as ('INV-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,
  ar_id                  bigint       unique,   -- FK -> public.accounts_receivable(id), added in AR migration.
                                                 -- Nullable (populated after the AR row is created) to break the
                                                 -- invoices<->AR circular FK; still one invoice per AR (unique).
  agent_id                 bigint       not null references public.agencies (id),   -- snapshot from POL

  -- invoice snapshot (stored at creation; preserves point-in-time record)
  transaction_type       varchar(20),
  invoice_date           date,                -- = POL accounting date = MAX(txn_date, txn_eff_date)
  due_date               date,                -- typically 30 days from invoice date
  policy_eff_date        date,
  policy_exp_date        date,
  txn_eff_date           date,
  txn_exp_date           date,
  annual_premium         decimal(14,2),
  term_premium           decimal(14,2),
  term_terrorism_premium decimal(14,2),
  total_term_premium     decimal(14,2),
  policy_fee             decimal(10,2),
  inspection_fee         decimal(10,2),
  other_fees             decimal(10,2),
  other_fee_description   varchar(200),
  total_term_prem_fees   decimal(14,2),
  mga_net_com_pct        decimal(7,5),
  mga_net_com_amt        decimal(14,2),

  -- manual fields
  invoice_status         varchar(20)  not null default 'outstanding'
                            check (invoice_status in ('outstanding','paid','voided','partial')),
  notes                  text,

  -- audit
  created_at             timestamptz  not null default now(),
  updated_at             timestamptz  not null default now()
);

-- indexes (Indexed = YES in spec; PK covers id, unique covers ar_id)
create index invoices_policy_id_idx         on public.invoices (policy_id);
create index invoices_agent_id_idx         on public.invoices (agent_id);
create index invoices_invoice_status_idx on public.invoices (invoice_status);

-- updated_at maintenance; reuses public.set_updated_at() from the agencies migration
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.invoices enable row level security;

-- NOTE: RLS enabled with NO policies -> service_role only until you add policies:
--
-- create policy "authenticated read"  on public.invoices
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.invoices
--   for all    to authenticated using (true) with check (true);

-- ============================================================================
-- NOTE: invoices.ar_id FK -> accounts_receivable is added in the AR migration.
-- ============================================================================
