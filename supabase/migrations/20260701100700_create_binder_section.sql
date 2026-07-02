-- Binder sections: a section of a binder (BDR), with the MGA's participation.

create table public.binder_section (
  -- identity
  id                   bigint       generated always as identity primary key,
  -- string cast of id for clients that can't cast bigint in a query (e.g. supabase-js)
  id_str               text         generated always as (id::text) stored,
  binder_id               bigint       not null references public.binder (id),
  -- human-readable reference id (e.g. SECT-2026-0001); see agencies migration for rationale.
  ref_year             smallint     not null default extract(year from now())::smallint,
  sect_ref             varchar(24)  generated always as ('SECT-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,

  -- section details
  section_number       varchar(20)  not null,   -- e.g. A, B, 1, 2
  section_display_name varchar(100),            -- e.g. General Liability, Property
  section_limit        decimal(16,2),           -- aggregate limit for this section
  section_attachment   decimal(16,2),           -- XOL attachment point if applicable
  lob_codes            varchar(100),            -- comma-separated LOB codes
  participation_pct    decimal(10,5) not null,  -- MGA's total participation
  -- same-row computed -> stored generated column is valid here
  participation_amt    decimal(16,2) generated always as (section_limit * participation_pct) stored,

  status               varchar(20)  not null default 'active'
                          check (status in ('active','inactive')),

  -- audit
  notes                text,
  created_at           timestamptz  not null default now()
);

-- indexes (Indexed = YES in spec; PK already covers id)
create index binder_section_binder_id_idx on public.binder_section (binder_id);
create index binder_section_status_idx on public.binder_section (status);

-- Row Level Security
alter table public.binder_section enable row level security;

-- NOTE: RLS enabled with NO policies -> service_role only until you add policies:
--
-- create policy "authenticated read"  on public.binder_section
--   for select to authenticated using (true);
-- create policy "authenticated write" on public.binder_section
--   for all    to authenticated using (true) with check (true);
