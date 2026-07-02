-- AIR catastrophe exposure modeling (ports the workbook "AIR - Exposure Modeling"
-- tab). Location-level US commercial property exposure for AIR Worldwide (Verisk)
-- cat modeling: location + building + unit detail and insured values (TIV), with
-- a nested AI/GPU equipment schedule (air_equipment) per exposure record.

-- ---------------------------------------------------------------------------
-- Parent: one row per insured location/building/unit, linked to a policy/client.
create table public.air_exposure (
  id                          bigint       generated always as identity primary key,
  policy_id                   bigint       references public.policies (id),
  client_id                   bigint       references public.clients (id),
  ref_year                    smallint     not null default extract(year from now())::smallint,
  air_ref                     varchar(24)  generated always as ('AIR-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,

  -- policy linkage
  certificate_ref             varchar(50),                 -- carrier certificate / policy number

  -- location detail
  location_id                 varchar(30),                 -- LOC-001, unique per site
  location_name               varchar(150),
  street_address              varchar(200),
  city                        varchar(100),
  state                       varchar(2),
  zip_code                    varchar(10),
  county                      varchar(100),
  latitude                    decimal(9,6),
  longitude                   decimal(9,6),
  geocode_quality             smallint     check (geocode_quality between 1 and 5),
  number_of_buildings         integer,

  -- AIR classification codes
  occupancy_code              varchar(10),                 -- AIR OCC code (e.g. 241)
  construction_code           varchar(10),                 -- AIR CCC (e.g. 3)

  -- building & unit detail
  building_id                 varchar(30),                 -- BLD-001, unique per bldg
  year_built                  smallint,
  num_storeys                 smallint,
  gross_floor_area            integer,                     -- sq ft
  primary_construction_class  varchar(60),
  roof_type                   varchar(60),
  roof_shape                  varchar(40),
  foundation_type             varchar(60),
  seismic_design_level        varchar(30),
  wind_speed_design           varchar(20),                 -- 'N/A' or mph, stored as text
  fire_protection_class       smallint     check (fire_protection_class between 1 and 10),
  sprinkler                   boolean      not null default false,
  unit_ref                    varchar(30),
  unit_floor_level            varchar(20),
  unit_gross_area             integer,
  unit_occupancy_desc         varchar(120),

  -- insured values (TIV)
  building_replacement_value  decimal(16,2) not null default 0,
  contents_value              decimal(16,2) not null default 0,
  business_interruption_value decimal(16,2) not null default 0,
  -- same-row generated: TIV = building + contents + BI (workbook AK)
  tiv                         decimal(16,2) generated always as
                                (building_replacement_value + contents_value + business_interruption_value) stored,
  deductible_amount           decimal(16,2),
  deductible_type             varchar(40),                 -- Straight, Percentage, ...
  policy_limit                decimal(16,2),

  status                      varchar(20)  not null default 'active'
                                check (status in ('active','inactive')),
  notes                       text,
  created_at                  timestamptz  not null default now()
);

create index air_exposure_policy_id_idx on public.air_exposure (policy_id);
create index air_exposure_client_id_idx on public.air_exposure (client_id);
create index air_exposure_state_idx     on public.air_exposure (state);

-- ---------------------------------------------------------------------------
-- Child: AI / GPU equipment schedule items for an exposure (1-to-many).
create table public.air_equipment (
  id                          bigint       generated always as identity primary key,
  exposure_id                 bigint       not null references public.air_exposure (id) on delete cascade,
  ref_year                    smallint     not null default extract(year from now())::smallint,
  eqp_ref                     varchar(24)  generated always as ('EQP-' || ref_year || '-' || lpad(id::text, 5, '0')) stored unique,

  equipment_category          varchar(60),                 -- 'AI / GPU Compute', ...
  gpu_manufacturer            varchar(60),                 -- NVIDIA / AMD / ...
  gpu_model                   varchar(80),                 -- H100 SXM5, ...
  gpu_count                   integer      not null default 0,
  gpu_unit_age                smallint,
  gpu_purchase_date           date,                        -- oldest in pool
  gpu_unit_replacement_cost   decimal(14,2) not null default 0,
  -- workbook AW = GPU count × unit cost
  total_gpu_value             decimal(16,2) generated always as
                                (gpu_count * gpu_unit_replacement_cost) stored,

  server_rack_count           integer      not null default 0,
  server_replacement_cost     decimal(14,2) not null default 0,
  -- workbook AZ = rack count × server cost
  total_server_value          decimal(16,2) generated always as
                                (server_rack_count * server_replacement_cost) stored,

  supporting_infra_value      decimal(16,2) not null default 0,   -- UPS / cooling
  -- workbook BB = GPU + server + supporting infra. References base cols only
  -- (generated columns can't reference other generated columns in Postgres).
  total_ai_equipment_tiv      decimal(16,2) generated always as
                                (gpu_count * gpu_unit_replacement_cost
                                 + server_rack_count * server_replacement_cost
                                 + supporting_infra_value) stored,

  power_draw_kw               integer,
  cooling_type                varchar(60),
  fire_suppression_system     varchar(60),
  notes                       text,
  created_at                  timestamptz  not null default now()
);

create index air_equipment_exposure_id_idx on public.air_equipment (exposure_id);

-- ---------------------------------------------------------------------------
-- Computed rollup: exposure with its equipment count and equipment TIV, plus a
-- combined property + equipment total. security_invoker so RLS is respected.
create view public.air_exposure_computed
  with (security_invoker = true) as
select
  e.*,
  coalesce(eq.equipment_count, 0)                         as equipment_count,
  coalesce(eq.equipment_tiv, 0)                           as equipment_tiv,
  e.tiv + coalesce(eq.equipment_tiv, 0)                   as total_exposure_tiv
from public.air_exposure e
left join lateral (
  select count(*) as equipment_count,
         sum(total_ai_equipment_tiv) as equipment_tiv
  from public.air_equipment a
  where a.exposure_id = e.id
) eq on true;

-- ---------------------------------------------------------------------------
-- RLS: authenticated read + write (matches the rest of the app).
alter table public.air_exposure  enable row level security;
alter table public.air_equipment enable row level security;

grant select, insert, update, delete on public.air_exposure  to authenticated;
grant select, insert, update, delete on public.air_equipment to authenticated;
grant select on public.air_exposure_computed to authenticated;

create policy "authenticated read"  on public.air_exposure
  for select to authenticated using (true);
create policy "authenticated write" on public.air_exposure
  for all    to authenticated using (true) with check (true);

create policy "authenticated read"  on public.air_equipment
  for select to authenticated using (true);
create policy "authenticated write" on public.air_equipment
  for all    to authenticated using (true) with check (true);
