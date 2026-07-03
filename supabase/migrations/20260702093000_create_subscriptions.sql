-- Subscriptions: multi-carrier co-insurance (quota share) for a single policy.
-- Distinct from binder syndicate participation (BDR Part%): this covers separate
-- COMPANIES co-insuring one policy. Market Lead Carrier (who set the placement's
-- terms) is tracked separately from each carrier's role within our own group.

create table public.subscription (
  id             bigint       generated always as identity primary key,
  policy_id      bigint       not null references public.policies (id),
  ref_year       smallint     not null default extract(year from now())::smallint,
  subs_ref       varchar(24)  generated always as ('SUBS-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,

  basis_of_participation varchar(30) not null default 'quota_share'
                    check (basis_of_participation in ('quota_share')),
  market_lead_carrier    varchar(200),   -- who set terms for the whole placement (may not be a participant)
  several_liability_disclaimer text not null default
    'Each carrier is liable only for its own share — not for the share of any other participant.',
  notes          text,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now()
);

create index subscription_policy_id_idx on public.subscription (policy_id);

create trigger subscription_set_updated_at
  before update on public.subscription
  for each row execute function public.set_updated_at();

create table public.subscription_participant (
  id                bigint       generated always as identity primary key,
  subscription_id   bigint       not null references public.subscription (id) on delete cascade,
  carrier_id        bigint       not null references public.carriers (id),
  ref_year          smallint     not null default extract(year from now())::smallint,
  subp_ref          varchar(24)  generated always as ('SUBP-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,

  role              varchar(20)  not null default 'following'
                       check (role in ('lead', 'following', 'na')),
  participation_pct decimal(10,5) not null,   -- share of the placement (0.25 = 25%)
  status            varchar(20)  not null default 'active'
                       check (status in ('active', 'inactive')),
  notes             text,
  created_at        timestamptz  not null default now()
);

create index subscription_participant_subscription_id_idx
  on public.subscription_participant (subscription_id);
create index subscription_participant_carrier_id_idx
  on public.subscription_participant (carrier_id);

-- Deferred FK from policies.subscription_id (table existed before subscription).
alter table public.policies
  add constraint policies_subscription_id_fkey
  foreign key (subscription_id) references public.subscription (id);

-- Per-participant participation $ (pct x policy total term premium) + the running
-- subscription total % for the balance check (must reach 100.00000%).
create view public.subscription_participant_computed
  with (security_invoker = true) as
select sp.*,
  c.carrier_name,
  s.policy_id,
  pc.total_term_premium * sp.participation_pct                          as participation_amt,
  sum(sp.participation_pct) over (partition by sp.subscription_id)      as subscription_total_pct
from public.subscription_participant sp
join public.subscription s on s.id = sp.subscription_id
join public.carriers c     on c.id = sp.carrier_id
left join public.policies_computed pc on pc.id = s.policy_id;

-- create_subscription: header + participant rows in one atomic call, and flags
-- the policy as a subscription placement. p_participants is a JSON array of
-- {carrier_id, role, participation_pct, notes}.
create or replace function public.create_subscription(
  p_policy_id           bigint,
  p_market_lead_carrier varchar,
  p_participants        jsonb,
  p_notes               text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id bigint;
  item   jsonb;
begin
  if not exists (select 1 from public.policies where id = p_policy_id) then
    raise exception 'Policy % not found', p_policy_id;
  end if;

  insert into public.subscription (policy_id, market_lead_carrier, notes)
  values (p_policy_id, p_market_lead_carrier, p_notes)
  returning id into new_id;

  for item in select * from jsonb_array_elements(coalesce(p_participants, '[]'::jsonb))
  loop
    insert into public.subscription_participant
      (subscription_id, carrier_id, role, participation_pct, notes)
    values (
      new_id,
      (item->>'carrier_id')::bigint,
      coalesce(item->>'role', 'following'),
      (item->>'participation_pct')::decimal,
      item->>'notes'
    );
  end loop;

  update public.policies
    set placement_type = 'subscription', subscription_id = new_id
    where id = p_policy_id;

  return new_id;
end;
$$;

-- RLS + grants (single-tenant permissive, matching the rest of the schema).
alter table public.subscription enable row level security;
alter table public.subscription_participant enable row level security;

grant select, insert, update, delete on public.subscription             to authenticated;
grant select, insert, update, delete on public.subscription_participant to authenticated;
grant select on public.subscription_participant_computed to authenticated;
grant execute on function public.create_subscription(bigint, varchar, jsonb, text) to authenticated;

-- REMOVE IN FAVOR OF RBAC IMPLEMENTATION
-- create policy "authenticated read"  on public.subscription
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.subscription
--   for all    to authenticated using (true) with check (true);
-- create policy "authenticated read"  on public.subscription_participant
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.subscription_participant
--   for all    to authenticated using (true) with check (true);
