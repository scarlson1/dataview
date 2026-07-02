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

truncate table
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
begin
  -- ==========================================================================
  -- Surplus lines state rules (state is the natural PK)
  -- ==========================================================================
  insert into public.surplus_lines_state_rules
    (state, state_full_name, entity_license_accepted, individual_license_required,
     stamping_office, source, last_verified)
  values
    ('CA', 'California', true,  true, 'The Surplus Line Association of California', 'SL Laws Manual', date '2026-01-15'),
    ('TX', 'Texas',      true,  true, 'Surplus Lines Stamping Office of Texas',    'SL Laws Manual', date '2026-01-15'),
    ('NY', 'New York',   true,  true, 'Excess Line Association of New York',       'SL Laws Manual', date '2026-01-15'),
    ('FL', 'Florida',    true,  true, 'Florida Surplus Lines Service Office',      'SL Laws Manual', date '2026-01-15'),
    ('IL', 'Illinois',   false, true, 'Surplus Line Association of Illinois',      'SL Laws Manual', date '2026-01-15');

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

  -- ==========================================================================
  -- Clients
  -- ==========================================================================
  insert into public.clients
    (company_name, first_name, last_name, client_type, industry, status,
     phone, email, address_line1, city, state, postal, country, date_added)
  values ('Acme Manufacturing Inc', null, null, 'commercial', 'Manufacturing', 'active',
     '312-555-0400', 'ap@acme-mfg.example', '1400 Industrial Blvd', 'Chicago', 'IL', '60632', 'USA', date '2025-11-01')
  returning id into v_cli_acme;

  insert into public.clients
    (company_name, first_name, last_name, client_type, industry, status,
     phone, email, address_line1, city, state, postal, country, date_added)
  values ('Bayside Restaurants LLC', null, null, 'commercial', 'Hospitality', 'active',
     '214-555-0410', 'finance@bayside.example', '78 Harbor Way', 'Dallas', 'TX', '75204', 'USA', date '2025-12-10')
  returning id into v_cli_bayside;

  insert into public.clients
    (company_name, first_name, last_name, client_type, industry, status,
     phone, email, address_line1, city, state, postal, country, date_added)
  values (null, 'Robert', 'Smith', 'individual', 'Personal Lines', 'active',
     '212-555-0420', 'robert.smith@example.com', '15 Riverside Dr', 'New York', 'NY', '10023', 'USA', date '2026-01-05')
  returning id into v_cli_smith;

  insert into public.clients
    (company_name, first_name, last_name, client_type, industry, status,
     phone, email, address_line1, city, state, postal, country, date_added)
  values ('Community Health Foundation', null, null, 'non_profit', 'Healthcare', 'prospect',
     '415-555-0430', 'admin@chf.example', '500 Wellness Ave', 'San Francisco', 'CA', '94110', 'USA', date '2026-06-01')
  returning id into v_cli_chf;

  insert into public.clients
    (company_name, first_name, last_name, client_type, industry, status,
     phone, email, address_line1, city, state, postal, country, date_added)
  values ('TechFlow Solutions', null, null, 'commercial', 'Technology', 'active',
     '650-555-0440', 'ops@techflow.example', '2200 Mission College Blvd', 'Santa Clara', 'CA', '95054', 'USA', date '2026-02-20')
  returning id into v_cli_techflow;

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
  -- Licenses (SL licenses held by the MGA; default SL licensee per state)
  -- ==========================================================================
  insert into public.license
    (agent_id, license_type, state, license_number, eff_date, exp_date, default_sl_licensee, notes)
  values
    (v_mga, 'Surplus Lines', 'CA', 'CA-SL-778812', date '2025-01-01', date '2026-12-31', true,  'Resident SL license.'),
    (v_mga, 'Surplus Lines', 'TX', 'TX-SL-449021', date '2025-01-01', date '2026-12-31', true,  'Non-resident SL license.'),
    (v_mga, 'Surplus Lines', 'NY', 'NY-EL-330145', date '2025-01-01', date '2026-12-31', true,  'Excess line broker license.'),
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

  raise notice 'Seed complete: agencies=% carriers=% clients=% policies=%',
    (select count(*) from public.agencies),
    (select count(*) from public.carriers),
    (select count(*) from public.clients),
    (select count(*) from public.policies);
end $$;
