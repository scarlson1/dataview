-- ============================================================================
-- RBAC test suite (pgTAP)
--
-- Covers the role-based access control stack defined in:
--   * 20260703021911_rbac.sql        -- app_role enum, user_roles,
--                                        role_permissions, authorize()
--   * 20260703023018_auth-hook.sql   -- custom_access_token_hook, user_roles RLS
--   * 20260703040348_rbac_policies.sql -- per-table "rbac read"/"rbac write"
--                                          policies + role_permissions seed
--
-- How the tests fake an authenticated request:
--   auth.jwt()  reads current_setting('request.jwt.claims')
--   auth.uid()  reads the 'sub' key of those claims
-- so we simulate a signed-in user of a given role by stuffing that GUC with
-- set_config('request.jwt.claims', ...) and switching to the `authenticated`
-- Postgres role, exactly as PostgREST does per request.
--
-- Run with the Supabase CLI:   supabase test db
-- or without it, see tests/README.md (psql runner against the local DB).
-- The whole thing runs inside one transaction that is rolled back, so it
-- leaves no data behind.
-- ============================================================================
begin;

create extension if not exists pgtap;

select plan(43);

-- ----------------------------------------------------------------------------
-- Helpers: impersonate a role for the current transaction.
-- ----------------------------------------------------------------------------
create or replace function pg_temp.act_as(p_role text, p_uid uuid default '11111111-1111-1111-1111-111111111111')
returns void language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'user_role', p_role)::text,
    true);  -- is_local = true -> scoped to this transaction
  set local role authenticated;
end $$;

-- Impersonate with NO user_role claim (e.g. a user who was never assigned one).
create or replace function pg_temp.act_as_roleless(p_uid uuid default '22222222-2222-2222-2222-222222222222')
returns void language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text,
    true);
  set local role authenticated;
end $$;

-- Set only the JWT claims (no DB role switch) so authorize() can be called
-- directly while we stay superuser and can keep seeding/asserting.
create or replace function pg_temp.claim_role(p_role text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('user_role', p_role)::text, true);
end $$;


-- ============================================================================
-- 1. authorize(resource, action) — the core decision function
-- ============================================================================
select pg_temp.claim_role('admin');
select ok(public.authorize('agencies', 'read'),  'admin may read agencies');
select ok(public.authorize('agencies', 'write'), 'admin may write agencies');
select ok(public.authorize('invoices', 'write'), 'admin may write invoices');
select ok(NOT public.authorize('agencies', 'delete'),
          'authorize returns false for an unknown action');
select ok(NOT public.authorize('does_not_exist', 'read'),
          'authorize returns false for an unknown resource');

select pg_temp.claim_role('viewer');
select ok(public.authorize('agencies', 'read'),      'viewer may read agencies');
select ok(NOT public.authorize('agencies', 'write'), 'viewer may NOT write agencies');
select ok(NOT public.authorize('invoices', 'write'), 'viewer may NOT write invoices');

select pg_temp.claim_role('underwriter');
select ok(public.authorize('invoices', 'read'),      'underwriter may read invoices');
select ok(public.authorize('policies', 'write'),     'underwriter may write policies');
select ok(public.authorize('claims', 'write'),       'underwriter may write claims');
select ok(NOT public.authorize('invoices', 'write'), 'underwriter may NOT write invoices');
select ok(NOT public.authorize('payments', 'write'), 'underwriter may NOT write payments');

select pg_temp.claim_role('accounting');
select ok(public.authorize('policies', 'read'),      'accounting may read policies');
select ok(public.authorize('invoices', 'write'),     'accounting may write invoices');
select ok(public.authorize('payments', 'write'),     'accounting may write payments');
select ok(NOT public.authorize('policies', 'write'), 'accounting may NOT write policies');
select ok(NOT public.authorize('claims', 'write'),   'accounting may NOT write claims');

-- No / null role claim => deny.
select set_config('request.jwt.claims', '{}', true);
select ok(NOT public.authorize('agencies', 'read'),
          'authorize denies when no user_role claim is present');
select pg_temp.claim_role(null);
select ok(NOT public.authorize('agencies', 'read'),
          'authorize denies when user_role claim is null');


-- ============================================================================
-- 2. role_permissions seed correctness
-- ============================================================================
select is(
  (select count(*)::int from public.role_permissions),
  100,
  'role_permissions has 25 resources x 4 roles = 100 rows');

select is(
  (select count(*)::int from public.role_permissions where can_read = false),
  0,
  'every role can read every resource');

select is(
  (select count(*)::int from public.role_permissions where role = 'admin' and can_write),
  25,
  'admin can write all 25 resources');

select is(
  (select count(*)::int from public.role_permissions where role = 'viewer' and can_write),
  0,
  'viewer can write nothing');

select is(
  (select count(*)::int from public.role_permissions where role = 'underwriter' and can_write),
  15,
  'underwriter can write exactly 15 resources');

select is(
  (select count(*)::int from public.role_permissions where role = 'accounting' and can_write),
  8,
  'accounting can write exactly 8 resources');


-- ============================================================================
-- 3. Structural: RLS enabled + policies present on every governed table
-- ============================================================================
select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (select distinct resource from public.role_permissions)
      and c.relrowsecurity = false),
  0,
  'row-level security is enabled on every governed table');

select is(
  (select count(distinct resource)::int
     from public.role_permissions r
     join pg_class c on c.relname = r.resource
     join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
     join pg_policy p on p.polrelid = c.oid and p.polname = 'rbac read'),
  25,
  'every governed table has an "rbac read" policy');

select is(
  (select count(distinct resource)::int
     from public.role_permissions r
     join pg_class c on c.relname = r.resource
     join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
     join pg_policy p on p.polrelid = c.oid and p.polname = 'rbac write'),
  25,
  'every governed table has an "rbac write" policy');

select ok(
  (select p.prosecdef
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'authorize'),
  'authorize() is SECURITY DEFINER (bypasses role_permissions RLS)');


-- ============================================================================
-- 4. End-to-end RLS enforcement on a representative table (agencies).
--    agencies is writable by admin + underwriter, read-only for the rest.
-- ============================================================================

-- viewer: can read, cannot write
select pg_temp.act_as('viewer');
select lives_ok(
  $$ select 1 from public.agencies limit 1 $$,
  'viewer can SELECT from agencies');
select throws_ok(
  $$ insert into public.agencies (agency_level, licensee_type, billing_entity)
     values ('mga', 'entity', 'self') $$,
  '42501',
  null,
  'viewer INSERT into agencies is blocked by RLS');
reset role;

-- accounting: read-only on agencies
select pg_temp.act_as('accounting');
select throws_ok(
  $$ insert into public.agencies (agency_level, licensee_type, billing_entity)
     values ('mga', 'entity', 'self') $$,
  '42501',
  null,
  'accounting INSERT into agencies is blocked by RLS');
reset role;

-- underwriter: agencies is in its write set
select pg_temp.act_as('underwriter');
select lives_ok(
  $$ insert into public.agencies (agency_level, licensee_type, billing_entity)
     values ('mga', 'entity', 'self') $$,
  'underwriter can INSERT into agencies');
reset role;

-- admin: full write
select pg_temp.act_as('admin');
select lives_ok(
  $$ insert into public.agencies (agency_level, licensee_type, billing_entity)
     values ('wholesale', 'entity', 'self') $$,
  'admin can INSERT into agencies');
reset role;

-- roleless authenticated user: RLS filters everything out (read yields nothing)
select pg_temp.act_as_roleless();
select is(
  (select count(*)::int from public.agencies),
  0,
  'authenticated user with no role sees zero rows (RLS denies read)');
reset role;


-- ============================================================================
-- 5. user_roles RLS: read own row; admins read all
-- ============================================================================
-- Two fixture users straight in auth.users (rolled back with the txn).
insert into auth.users (instance_id, id, aud, role, email)
values
  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'rbac-admin@test.example'),
  ('00000000-0000-0000-0000-000000000000',
   '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'rbac-viewer@test.example');

insert into public.user_roles (user_id, role) values
  ('33333333-3333-3333-3333-333333333333', 'admin'),
  ('44444444-4444-4444-4444-444444444444', 'viewer');

-- viewer sees only its own role row
select pg_temp.act_as('viewer', '44444444-4444-4444-4444-444444444444');
select is(
  (select count(*)::int from public.user_roles),
  1,
  'viewer can read exactly one user_roles row (its own)');
select is(
  (select user_id from public.user_roles),
  '44444444-4444-4444-4444-444444444444'::uuid,
  'the row a viewer reads is its own');
select throws_ok(
  $$ update public.user_roles set role = 'admin'
     where user_id = '44444444-4444-4444-4444-444444444444' $$,
  '42501',
  null,
  'user cannot escalate its own role (no write policy on user_roles)');
reset role;

-- admin sees every role row
select pg_temp.act_as('admin', '33333333-3333-3333-3333-333333333333');
select ok(
  (select count(*)::int from public.user_roles) >= 2,
  'admin can read all user_roles rows');
reset role;


-- ============================================================================
-- 6. custom_access_token_hook stamps the user_role claim
-- ============================================================================
select is(
  public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', '33333333-3333-3333-3333-333333333333',
      'claims', '{}'::jsonb)
  ) #>> '{claims,user_role}',
  'admin',
  'hook copies the assigned role into claims.user_role');

select is(
  public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', '44444444-4444-4444-4444-444444444444',
      'claims', '{}'::jsonb)
  ) #>> '{claims,user_role}',
  'viewer',
  'hook copies a viewer role into claims.user_role');

select is(
  public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', '55555555-5555-5555-5555-555555555555',  -- no user_roles row
      'claims', '{}'::jsonb)
  ) #> '{claims,user_role}',
  'null'::jsonb,
  'hook sets claims.user_role to JSON null for a user with no assigned role');


select * from finish();
rollback;
