-- ============================================================================
-- SL Licensee resolution test suite (pgTAP)
--
-- Covers policies_computed.sl_licensee_name / sl_eligible_licensees as fixed in
--   20260706120000_fix_sl_licensee_resolution.sql
-- to match the SingleSource workbook's POL!AE / POL!AF formulas:
--   * resolution matches licenses on the BILLING GROUP (agencies.billing_id,
--     a one-hop parent roll-up), not the raw producing agent_id;
--   * an SL Licensee Override returns that agency's name DIRECTLY, no license
--     lookup required;
--   * only License Type = 'Surplus Lines' qualifies;
--   * eligible count is ACTIVE 'Surplus Lines' licenses in the billing group.
--
-- Self-contained: builds its own agencies/licenses/clients/policies fixtures,
-- asserts, and rolls everything back. Run with `supabase test db` or tests/run.sh.
-- ============================================================================
begin;

create extension if not exists pgtap;

select plan(8);

-- Fixture ids captured here so assertions can reference them by name.
create temp table ids (name text primary key, id bigint) on commit drop;

do $$
declare
  v_parent   bigint;  -- wholesale, holds the Default SL license (billing self)
  v_child    bigint;  -- retail, bills to parent -> shares parent's billing group
  v_lone     bigint;  -- retail, billing self, only a NON-SL default license
  v_override bigint;  -- agency named via override, holds NO license at all
  v_client   bigint;
begin
  insert into public.agencies (parent_id, agency_level, licensee_type, billing_entity, entity_name)
    values (null, 'wholesale', 'entity', 'self', 'ParentCo') returning id into v_parent;
  insert into public.agencies (parent_id, agency_level, licensee_type, billing_entity, entity_name)
    values (v_parent, 'retail', 'entity', 'parent', 'ChildCo') returning id into v_child;
  insert into public.agencies (parent_id, agency_level, licensee_type, billing_entity, entity_name)
    values (null, 'retail', 'entity', 'self', 'LoneCo') returning id into v_lone;
  insert into public.agencies (parent_id, agency_level, licensee_type, billing_entity, entity_name)
    values (null, 'sub-producer', 'entity', 'self', 'Override Co') returning id into v_override;

  -- Licenses ------------------------------------------------------------------
  -- Parent: the Default SL licensee for CA (active). Resolves for parent + child.
  insert into public.license (agent_id, license_type, state, license_number, eff_date, exp_date, default_sl_licensee)
    values (v_parent, 'Surplus Lines', 'CA', 'CA-SL-P', date '2025-01-01', date '2030-12-31', true);
  -- Child: a second ACTIVE SL license (non-default) in the same billing group -> counts toward eligible.
  insert into public.license (agent_id, license_type, state, license_number, eff_date, exp_date, default_sl_licensee)
    values (v_child, 'Surplus Lines', 'CA', 'CA-SL-C', date '2025-01-01', date '2030-12-31', false);
  -- Child: an EXPIRED SL license -> excluded from eligible count.
  insert into public.license (agent_id, license_type, state, license_number, eff_date, exp_date, default_sl_licensee)
    values (v_child, 'Surplus Lines', 'CA', 'CA-SL-X', date '2019-01-01', date '2020-12-31', false);
  -- Lone: a DEFAULT license, but License Type is NOT 'Surplus Lines' -> must be excluded.
  insert into public.license (agent_id, license_type, state, license_number, eff_date, exp_date, default_sl_licensee)
    values (v_lone, 'Resident P&C', 'CA', 'CA-PC-L', date '2025-01-01', date '2030-12-31', true);

  insert into public.clients (company_name, industry) values ('Test Insured', 'Manufacturing')
    returning id into v_client;

  -- Policies ------------------------------------------------------------------
  insert into public.policies (client_id, agent_id, transaction_type, line_of_business,
      policy_eff_date, policy_exp_date, txn_date, agency_com_pct, home_state)
    values (v_client, v_child, 'new_business', 'GL',
      date '2026-01-01', date '2027-01-01', date '2026-01-01', 0.10, 'CA')
    returning id into v_parent;  -- reuse var as scratch
  insert into ids values ('pol_rollup', v_parent);

  insert into public.policies (client_id, agent_id, transaction_type, line_of_business,
      policy_eff_date, policy_exp_date, txn_date, agency_com_pct, home_state)
    values (v_client, (select id from public.agencies where entity_name='ParentCo'), 'new_business', 'GL',
      date '2026-01-01', date '2027-01-01', date '2026-01-01', 0.10, 'CA')
    returning id into v_parent;
  insert into ids values ('pol_self', v_parent);

  insert into public.policies (client_id, agent_id, transaction_type, line_of_business,
      policy_eff_date, policy_exp_date, txn_date, agency_com_pct, home_state)
    values (v_client, v_lone, 'new_business', 'GL',
      date '2026-01-01', date '2027-01-01', date '2026-01-01', 0.10, 'CA')
    returning id into v_parent;
  insert into ids values ('pol_type_excluded', v_parent);

  insert into public.policies (client_id, agent_id, transaction_type, line_of_business,
      policy_eff_date, policy_exp_date, txn_date, agency_com_pct, home_state)
    values (v_client, v_child, 'new_business', 'GL',
      date '2026-01-01', date '2027-01-01', date '2026-01-01', 0.10, 'FL')
    returning id into v_parent;
  insert into ids values ('pol_nomatch', v_parent);

  insert into public.policies (client_id, agent_id, transaction_type, line_of_business,
      policy_eff_date, policy_exp_date, txn_date, agency_com_pct, home_state,
      sl_licensee_override_agent_id)
    values (v_client, v_child, 'new_business', 'GL',
      date '2026-01-01', date '2027-01-01', date '2026-01-01', 0.10, 'CA', v_override)
    returning id into v_parent;
  insert into ids values ('pol_override', v_parent);
end $$;

-- Helper: fetch a computed column for a named fixture policy.
create or replace function pg_temp.name_of(p text) returns text language sql stable as $$
  select sl_licensee_name from public.policies_computed
  where id = (select id from ids where name = p) $$;
create or replace function pg_temp.eligible_of(p text) returns bigint language sql stable as $$
  select sl_eligible_licensees from public.policies_computed
  where id = (select id from ids where name = p) $$;

-- ----------------------------------------------------------------------------
-- sl_licensee_name
-- ----------------------------------------------------------------------------
select is(pg_temp.name_of('pol_rollup'), 'ParentCo',
  'child policy resolves to the billing-parent SL licensee (one-hop roll-up)');

select is(pg_temp.name_of('pol_self'), 'ParentCo',
  'parent policy resolves to its own Default SL licensee (self billing group)');

select is(pg_temp.name_of('pol_type_excluded'), null,
  'a Default license that is not License Type = Surplus Lines does not resolve');

select is(pg_temp.name_of('pol_nomatch'), null,
  'no SL license for the Home State resolves to NULL');

select is(pg_temp.name_of('pol_override'), 'Override Co',
  'SL Licensee Override returns that agency name directly, no license lookup');

-- ----------------------------------------------------------------------------
-- sl_eligible_licensees
-- ----------------------------------------------------------------------------
select is(pg_temp.eligible_of('pol_rollup'), 2::bigint,
  'eligible count = active Surplus Lines licenses in billing group (2), expired excluded');

select is(pg_temp.eligible_of('pol_nomatch'), 0::bigint,
  'eligible count is 0 for a state with no SL licenses in the billing group');

select is(pg_temp.eligible_of('pol_type_excluded'), 0::bigint,
  'eligible count excludes non-Surplus-Lines licenses');

select * from finish();
rollback;
