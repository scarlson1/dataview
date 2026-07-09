-- International address & phone support.
--   * Widen state/postal columns so non-US regions and postal codes fit.
--   * Add country to air_exposure (insured property location).
--   * Backfill existing rows to 'US' and normalize stored phones to E.164.
--
-- country columns already hold short ISO codes (e.g. 'US') and comfortably fit
-- the existing varchar(50/100), so they are not widened here.
--
-- state / postal are referenced by computed views, which must be dropped
-- before the column type can change and recreated afterwards.
-- air_exposure's zip_code is also renamed to postal for cross-table consistency.

drop view if exists public.agencies_with_status;
drop view if exists public.clients_computed;
drop view if exists public.air_exposure_computed;

-- Widen region / postal columns.
alter table public.agencies
  alter column state type varchar(100),
  alter column postal type varchar(20);

alter table public.carriers
  alter column state type varchar(100),
  alter column postal type varchar(20);

alter table public.clients
  alter column state type varchar(100),
  alter column postal type varchar(20);

-- air_exposure: add country, widen region, rename zip_code -> postal (widened).
alter table public.air_exposure
  add column if not exists country varchar(100),
  alter column state type varchar(100);

alter table public.air_exposure rename column zip_code to postal;
alter table public.air_exposure alter column postal type varchar(20);

-- Recreate the computed views (verbatim, plus air_exposure now exposes country
-- for parity with the other computed views).
create view public.agencies_with_status as
  select id, parent_id, billing_id, ref_year, agt_ref, agency_level,
    licensee_type, billing_entity, entity_name, first_name, last_name,
    display_name, phone, email, address_line1, address_line2, city, state,
    postal, country, do_policy_number, do_carrier, do_expiration_date, status,
    created_at, updated_at,
    case
      when do_expiration_date is null then null::text
      when do_expiration_date > current_date then 'active'::text
      else 'expired'::text
    end as do_status
  from public.agencies;

create view public.clients_computed as
  select id, created_at, ref_year, clt_ref, company_name, first_name, last_name,
    client_type, industry, status, phone, email, address_line1, address_line2,
    city, state, postal, country, updated_at,
    created_at::date as date_added
  from public.clients c;

create view public.air_exposure_computed as
  select e.id, e.policy_id, e.client_id, e.ref_year, e.air_ref,
    e.certificate_ref, e.location_id, e.location_name, e.street_address, e.city,
    e.state, e.postal, e.county, e.country, e.latitude, e.longitude,
    e.geocode_quality, e.number_of_buildings, e.occupancy_code,
    e.construction_code, e.building_id, e.year_built, e.num_storeys,
    e.gross_floor_area, e.primary_construction_class, e.roof_type, e.roof_shape,
    e.foundation_type, e.seismic_design_level, e.wind_speed_design,
    e.fire_protection_class, e.sprinkler, e.unit_ref, e.unit_floor_level,
    e.unit_gross_area, e.unit_occupancy_desc, e.building_replacement_value,
    e.contents_value, e.business_interruption_value, e.tiv, e.deductible_amount,
    e.deductible_type, e.policy_limit, e.status, e.notes, e.created_at,
    coalesce(eq.equipment_count, 0::bigint) as equipment_count,
    coalesce(eq.equipment_tiv, 0::numeric) as equipment_tiv,
    e.tiv + coalesce(eq.equipment_tiv, 0::numeric) as total_exposure_tiv
  from public.air_exposure e
    left join lateral (
      select count(*) as equipment_count,
        sum(a.total_ai_equipment_tiv) as equipment_tiv
      from public.air_equipment a
      where a.exposure_id = e.id
    ) eq on true;

grant select on public.agencies_with_status to authenticated;
grant select on public.clients_computed to authenticated;
grant select on public.air_exposure_computed to authenticated;

-- Backfill country so existing (US) records stay valid under the new required field.
update public.agencies     set country = 'US' where country is null or country = '';
update public.carriers     set country = 'US' where country is null or country = '';
update public.clients      set country = 'US' where country is null or country = '';
update public.air_exposure set country = 'US' where country is null or country = '';

-- Normalize existing 10-digit US phone numbers to E.164 (+1XXXXXXXXXX).
update public.agencies     set phone = '+1' || phone where phone ~ '^[0-9]{10}$';
update public.carriers     set phone = '+1' || phone where phone ~ '^[0-9]{10}$';
update public.carriers     set claims_phone = '+1' || claims_phone
  where claims_phone ~ '^[0-9]{10}$';
update public.clients      set phone = '+1' || phone where phone ~ '^[0-9]{10}$';
update public.underwriters set phone = '+1' || phone where phone ~ '^[0-9]{10}$';
