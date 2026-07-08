-- ============================================================================
-- Seed data for local development.
--
-- Loaded automatically after migrations by `supabase db reset` (see the
-- [db.seed] section in config.toml). Also safe to run manually against the
-- local database:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed.sql
--
-- Everything runs in one DO block so generated-always identity IDs can be
-- captured into variables and used for cross-table foreign keys. A TRUNCATE at
-- the top makes the script idempotent (re-runnable without a full db reset).
-- ============================================================================

-- Local-only credential for the low-privilege `report_runner` role used by the
-- generate-report / run-report edge functions. The role is created WITHOUT a
-- password by migration 20260707100000_llm_reports.sql (the prod password is
-- set out-of-band and never committed); set the dev password here so it matches
-- REPORT_DB_URL in supabase/functions/.env. Without this, every schema-tool and
-- run_sql call in the agent loop fails auth and the report builder returns no
-- results and no candidate SQL.
alter role report_runner password 'report_runner_local';

truncate table
  public.air_equipment,
  public.air_exposure,
  public.budget_targets,
  public.subscription_participant,
  public.subscription,
  public.capacity_remittance,
  public.capacity,
  public.accounts_receivable_payments,
  public.accounts_receivable,
  public.invoices,
  public.payments,
  public.claims,
  public.renewals,
  public.new_business_submissions,
  public.policies,
  public.license,
  public.binder_part,
  public.binder_section,
  public.binder,
  public.underwriters,
  public.clients,
  public.carriers,
  public.agencies,
  public.surplus_lines_state_rules
restart identity cascade;

-- ============================================================================
-- Seed auth user for local development.
--
-- The app is auth-gated (email/password via supabase.auth.signInWithPassword)
-- and local email confirmations are disabled (config.toml: enable_confirmations
-- = false), so this pre-confirmed user can log straight in at
-- http://127.0.0.1:3000 and exercise the dashboard/reporting pages.
--
--   email:    dev@evertas.example
--   password: password123
--
-- The password is stored as a precomputed bcrypt hash literal (below) rather than
-- calling pgcrypto's crypt()/gen_salt() at seed time — that avoids depending on
-- the pgcrypto extension being on the search_path, which it isn't on the hosted
-- Supabase DB (pgcrypto lives in the `extensions` schema there). GoTrue verifies
-- the hash with its own bcrypt implementation, so no pgcrypto is needed here at
-- all. To rotate the password, regenerate the hash once (any bcrypt tool works,
-- e.g.):  htpasswd -bnBC 10 dev newpw | cut -d: -f2 | sed 's/^\$2y\$/\$2a\$/'
-- ($2y$ and $2a$ are byte-compatible for ASCII passwords; the substitution
-- just matches the prefix Postgres's own crypt-blowfish implementation
-- expects, in case it's ever used to verify the hash again.)
--
-- Idempotent: the user (and its cascading identity) is removed and recreated on
-- every run, matching the truncate-and-reseed pattern used for the app tables.
-- ============================================================================
delete from auth.users where email = 'dev@evertas.example';

do $$
declare
  v_user_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    'dev@evertas.example', '$2a$10$3PBJixUGmbM1wVPS4R.yjOysCebqgzy/scfMK7GfqPayVwuWT8s.y',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Dev User"}'::jsonb, false,
    '', '', '', ''
  );

  -- Matching identity row so signInWithPassword resolves the email provider.
  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  values (
    gen_random_uuid(), v_user_id, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', 'dev@evertas.example',
                       'email_verified', true),
    'email', now(), now(), now()
  );

  -- Give the dev user the admin role so we're not locked out once RBAC RLS is
  -- in force. Cascades away with the user on the next reseed (delete above).
  insert into public.user_roles (user_id, role) values (v_user_id, 'admin');
end $$;

do $$
declare
  -- agencies
  v_mga         bigint;
  v_wholesale   bigint;
  v_retail      bigint;
  v_subproducer bigint;

  -- underwriters
  v_uw_chen     bigint;
  v_uw_rod      bigint;
  v_uw_john     bigint;

  -- carriers
  v_car_nationwide bigint;
  v_car_lexington  bigint;
  v_car_lloyds     bigint;
  v_car_chubb      bigint;

  -- clients
  v_cli_acme    bigint;
  v_cli_bayside bigint;
  v_cli_smith   bigint;
  v_cli_chf     bigint;
  v_cli_techflow bigint;

  -- binders / sections
  v_bdr_gl      bigint;
  v_bdr_prop    bigint;
  v_sect_gl     bigint;
  v_sect_prop   bigint;

  -- policies
  v_pol_acme_gl   bigint;
  v_pol_bayside   bigint;
  v_pol_techflow  bigint;
  v_pol_acme_rnw  bigint;

  -- financial chain
  v_inv_acme    bigint;
  v_ar_acme     bigint;
  v_cap_acme    bigint;

  v_inv_bayside bigint;
  v_ar_bayside  bigint;

  -- subscriptions (multi-carrier co-insurance)
  v_subs_techflow bigint;

  -- AIR catastrophe exposures
  v_air_tf_dc   bigint;
  v_air_tf_edge bigint;
  v_air_acme    bigint;

  -- bulk reporting pools (captured from the rows seeded above so the high-volume
  -- block below can distribute FKs without capturing every generated id).
  v_client_ids   bigint[];
  v_agency_ids   bigint[];
  v_carrier_ids  bigint[];
  v_uw_ids       bigint[];
  v_bulk_pol_ids bigint[];
begin
  -- ==========================================================================
  -- Surplus lines state rules (state is the natural PK)
  -- ==========================================================================
  insert into public.surplus_lines_state_rules
    (state, state_full_name, entity_license_accepted, individual_license_required,
     stamping_office, source, last_verified)
  -- Flags mirror the SingleSource "SL State Rules" tab (Troutman manual):
  -- entity_license_accepted / individual_license_required. Most NAIC-model states
  -- accept an entity license (individual NOT required); NC & ND are the classic
  -- individual-required exceptions. These flags feed advisory helpers only — they
  -- do NOT gate SL Licensee resolution (see policies_computed).
  values
    ('CA', 'California',     true,  false, 'The Surplus Line Association of California', 'Troutman 2025', date '2026-01-15'),
    ('TX', 'Texas',          true,  false, 'Surplus Lines Stamping Office of Texas',    'Troutman 2025', date '2026-01-15'),
    ('NY', 'New York',       true,  false, 'Excess Line Association of New York',       'Troutman 2025', date '2026-01-15'),
    ('FL', 'Florida',        true,  false, 'Florida Surplus Lines Service Office',      'Troutman 2025', date '2026-01-15'),
    ('IL', 'Illinois',       true,  false, 'Surplus Line Association of Illinois',      'Troutman 2025', date '2026-01-15'),
    ('NC', 'North Carolina', false, true,  'NC Surplus Lines Association',              'Troutman 2025', date '2026-01-15'),
    ('ND', 'North Dakota',   false, true,  null,                                        'Troutman 2025', date '2026-01-15');

  -- ==========================================================================
  -- Agencies (MGA -> wholesale -> retail -> individual sub-producer)
  -- ==========================================================================
  insert into public.agencies
    (parent_id, agency_level, licensee_type, billing_entity, entity_name,
     phone, email, address_line1, city, state, postal, country,
     do_policy_number, do_carrier, do_expiration_date, status)
  values
    (null, 'mga', 'entity', 'self', 'Evertas Underwriting Managers',
     '312-555-0100', 'ops@evertas-mga.example', '120 N Wacker Dr', 'Chicago', 'IL', '60606', 'USA',
     'DO-EUM-2026', 'Hartford', date '2027-03-01', 'active')
  returning id into v_mga;

  insert into public.agencies
    (parent_id, agency_level, licensee_type, billing_entity, entity_name,
     phone, email, address_line1, city, state, postal, country, status)
  values
    (v_mga, 'wholesale', 'entity', 'self', 'Pacific Wholesale Brokers',
     '415-555-0110', 'submissions@pacificwholesale.example', '55 Market St', 'San Francisco', 'CA', '94103', 'USA', 'active')
  returning id into v_wholesale;

  insert into public.agencies
    (parent_id, agency_level, licensee_type, billing_entity, entity_name,
     phone, email, address_line1, city, state, postal, country, status)
  values
    (v_wholesale, 'retail', 'entity', 'parent', 'Main Street Insurance Agency',
     '214-555-0120', 'info@mainstreetins.example', '900 Elm St', 'Dallas', 'TX', '75201', 'USA', 'active')
  returning id into v_retail;

  insert into public.agencies
    (parent_id, agency_level, licensee_type, billing_entity, first_name, last_name,
     phone, email, address_line1, city, state, postal, country, status)
  values
    (v_retail, 'sub-producer', 'individual', 'parent', 'Jane', 'Doe',
     '212-555-0130', 'jane.doe@mainstreetins.example', '900 Elm St', 'New York', 'NY', '10001', 'USA', 'active')
  returning id into v_subproducer;

  -- Bulk independent retail agencies (pagination test data).
  insert into public.agencies
    (parent_id, agency_level, licensee_type, billing_entity, entity_name,
     phone, email, address_line1, city, state, postal, country, status)
  select
    null, 'retail', 'entity', 'self', 'Test Agency ' || lpad(g::text, 3, '0'),
    '555-' || lpad((4000 + g)::text, 4, '0'), 'agency' || g || '@example.com',
    g || ' Broker Blvd', 'Metropolis',
    (array['CA', 'TX', 'NY', 'FL', 'IL'])[1 + (g % 5)], '00000', 'USA',
    (array['active', 'inactive'])[1 + (g % 2)]
  from generate_series(1, 120) as g;

  -- ==========================================================================
  -- Underwriters
  -- ==========================================================================
  insert into public.underwriters (first_name, last_name, title_role, email, phone, status)
  values ('Sarah', 'Chen', 'Senior Underwriter', 'sarah.chen@evertas-mga.example', '312-555-0201', 'active')
  returning id into v_uw_chen;

  insert into public.underwriters (first_name, last_name, title_role, email, phone, status)
  values ('Michael', 'Rodriguez', 'UW Manager', 'michael.rodriguez@evertas-mga.example', '312-555-0202', 'active')
  returning id into v_uw_rod;

  insert into public.underwriters (first_name, last_name, title_role, email, phone, status)
  values ('Emily', 'Johnson', 'Underwriter', 'emily.johnson@evertas-mga.example', '312-555-0203', 'on_leave')
  returning id into v_uw_john;

  -- ==========================================================================
  -- Carriers
  -- ==========================================================================
  insert into public.carriers
    (carrier_name, naic_number, am_best_rating, lines_of_business, carrier_type,
     state_admitted, domicile_state, contact_name, phone, email, claims_phone,
     address_line1, city, state, postal, country, status)
  values
    ('Nationwide Mutual Insurance Company', '23787', 'A+', 'GL,Property,WC', 'admitted',
     'ALL', 'OH', 'Tom Baker', '800-555-0300', 'submissions@nationwide.example', '800-555-0399',
     'One Nationwide Plaza', 'Columbus', 'OH', '43215', 'USA', 'active')
  returning id into v_car_nationwide;

  insert into public.carriers
    (carrier_name, naic_number, am_best_rating, lines_of_business, carrier_type,
     state_admitted, domicile_state, contact_name, phone, email, claims_phone,
     address_line1, city, state, postal, country, status)
  values
    ('Lexington Insurance Company', '19437', 'A', 'GL,Excess,Cyber', 'E&S',
     'E&S', 'DE', 'Nina Patel', '800-555-0310', 'submissions@lexington.example', '800-555-0319',
     '100 Summer St', 'Boston', 'MA', '02110', 'USA', 'active')
  returning id into v_car_lexington;

  insert into public.carriers
    (carrier_name, naic_number, am_best_rating, lines_of_business, carrier_type,
     state_admitted, domicile_state, contact_name, phone, email, claims_phone,
     address_line1, city, state, postal, country, status)
  values
    ('Lloyd''s Syndicate 2003 (XYZ)', null, 'A', 'Property,Cyber,Marine', 'lloyds_syndicate',
     'E&S', null, 'James Whitfield', '+44-20-5550-0320', 'box@syndicate2003.example', '+44-20-5550-0329',
     'One Lime Street', 'London', null, 'EC3M', 'GBR', 'active')
  returning id into v_car_lloyds;

  insert into public.carriers
    (carrier_name, naic_number, am_best_rating, lines_of_business, carrier_type,
     state_admitted, domicile_state, contact_name, phone, email, claims_phone,
     address_line1, city, state, postal, country, status)
  values
    ('Chubb', '10052', 'A++', 'Property,GL,D&O', 'admitted',
     'ALL', 'NJ', 'Laura Kim', '800-555-0330', 'submissions@chubb.example', '800-555-0339',
     '202 Hall''s Mill Rd', 'Whitehouse Station', 'NJ', '08889', 'USA', 'active')
  returning id into v_car_chubb;

  -- Bulk carriers (pagination test data).
  insert into public.carriers
    (carrier_name, naic_number, am_best_rating, lines_of_business, carrier_type,
     state_admitted, domicile_state, contact_name, phone, email, claims_phone,
     address_line1, city, state, postal, country, status)
  select
    'Test Carrier ' || lpad(g::text, 3, '0'), null,
    (array['A++', 'A+', 'A', 'A-', 'B++'])[1 + (g % 5)], 'GL,Property',
    (array['admitted', 'E&S'])[1 + (g % 2)], 'ALL',
    (array['OH', 'DE', 'NJ', 'NY', 'CA'])[1 + (g % 5)], 'Contact ' || g,
    '800-555-' || lpad((5000 + g)::text, 4, '0'), 'carrier' || g || '@example.com',
    '800-555-' || lpad((6000 + g)::text, 4, '0'),
    g || ' Insurance Way', 'Metropolis',
    (array['OH', 'DE', 'NJ', 'NY', 'CA'])[1 + (g % 5)], '00000', 'USA',
    (array['active', 'inactive'])[1 + (g % 2)]
  from generate_series(1, 120) as g;

  -- ==========================================================================
  -- Clients
  -- ==========================================================================
  insert into public.clients
    (company_name, first_name, last_name, client_type, industry, status,
     phone, email, address_line1, city, state, postal, country)
  values ('Acme Manufacturing Inc', null, null, 'business', 'Manufacturing', 'active',
     '312-555-0400', 'ap@acme-mfg.example', '1400 Industrial Blvd', 'Chicago', 'IL', '60632', 'USA')
  returning id into v_cli_acme;

  insert into public.clients
    (company_name, first_name, last_name, client_type, industry, status,
     phone, email, address_line1, city, state, postal, country)
  values ('Bayside Restaurants LLC', null, null, 'business', 'Hospitality', 'active',
     '214-555-0410', 'finance@bayside.example', '78 Harbor Way', 'Dallas', 'TX', '75204', 'USA')
  returning id into v_cli_bayside;

  insert into public.clients
    (company_name, first_name, last_name, client_type, industry, status,
     phone, email, address_line1, city, state, postal, country)
  values (null, 'Robert', 'Smith', 'individual', 'Personal Lines', 'active',
     '212-555-0420', 'robert.smith@example.com', '15 Riverside Dr', 'New York', 'NY', '10023', 'USA')
  returning id into v_cli_smith;

  insert into public.clients
    (company_name, first_name, last_name, client_type, industry, status,
     phone, email, address_line1, city, state, postal, country)
  values ('Community Health Foundation', null, null, 'non_profit', 'Healthcare', 'prospect',
     '415-555-0430', 'admin@chf.example', '500 Wellness Ave', 'San Francisco', 'CA', '94110', 'USA')
  returning id into v_cli_chf;

  insert into public.clients
    (company_name, first_name, last_name, client_type, industry, status,
     phone, email, address_line1, city, state, postal, country)
  values ('TechFlow Solutions', null, null, 'business', 'Technology', 'active',
     '650-555-0440', 'ops@techflow.example', '2200 Mission College Blvd', 'Santa Clara', 'CA', '95054', 'USA')
  returning id into v_cli_techflow;

  -- Bulk clients (pagination test data).
  insert into public.clients
    (company_name, first_name, last_name, client_type, industry, status,
     phone, email, address_line1, city, state, postal, country)
  select
    'Test Client ' || lpad(g::text, 3, '0'), null, null,
    (array['business', 'individual', 'non_profit', 'government', 'other'])[1 + (g % 4)]::public.clienttype,
    (array['Manufacturing', 'Technology', 'Healthcare', 'Retail', 'Hospitality', 'Construction', 'Finance', 'Real Estate'])[1 + (g % 8)],
    (array['active', 'inactive', 'prospect'])[1 + (g % 3)]::public.clientstatus,
    '555-' || lpad((1000 + g)::text, 4, '0'), 'client' || g || '@example.com',
    g || ' Test Ave', 'Springfield',
    (array['CA', 'TX', 'NY', 'FL', 'IL'])[1 + (g % 5)], '00000', 'USA'
  from generate_series(1, 120) as g;

  -- ==========================================================================
  -- Binders + sections + participants
  -- ==========================================================================
  insert into public.binder
    (carrier_id, binder_number, yoa, eff_date, exp_date, gross_com_pct, notes)
  values (v_car_lexington, 'BDR-2026-001', 2026, date '2026-01-01', date '2026-12-31', 0.30000,
     'Primary GL binder, Lexington E&S.')
  returning id into v_bdr_gl;

  insert into public.binder
    (carrier_id, binder_number, yoa, eff_date, exp_date, gross_com_pct, notes)
  values (v_car_lloyds, 'BDR-2026-002', 2026, date '2026-01-01', date '2026-12-31', 0.32500,
     'Lloyd''s subscription property/cyber binder.')
  returning id into v_bdr_prop;

  insert into public.binder_section
    (binder_id, section_number, section_display_name, section_limit, section_attachment,
     lob_codes, participation_pct, status)
  values (v_bdr_gl, 'A', 'General Liability', 5000000.00, null, 'GL', 1.00000, 'active')
  returning id into v_sect_gl;

  insert into public.binder_section
    (binder_id, section_number, section_display_name, section_limit, section_attachment,
     lob_codes, participation_pct, status)
  values (v_bdr_prop, '1', 'Property / Cyber', 10000000.00, null, 'Property,Cyber', 0.75000, 'active')
  returning id into v_sect_prop;

  insert into public.binder_part
    (sect_id, participant_name, participant_type, syndicate_entity_number, participation_pct, status, notes)
  values
    (v_sect_gl, 'Lexington Insurance Company', 'insurer', '19437', 1.00000, 'active', 'Sole participant on GL section.'),
    (v_sect_prop, 'Lloyd''s Syndicate 2003 (XYZ)', 'lloyds_syndicate', '2003', 0.50000, 'active', 'Lead syndicate.'),
    (v_sect_prop, 'Lloyd''s Syndicate 1084 (CSL)', 'lloyds_syndicate', '1084', 0.25000, 'active', 'Following syndicate.');

  -- ==========================================================================
  -- Licenses. The wholesale broker (v_wholesale) is the surplus-lines licensee
  -- for its downstream retail producers, so the Default SL licenses sit on it.
  -- SL Licensee resolution matches on the billing group (agencies.billing_id):
  -- v_retail bills to v_wholesale, so retail-produced SL policies roll up to the
  -- wholesale's Default SL license (one-hop). The v_retail P&C row (non-"Surplus
  -- Lines") is intentionally excluded by the license_type filter.
  -- ==========================================================================
  insert into public.license
    (agent_id, license_type, state, license_number, eff_date, exp_date, default_sl_licensee, notes)
  values
    (v_wholesale, 'Surplus Lines', 'CA', 'CA-SL-778812', date '2025-01-01', date '2026-12-31', true,  'Resident SL license.'),
    (v_wholesale, 'Surplus Lines', 'TX', 'TX-SL-449021', date '2025-01-01', date '2026-12-31', true,  'Non-resident SL license.'),
    (v_wholesale, 'Surplus Lines', 'NY', 'NY-EL-330145', date '2025-01-01', date '2026-12-31', true,  'Excess line broker license.'),
    (v_retail, 'Resident P&C', 'TX', 'TX-PC-100233', date '2025-06-01', date '2027-05-31', false, 'Retail producer P&C.');

  -- ==========================================================================
  -- Policies
  -- ==========================================================================
  -- New business: Acme GL, single carrier under the Lexington GL binder.
  insert into public.policies
    (client_id, agent_id, carrier_id, binder_id, transaction_type, status, placement_type,
     line_of_business, policy_number, binder_number,
     policy_eff_date, policy_exp_date, txn_date, txn_eff_date, txn_exp_date,
     annual_premium, term_terrorism_premium, policy_fee, inspection_fee, other_fees,
     agency_com_pct, min_earned_prem_pct,
     cov_a_limit, deductible_amt, deductible_base,
     jurisdiction, home_state, assigned_to_uw_id, notes)
  values
    (v_cli_acme, v_retail, v_car_lexington, v_bdr_gl, 'new_business', 'active', 'single_carrier',
     'GL', 'GL-2026-000123', 'BDR-2026-001',
     date '2026-01-15', date '2027-01-15', date '2026-01-10', date '2026-01-15', date '2027-01-15',
     50000.00, 0.00, 250.00, 150.00, 0.00,
     0.15000, 0.25000,
     5000000.00, 10000.00, 'per occurrence',
     'California', 'CA', v_uw_chen, 'Bound new business.')
  returning id into v_pol_acme_gl;

  -- New business: Bayside property, admitted (Nationwide), no binder.
  insert into public.policies
    (client_id, agent_id, carrier_id, transaction_type, status, placement_type,
     line_of_business, policy_number,
     policy_eff_date, policy_exp_date, txn_date, txn_eff_date, txn_exp_date,
     annual_premium, policy_fee, inspection_fee,
     agency_com_pct, min_earned_prem_pct,
     cov_a_limit, deductible_amt, deductible_base,
     jurisdiction, home_state, assigned_to_uw_id, gross_com_pct_override, notes)
  values
    (v_cli_bayside, v_retail, v_car_nationwide, 'new_business', 'active', 'single_carrier',
     'Property', 'PR-2026-000456',
     date '2026-02-01', date '2027-02-01', date '2026-01-25', date '2026-02-01', date '2027-02-01',
     25000.00, 200.00, 0.00,
     0.12500, 0.25000,
     2000000.00, 5000.00, 'per occurrence',
     'Texas', 'TX', v_uw_rod, 0.20000, 'Admitted placement; gross commission overrides binder (none).')
  returning id into v_pol_bayside;

  -- New business: TechFlow cyber, Lloyd's subscription (no single carrier_id).
  insert into public.policies
    (client_id, agent_id, binder_id, transaction_type, status, placement_type,
     line_of_business, policy_number, binder_number,
     policy_eff_date, policy_exp_date, txn_date, txn_eff_date, txn_exp_date,
     annual_premium, policy_fee,
     agency_com_pct, min_earned_prem_pct,
     cov_a_limit, deductible_amt, deductible_base,
     jurisdiction, home_state, yoa, lloyds_umr, section_number, assigned_to_uw_id, notes)
  values
    (v_cli_techflow, v_wholesale, v_bdr_prop, 'new_business', 'active', 'subscription',
     'Cyber', 'CY-2026-000789', 'BDR-2026-002',
     date '2026-03-01', date '2027-03-01', date '2026-02-20', date '2026-03-01', date '2027-03-01',
     120000.00, 500.00,
     0.17500, 0.35000,
     10000000.00, 50000.00, 'per claim',
     'New York', 'NY', 2026, 'B1234ABCD26', '1', v_uw_chen, 'Lloyd''s subscription; NY home state SL filing.')
  returning id into v_pol_techflow;

  -- Renewal transaction of the Acme GL policy (points at parent via parent_policy_id).
  insert into public.policies
    (parent_policy_id, client_id, agent_id, carrier_id, binder_id, transaction_type, status, placement_type,
     line_of_business, policy_number, binder_number,
     policy_eff_date, policy_exp_date, txn_date, txn_eff_date, txn_exp_date,
     annual_premium, policy_fee, inspection_fee,
     agency_com_pct, min_earned_prem_pct,
     cov_a_limit, deductible_amt, deductible_base,
     jurisdiction, home_state, assigned_to_uw_id, notes)
  values
    (v_pol_acme_gl, v_cli_acme, v_retail, v_car_lexington, v_bdr_gl, 'renewal', 'pending', 'single_carrier',
     'GL', 'GL-2027-000123R', 'BDR-2026-001',
     date '2027-01-15', date '2028-01-15', date '2026-12-15', date '2027-01-15', date '2028-01-15',
     54000.00, 250.00, 150.00,
     0.15000, 0.25000,
     5000000.00, 10000.00, 'per occurrence',
     'California', 'CA', v_uw_chen, 'Renewal transaction of GL-2026-000123.')
  returning id into v_pol_acme_rnw;

  -- ==========================================================================
  -- New business submissions (pipeline)
  -- ==========================================================================
  insert into public.new_business_submissions
    (submission_number, policy_id, stage, priority, assigned_to, submission_date,
     quote_due_date, quote_received, bind_order_date, bound_date,
     client_id, agent_id, carrier_id, binder_id,
     line_of_business, policy_number, policy_eff_date, policy_exp_date,
     jurisdiction, home_state, annual_premium, agency_com_pct, notes)
  values
    ('SUB-2026-001', null, 'prospect', 'medium', v_uw_john, date '2026-06-05',
     date '2026-06-20', null, null, null,
     v_cli_chf, v_retail, null, null,
     'D&O', null, null, null,
     'California', 'CA', 40000.00, 0.15000, 'Non-profit D&O prospect; awaiting loss runs.'),
    ('SUB-2026-002', null, 'quoted', 'high', v_uw_chen, date '2026-05-10',
     date '2026-05-24', date '2026-05-22', null, null,
     v_cli_techflow, v_wholesale, v_car_lloyds, v_bdr_prop,
     'Cyber', null, date '2026-03-01', date '2027-03-01',
     'New York', 'NY', 120000.00, 0.17500, 'Quote issued; pending bind order.'),
    ('SUB-2026-003', v_pol_acme_gl, 'bound', 'high', v_uw_chen, date '2025-12-15',
     date '2025-12-29', date '2025-12-27', date '2026-01-08', date '2026-01-15',
     v_cli_acme, v_retail, v_car_lexington, v_bdr_gl,
     'GL', 'GL-2026-000123', date '2026-01-15', date '2027-01-15',
     'California', 'CA', 50000.00, 0.15000, 'Bound and transferred to policy.');

  -- ==========================================================================
  -- Renewals (renewal pipeline for the expiring Acme GL policy)
  -- ==========================================================================
  insert into public.renewals
    (policy_id, new_policy_id, renewal_status, assigned_to, txn_type,
     new_policy_number, new_policy_eff_date, new_policy_exp_date,
     annual_premium, agency_com_pct, min_earned_prem_pct,
     inspection_fee, other_fees, common_named_insured, notes)
  values
    (v_pol_acme_gl, v_pol_acme_rnw, 'in_progress', v_uw_rod, 'renewal',
     'GL-2027-000123R', date '2027-01-15', date '2028-01-15',
     54000.00, 0.15000, 0.25000,
     150.00, 0.00, 'Acme Manufacturing Inc', 'Renewal in progress at 8% rate increase.');

  -- ==========================================================================
  -- Claims
  -- ==========================================================================
  insert into public.claims
    (policy_id, client_id, carrier_id, date_of_loss, date_reported, loss_type,
     description, reserve_amt, paid_amt, adjuster, status)
  values
    (v_pol_acme_gl, v_cli_acme, v_car_lexington, date '2026-03-12', date '2026-03-15', 'Bodily Injury',
     'Slip-and-fall at warehouse; third-party BI claim.', 75000.00, 5000.00, 'Frank Miller', 'open'),
    (v_pol_bayside, v_cli_bayside, v_car_nationwide, date '2026-04-02', date '2026-04-03', 'Property Damage',
     'Kitchen fire, smoke damage to dining area.', 30000.00, 30000.00, 'Gina Alvarez', 'closed');

  -- Bulk claims against the existing policies (pagination test data).
  insert into public.claims
    (policy_id, client_id, carrier_id, date_of_loss, date_reported, loss_type,
     description, reserve_amt, paid_amt, adjuster, status)
  select
    (array[v_pol_acme_gl, v_pol_bayside, v_pol_techflow, v_pol_acme_rnw])[1 + (g % 4)],
    (array[v_cli_acme, v_cli_bayside, v_cli_techflow, v_cli_acme])[1 + (g % 4)],
    v_car_chubb,
    date '2026-01-01' + g, date '2026-01-02' + g,
    (array['Property Damage', 'Bodily Injury', 'GL', 'Auto', 'Cyber'])[1 + (g % 5)],
    'Auto-generated test claim #' || g,
    (1000 * (1 + g % 50))::decimal(14,2), (500 * (1 + g % 30))::decimal(14,2),
    'Test Adjuster ' || (1 + g % 5),
    (array['open', 'closed', 'reopened', 'denied'])[1 + (g % 4)]
  from generate_series(1, 100) as g;

  -- ==========================================================================
  -- Payments (installment schedule against Acme GL policy)
  -- ==========================================================================
  insert into public.payments
    (policy_id, client_id, due_date, payment_date, amount_due, amount_paid,
     payment_method, invoice_number, status)
  values
    (v_pol_acme_gl, v_cli_acme, date '2026-01-15', date '2026-01-14', 25200.00, 25200.00, 'wire',  'INV-2026-0001', 'paid'),
    (v_pol_acme_gl, v_cli_acme, date '2026-04-15', date '2026-04-16', 25200.00, 15000.00, 'ach',   'INV-2026-0001', 'partial'),
    (v_pol_bayside, v_cli_bayside, date '2026-02-01', null,          25200.00, 0.00,     null,    'INV-2026-0002', 'outstanding');

  -- ==========================================================================
  -- Financial chain: invoice -> AR -> AR payments -> capacity -> remittance
  -- ==========================================================================
  -- Acme GL invoice (full annual term; premium 50000 + fees 400 = 50400).
  insert into public.invoices
    (policy_id, agent_id, transaction_type, invoice_date, due_date,
     policy_eff_date, policy_exp_date, txn_eff_date, txn_exp_date,
     annual_premium, term_premium, term_terrorism_premium, total_term_premium,
     policy_fee, inspection_fee, other_fees, total_term_prem_fees,
     mga_net_com_pct, mga_net_com_amt, invoice_status)
  values
    (v_pol_acme_gl, v_retail, 'new_business', date '2026-01-15', date '2026-02-14',
     date '2026-01-15', date '2027-01-15', date '2026-01-15', date '2027-01-15',
     50000.00, 50000.00, 0.00, 50000.00,
     250.00, 150.00, 0.00, 50400.00,
     0.15000, 7500.00, 'partial')
  returning id into v_inv_acme;

  insert into public.accounts_receivable
    (inv_id, policy_id, client_id, agent_id, invoice_date, due_date, invoice_total, ar_status, collection_notes)
  values
    (v_inv_acme, v_pol_acme_gl, v_cli_acme, v_retail, date '2026-01-15', date '2026-02-14', 50400.00, 'partial',
     'Two installments received; balance outstanding.')
  returning id into v_ar_acme;

  update public.invoices set ar_id = v_ar_acme where id = v_inv_acme;

  insert into public.accounts_receivable_payments
    (ar_id, payment_date, payment_amount, payment_method, reference_number, created_by)
  values
    (v_ar_acme, date '2026-01-14', 25200.00, 'wire', 'WIRE-889201', 'seed'),
    (v_ar_acme, date '2026-04-16', 15000.00, 'ach',  'ACH-load-4471', 'seed');

  insert into public.capacity
    (inv_id, ar_id, policy_id, carrier_id, client_id, term_premium, commission_pct, ap_status, notes)
  values
    (v_inv_acme, v_ar_acme, v_pol_acme_gl, v_car_lexington, v_cli_acme, 50000.00, 0.30000, 'partial',
     'Net due carrier 35000; partially remitted.')
  returning id into v_cap_acme;

  insert into public.capacity_remittance (cap_id, remit_date, remit_amount)
  values
    (v_cap_acme, date '2026-02-20', 20000.00);

  -- Bayside invoice (fully outstanding; premium 25000 + fees 200 = 25200).
  insert into public.invoices
    (policy_id, agent_id, transaction_type, invoice_date, due_date,
     policy_eff_date, policy_exp_date, txn_eff_date, txn_exp_date,
     annual_premium, term_premium, term_terrorism_premium, total_term_premium,
     policy_fee, inspection_fee, other_fees, total_term_prem_fees,
     mga_net_com_pct, mga_net_com_amt, invoice_status)
  values
    (v_pol_bayside, v_retail, 'new_business', date '2026-02-01', date '2026-03-03',
     date '2026-02-01', date '2027-02-01', date '2026-02-01', date '2027-02-01',
     25000.00, 25000.00, 0.00, 25000.00,
     200.00, 0.00, 0.00, 25200.00,
     0.07500, 1875.00, 'outstanding')
  returning id into v_inv_bayside;

  insert into public.accounts_receivable
    (inv_id, policy_id, client_id, agent_id, invoice_date, due_date, invoice_total, ar_status, collection_notes)
  values
    (v_inv_bayside, v_pol_bayside, v_cli_bayside, v_retail, date '2026-02-01', date '2026-03-03', 25200.00, 'outstanding',
     'Invoice sent; awaiting first payment.')
  returning id into v_ar_bayside;

  update public.invoices set ar_id = v_ar_bayside where id = v_inv_bayside;

  -- ==========================================================================
  -- Subscription (multi-carrier co-insurance) for the TechFlow cyber policy.
  -- The policy was inserted with placement_type='subscription' above; here we
  -- create the backing subscription + participant rows (shares sum to 100%) and
  -- wire policies.subscription_id so the placement is fully consistent.
  -- ==========================================================================
  insert into public.subscription (policy_id, market_lead_carrier, notes)
  values (v_pol_techflow, 'Lloyd''s Syndicate 2003 (XYZ)',
     'Quota-share cyber placement; three participating companies.')
  returning id into v_subs_techflow;

  insert into public.subscription_participant
    (subscription_id, carrier_id, role, participation_pct, status, notes)
  values
    (v_subs_techflow, v_car_lloyds,    'lead',      0.50000, 'active', 'Market lead; set placement terms.'),
    (v_subs_techflow, v_car_lexington, 'following', 0.30000, 'active', 'Following market.'),
    (v_subs_techflow, v_car_chubb,     'following', 0.20000, 'active', 'Following market.');

  update public.policies set subscription_id = v_subs_techflow where id = v_pol_techflow;

  -- ==========================================================================
  -- Budget targets (forward-looking GWP by line of business and month).
  -- Full-year 2026 for the active lines, driving the /budget proforma page.
  -- ==========================================================================
  insert into public.budget_targets (year, month, line_of_business, gwp_target, notes)
  select
    2026, m.month, lob.name,
    (lob.monthly_base * (1 + 0.02 * m.month))::decimal(14,2),
    'FY2026 plan'
  from (values
    ('GL',       55000.00),
    ('Property', 40000.00),
    ('Cyber',    95000.00),
    ('D&O',      35000.00),
    ('Auto',     20000.00)
  ) as lob(name, monthly_base)
  cross join generate_series(1, 12) as m(month);

  -- ==========================================================================
  -- AIR catastrophe exposures (location-level TIV) + AI/GPU equipment schedules.
  -- Two locations for the TechFlow cyber/datacenter risk plus one Acme site.
  -- ==========================================================================
  insert into public.air_exposure
    (policy_id, client_id, certificate_ref, location_id, location_name,
     street_address, city, state, zip_code, county, latitude, longitude,
     geocode_quality, number_of_buildings, occupancy_code, construction_code,
     building_id, year_built, num_storeys, gross_floor_area, primary_construction_class,
     roof_type, roof_shape, foundation_type, seismic_design_level, wind_speed_design,
     fire_protection_class, sprinkler, unit_ref, unit_floor_level, unit_gross_area,
     unit_occupancy_desc, building_replacement_value, contents_value,
     business_interruption_value, deductible_amount, deductible_type, policy_limit,
     status, notes)
  values
    (v_pol_techflow, v_cli_techflow, 'CY-2026-000789', 'LOC-001', 'TechFlow — Santa Clara Data Center',
     '2200 Mission College Blvd', 'Santa Clara', 'CA', '95054', 'Santa Clara', 37.389200, -121.985800,
     1, 1, '241', '3',
     'BLD-001', 2015, 3, 68000, 'Masonry Non-Combustible',
     'Built-Up Membrane', 'Flat', 'Slab on Grade', 'High', 'N/A',
     2, true, 'DC-100', '1', 40000,
     'Data Center / Server Room', 22000000.00, 8500000.00,
     6200000.00, 100000.00, 'Straight', 50000000.00,
     'active', 'Primary AI training cluster; high seismic zone.')
  returning id into v_air_tf_dc;

  insert into public.air_exposure
    (policy_id, client_id, certificate_ref, location_id, location_name,
     street_address, city, state, zip_code, county, latitude, longitude,
     geocode_quality, number_of_buildings, occupancy_code, construction_code,
     building_id, year_built, num_storeys, gross_floor_area, primary_construction_class,
     roof_type, roof_shape, foundation_type, seismic_design_level, wind_speed_design,
     fire_protection_class, sprinkler, unit_ref, unit_floor_level, unit_gross_area,
     unit_occupancy_desc, building_replacement_value, contents_value,
     business_interruption_value, deductible_amount, deductible_type, policy_limit,
     status, notes)
  values
    (v_pol_techflow, v_cli_techflow, 'CY-2026-000789', 'LOC-002', 'TechFlow — Reno Edge Site',
     '4500 Vista Blvd', 'Reno', 'NV', '89506', 'Washoe', 39.606600, -119.816500,
     1, 1, '241', '5',
     'BLD-002', 2020, 1, 24000, 'Steel Frame',
     'Metal Deck', 'Flat', 'Slab on Grade', 'Moderate', 'N/A',
     3, true, 'EDGE-01', '1', 24000,
     'Data Center / Server Room', 6800000.00, 3100000.00,
     1400000.00, 50000.00, 'Straight', 50000000.00,
     'active', 'Inference edge site; wildfire-exposed county.')
  returning id into v_air_tf_edge;

  insert into public.air_exposure
    (policy_id, client_id, certificate_ref, location_id, location_name,
     street_address, city, state, zip_code, county, latitude, longitude,
     geocode_quality, number_of_buildings, occupancy_code, construction_code,
     building_id, year_built, num_storeys, gross_floor_area, primary_construction_class,
     roof_type, roof_shape, foundation_type, seismic_design_level, wind_speed_design,
     fire_protection_class, sprinkler, unit_ref, unit_floor_level, unit_gross_area,
     unit_occupancy_desc, building_replacement_value, contents_value,
     business_interruption_value, deductible_amount, deductible_type, policy_limit,
     status, notes)
  values
    (v_pol_acme_gl, v_cli_acme, 'GL-2026-000123', 'LOC-001', 'Acme Manufacturing — Main Plant',
     '1400 Industrial Blvd', 'Chicago', 'IL', '60632', 'Cook', 41.809700, -87.702400,
     1, 2, '323', '4',
     'BLD-001', 1988, 2, 120000, 'Reinforced Concrete',
     'Metal Deck', 'Flat', 'Slab on Grade', 'N/A', '90',
     4, false, 'PLANT-A', '1', 120000,
     'Light Manufacturing', 14500000.00, 6200000.00,
     3800000.00, 25000.00, 'Straight', 30000000.00,
     'active', 'Primary manufacturing facility.')
  returning id into v_air_acme;

  -- AI / GPU equipment schedules (child rows). TechFlow's DC carries the bulk of
  -- the AI compute TIV; the edge site is smaller; Acme has no GPU compute.
  insert into public.air_equipment
    (exposure_id, equipment_category, gpu_manufacturer, gpu_model, gpu_count,
     gpu_unit_age, gpu_purchase_date, gpu_unit_replacement_cost,
     server_rack_count, server_replacement_cost, supporting_infra_value,
     power_draw_kw, cooling_type, fire_suppression_system, notes)
  values
    (v_air_tf_dc,   'AI / GPU Compute', 'NVIDIA', 'H100 SXM5',   256, 1, date '2025-03-01', 30000.00,
     32, 48000.00, 1200000.00, 5120, 'Liquid / Immersion', 'FM-200 Clean Agent', 'Primary training pods.'),
    (v_air_tf_dc,   'AI / GPU Compute', 'NVIDIA', 'A100 80GB',   128, 3, date '2023-06-01', 15000.00,
     16, 42000.00, 400000.00, 2048, 'Liquid / Immersion', 'FM-200 Clean Agent', 'Legacy training pool.'),
    (v_air_tf_edge, 'AI / GPU Compute', 'NVIDIA', 'L40S',         48, 1, date '2025-01-15', 9000.00,
     6, 40000.00, 180000.00, 720, 'Chilled Air', 'Pre-Action Sprinkler', 'Inference edge nodes.');

  -- ==========================================================================
  -- BULK REPORTING VOLUME
  --
  -- The records above are hand-crafted, fully-consistent examples. The block
  -- below generates higher-volume, lower-fidelity data so the reporting / agent
  -- SQL has enough rows to aggregate over: production & revenue reports (POL),
  -- receivables aging (INV/AR + AR payments), installment collections (PMT),
  -- the new-business pipeline (NBS) and the renewal pipeline (RNW).
  --
  -- Strategy: insert the bulk policies first, tagged notes = 'bulk-seed', then
  -- drive every downstream table with set-based INSERT ... SELECT that joins
  -- back to those tagged policies. This avoids capturing hundreds of generated
  -- identity ids into variables. FKs are distributed across the entities seeded
  -- above (named + the 120-row test pools) via the arrays captured here.
  -- ==========================================================================

  select array_agg(id) into v_client_ids  from public.clients      where status = 'active';
  select array_agg(id) into v_agency_ids  from public.agencies     where agency_level = 'retail' and status = 'active';
  select array_agg(id) into v_carrier_ids from public.carriers     where status = 'active';
  select array_agg(id) into v_uw_ids      from public.underwriters;

  -- 180 policies spread across ~18 months (Jan 2025 onward), all lines of
  -- business and transaction types, with a realistic status mix (active /
  -- expired / cancelled / pending derived from the term dates & row number).
  with gen as (
    select
      g,
      (date '2025-01-05' + (g * 3))                             as eff_date,
      (array['GL','Property','Cyber','D&O','Auto','WC','Umbrella'])[1 + (g % 7)]   as lob,
      (10000 + (g % 20) * 2500)::decimal(14,2)                  as annual_premium,
      (array[0.30000,0.32500,0.27500])[1 + (g % 3)]::decimal(7,5) as gross_pct,
      (array[0.12500,0.15000,0.17500])[1 + (g % 3)]::decimal(7,5) as agency_pct,
      v_client_ids [1 + (g % array_length(v_client_ids, 1))]   as client_id,
      v_agency_ids [1 + (g % array_length(v_agency_ids, 1))]   as agent_id,
      v_carrier_ids[1 + (g % array_length(v_carrier_ids, 1))]  as carrier_id,
      v_uw_ids     [1 + (g % array_length(v_uw_ids, 1))]       as uw_id
    from generate_series(1, 180) as g
  )
  insert into public.policies
    (client_id, agent_id, carrier_id, transaction_type, status, placement_type,
     line_of_business, policy_number,
     policy_eff_date, policy_exp_date, txn_date, txn_eff_date, txn_exp_date,
     annual_premium, policy_fee, inspection_fee, other_fees,
     gross_com_pct_override, agency_com_pct, min_earned_prem_pct,
     cov_a_limit, deductible_amt, deductible_base,
     jurisdiction, home_state, assigned_to_uw_id, notes)
  select
    client_id, agent_id, carrier_id,
    (array['new_business','new_business','new_business','renewal','endorsement','cancellation'])[1 + (g % 6)],
    case when g % 6 = 5                     then 'cancelled'
         when (eff_date + 365) < current_date then 'expired'
         when g % 11 = 0                    then 'pending'
         else 'active' end,
    'single_carrier',
    lob, lob || '-BULK-' || lpad(g::text, 4, '0'),
    eff_date, eff_date + 365, eff_date - 5, eff_date, eff_date + 365,
    annual_premium, 250.00, 150.00, 0.00,
    gross_pct, agency_pct, 0.25000,
    (annual_premium * 40)::decimal(16,2), 10000.00, 'per occurrence',
    (array['California','Texas','New York','Florida','Illinois'])[1 + (g % 5)],
    (array['CA','TX','NY','FL','IL'])[1 + (g % 5)],
    uw_id, 'bulk-seed'
  from gen;

  select array_agg(id order by id) into v_bulk_pol_ids
  from public.policies where notes = 'bulk-seed';

  -- One invoice per bulk policy (full annual term; premium + fees). The
  -- outstanding / partial / paid mix is keyed off the policy id so the invoice,
  -- AR and payment rows for a given policy stay consistent.
  insert into public.invoices
    (policy_id, agent_id, transaction_type, invoice_date, due_date,
     policy_eff_date, policy_exp_date, txn_eff_date, txn_exp_date,
     annual_premium, term_premium, term_terrorism_premium, total_term_premium,
     policy_fee, inspection_fee, other_fees, total_term_prem_fees,
     mga_net_com_pct, mga_net_com_amt, invoice_status)
  select
    p.id, p.agent_id, p.transaction_type, p.accounting_date, p.accounting_date + 30,
    p.policy_eff_date, p.policy_exp_date, p.txn_eff_date, p.txn_exp_date,
    p.annual_premium, p.annual_premium, 0.00, p.annual_premium,
    p.policy_fee, p.inspection_fee, p.other_fees,
    p.annual_premium + p.policy_fee + p.inspection_fee + p.other_fees,
    (p.gross_com_pct_override - p.agency_com_pct),
    round(p.annual_premium * (p.gross_com_pct_override - p.agency_com_pct), 2),
    -- invoice_status has no 'overdue' bucket (that lives on AR); map it to 'outstanding'.
    (array['paid','partial','outstanding','outstanding','paid'])[1 + (p.id % 5)]
  from public.policies p
  where p.notes = 'bulk-seed';

  -- One AR record per bulk invoice. Same id-keyed bucket, but AR keeps the
  -- 'overdue' status so the aging report has a bucket that's past due.
  insert into public.accounts_receivable
    (inv_id, policy_id, client_id, agent_id, invoice_date, due_date, invoice_total, ar_status, collection_notes)
  select
    i.id, p.id, p.client_id, p.agent_id, i.invoice_date, i.due_date,
    i.total_term_prem_fees,
    (array['paid','partial','outstanding','overdue','paid'])[1 + (p.id % 5)],
    'Bulk-seed AR.'
  from public.invoices i
  join public.policies p on p.id = i.policy_id
  where p.notes = 'bulk-seed';

  -- Wire each bulk invoice back to its AR row (named invoices already set above).
  update public.invoices i
    set ar_id = ar.id
    from public.accounts_receivable ar
    where ar.inv_id = i.id and i.ar_id is null;

  -- AR payments only for the collected buckets: full for 'paid', half for 'partial'.
  insert into public.accounts_receivable_payments
    (ar_id, payment_date, payment_amount, payment_method, reference_number, created_by)
  select
    ar.id, ar.due_date - 2,
    case ar.ar_status when 'partial' then round(ar.invoice_total * 0.5, 2) else ar.invoice_total end,
    (array['ach','check','wire','credit_card'])[1 + (ar.id % 4)],
    'BULK-' || ar.id, 'seed'
  from public.accounts_receivable ar
  where ar.collection_notes = 'Bulk-seed AR.'
    and ar.ar_status in ('paid','partial');

  -- Two installment payments per bulk policy. The first is always paid; the
  -- second is paid / overdue / outstanding depending on the policy id & due date.
  insert into public.payments
    (policy_id, client_id, due_date, payment_date, amount_due, amount_paid,
     payment_method, invoice_number, status)
  select
    p.id, p.client_id,
    p.policy_eff_date + (n - 1) * 90,
    case when n = 1 or (p.id % 3) = 0 then p.policy_eff_date + (n - 1) * 90 + 1 else null end,
    round((p.annual_premium + p.policy_fee + p.inspection_fee) / 2.0, 2),
    case when n = 1 or (p.id % 3) = 0 then round((p.annual_premium + p.policy_fee + p.inspection_fee) / 2.0, 2) else 0.00 end,
    case when n = 1 or (p.id % 3) = 0 then (array['ach','check','wire','credit_card'])[1 + (p.id % 4)] else null end,
    (select inv_ref from public.invoices where policy_id = p.id limit 1),
    case when n = 1 or (p.id % 3) = 0                          then 'paid'
         when (p.policy_eff_date + (n - 1) * 90) < current_date then 'overdue'
         else 'outstanding' end
  from public.policies p
  cross join generate_series(1, 2) as n
  where p.notes = 'bulk-seed';

  -- 80-row new-business pipeline across every stage. Bound submissions point at
  -- a bulk policy; the rest are still open (policy_id NULL).
  insert into public.new_business_submissions
    (submission_number, policy_id, stage, priority, assigned_to, submission_date,
     quote_due_date, quote_received, bind_order_date, bound_date,
     client_id, agent_id, carrier_id,
     line_of_business, policy_eff_date, policy_exp_date,
     jurisdiction, home_state, annual_premium, agency_com_pct, notes)
  select
    'SUB-BULK-' || lpad(g::text, 4, '0'),
    case when g % 7 = 4 then v_bulk_pol_ids[1 + (g % array_length(v_bulk_pol_ids, 1))] else null end,
    (array['prospect','submitted','quoted','bind_order','bound','lost','declined'])[1 + (g % 7)],
    (array['high','medium','low'])[1 + (g % 3)],
    v_uw_ids[1 + (g % array_length(v_uw_ids, 1))],
    date '2026-01-01' + (g % 180),
    date '2026-01-15' + (g % 180),
    case when g % 7 >= 2 then date '2026-01-12' + (g % 180) else null end,
    case when g % 7 >= 3 then date '2026-01-20' + (g % 180) else null end,
    case when g % 7 =  4 then date '2026-01-25' + (g % 180) else null end,
    v_client_ids [1 + (g % array_length(v_client_ids, 1))],
    v_agency_ids [1 + (g % array_length(v_agency_ids, 1))],
    v_carrier_ids[1 + (g % array_length(v_carrier_ids, 1))],
    (array['GL','Property','Cyber','D&O','Auto'])[1 + (g % 5)],
    date '2026-02-01' + (g % 180), date '2027-02-01' + (g % 180),
    (array['California','Texas','New York','Florida','Illinois'])[1 + (g % 5)],
    (array['CA','TX','NY','FL','IL'])[1 + (g % 5)],
    (35000 + (g % 15) * 3000)::decimal(14,2),
    (array[0.12500,0.15000,0.17500])[1 + (g % 3)]::decimal(7,5),
    'Bulk-seed submission.'
  from generate_series(1, 80) as g;

  -- Renewal pipeline for every third bulk policy, across all renewal statuses.
  insert into public.renewals
    (policy_id, renewal_status, assigned_to, txn_type,
     new_policy_number, new_policy_eff_date, new_policy_exp_date,
     annual_premium, agency_com_pct, min_earned_prem_pct,
     inspection_fee, other_fees, common_named_insured, notes)
  select
    p.id,
    (array['pending','in_progress','quoted','bind_order','bound','non-renewed','lost'])
      [1 + (row_number() over (order by p.id)::int % 7)],
    v_uw_ids[1 + (p.id % array_length(v_uw_ids, 1))],
    'renewal',
    p.policy_number || 'R', p.policy_exp_date, p.policy_exp_date + 365,
    round(p.annual_premium * 1.08, 2), p.agency_com_pct, 0.25000,
    150.00, 0.00, 'Bulk-seed renewal', 'Bulk-seed renewal pipeline.'
  from public.policies p
  where p.notes = 'bulk-seed' and (p.id % 3) = 0;

  raise notice 'Seed complete: agencies=% carriers=% clients=% policies=% claims=% invoices=% ar=% ar_payments=% payments=% submissions=% renewals=% subscriptions=% budget_rows=% air_exposures=% air_equipment=%',
    (select count(*) from public.agencies),
    (select count(*) from public.carriers),
    (select count(*) from public.clients),
    (select count(*) from public.policies),
    (select count(*) from public.claims),
    (select count(*) from public.invoices),
    (select count(*) from public.accounts_receivable),
    (select count(*) from public.accounts_receivable_payments),
    (select count(*) from public.payments),
    (select count(*) from public.new_business_submissions),
    (select count(*) from public.renewals),
    (select count(*) from public.subscription),
    (select count(*) from public.budget_targets),
    (select count(*) from public.air_exposure),
    (select count(*) from public.air_equipment);
end $$;
