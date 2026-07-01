-- Claims: losses reported against a policy (POL).

create table public.claims (
  -- identity
  id            bigint       generated always as identity primary key,
  policy_id        bigint       not null references public.policies (id),
  client_id        bigint       not null references public.clients (id),
  carrier_id        bigint       not null references public.carriers (id),

  -- claim details
  date_of_loss  date         not null,
  date_reported date         not null,
  loss_type     varchar(50),             -- e.g. Property Damage, Bodily Injury, GL
  description   text,
  reserve_amt   decimal(14,2) default 0.00,   -- current reserve amount
  paid_amt      decimal(14,2) default 0.00,   -- total payments made to date
  adjuster      varchar(100),
  status        varchar(20)  not null default 'open'
                   check (status in ('open','closed','reopened','denied')),

  -- audit
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

-- indexes (Indexed = YES in spec; PK already covers id)
create index claims_policy_id_idx        on public.claims (policy_id);
create index claims_client_id_idx        on public.claims (client_id);
create index claims_carrier_id_idx        on public.claims (carrier_id);
create index claims_date_of_loss_idx  on public.claims (date_of_loss);
create index claims_date_reported_idx on public.claims (date_reported);
create index claims_loss_type_idx     on public.claims (loss_type);
create index claims_status_idx        on public.claims (status);

-- updated_at maintenance; reuses public.set_updated_at() from the agencies migration
create trigger claims_set_updated_at
  before update on public.claims
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.claims enable row level security;

-- NOTE: RLS enabled with NO policies -> service_role only until you add policies:
--
-- create policy "authenticated read"  on public.claims
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.claims
--   for all    to authenticated using (true) with check (true);
