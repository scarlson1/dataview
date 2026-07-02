-- Budget targets: forward-looking GWP targets by line of business and month.
-- Pure budget input; the Proforma comparison (budget vs bound vs pipeline) is
-- computed in the /budget page from policies_computed + renewals_computed.

create table public.budget_targets (
  id               bigint       generated always as identity primary key,
  ref_year         smallint     not null default extract(year from now())::smallint,
  bud_ref          varchar(24)  generated always as ('BUD-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,

  year             smallint     not null,
  month            smallint     not null check (month between 1 and 12),
  line_of_business varchar(50)  not null,
  gwp_target       decimal(14,2) not null default 0,
  notes            text,
  created_at       timestamptz  not null default now(),

  unique (year, month, line_of_business)
);

create index budget_targets_year_idx on public.budget_targets (year);
create index budget_targets_lob_idx  on public.budget_targets (line_of_business);

alter table public.budget_targets enable row level security;

grant select, insert, update, delete on public.budget_targets to authenticated;

create policy "authenticated read"  on public.budget_targets
  for select to authenticated using (true);
create policy "authenticated write" on public.budget_targets
  for all    to authenticated using (true) with check (true);
