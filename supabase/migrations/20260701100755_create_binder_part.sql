-- Binder participants: each participant's share of a binder section (BDR_SECTION).

create table public.binder_part (
  -- identity
  id                      bigint       generated always as identity primary key,
  sect_id                 bigint       not null
                             references public.binder_section (id),
  -- human-readable reference id (e.g. PART-2026-0001); see agencies migration for rationale.
  ref_year                smallint     not null default extract(year from now())::smallint,
  part_ref                varchar(24)  generated always as ('PART-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,

  -- participant details
  participant_name        varchar(200) not null,   -- syndicate or co-insurer name
  participant_type        varchar(30)  not null
                             check (participant_type in ('lloyds_syndicate','insurer','mga','other')),
  syndicate_entity_number varchar(30),             -- Lloyd's syndicate # or NAIC/entity id
  participation_pct       decimal(10,5) not null,  -- this participant's share of the section
  -- participation_amt  (section_limit x participation_pct) and
  -- section_total_pct  (SUM of participation_pct per section) are cross-table/cross-row
  -- and cannot be stored generated columns; they are derived in the view below.

  -- audit
  status                  varchar(20)  not null default 'active'
                             check (status in ('active','inactive')),
  notes                   text,
  created_at              timestamptz  not null default now()
);

-- indexes (Indexed = YES in spec; PK already covers id)
create index binder_part_sect_id_idx          on public.binder_part (sect_id);
create index binder_part_participant_type_idx on public.binder_part (participant_type);
create index binder_part_syndicate_idx        on public.binder_part (syndicate_entity_number);
create index binder_part_status_idx           on public.binder_part (status);

-- Row Level Security
alter table public.binder_part enable row level security;

-- NOTE: RLS enabled with NO policies -> service_role only until you add policies:
--
-- create policy "authenticated read"  on public.binder_part
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.binder_part
--   for all    to authenticated using (true) with check (true);

-- Derived columns as a view: participation_amt needs binder_section.section_limit;
-- section_total_pct is a window sum of participation_pct within each section.
-- security_invoker = true so the view respects the caller's RLS.
create view public.binder_part_computed
  with (security_invoker = true) as
select bp.*,
  s.section_limit * bp.participation_pct                   as participation_amt,
  sum(bp.participation_pct) over (partition by bp.sect_id) as section_total_pct
from public.binder_part bp
join public.binder_section s on s.id = bp.sect_id;
