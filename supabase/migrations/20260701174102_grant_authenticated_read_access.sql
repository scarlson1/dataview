-- Every table so far was created with RLS enabled and NO policies (see the
-- commented "authenticated read" template left in each table's own migration),
-- so only service_role could read anything. The dashboard is read-only today
-- (see src/hooks/useTableData.ts), so this grants SELECT + adds a permissive
-- read policy for the `authenticated` role across the whole schema. Write
-- access is intentionally left for a future migration.

-- Base tables: need both a GRANT (object-level privilege) and an RLS policy
-- (row-level privilege) for `authenticated` to read them. RLS now handled by RBAC policies 

do $$
declare
  t text;
begin
  foreach t in array array[
    'agencies',
    'carriers',
    'clients',
    'binder',
    'binder_section',
    'binder_part',
    'surplus_lines_state_rules',
    'license',
    'underwriters',
    'policies',
    'new_business_submissions',
    'renewals',
    'claims',
    'payments',
    'invoices',
    'accounts_receivable',
    'accounts_receivable_payments',
    'capacity',
    'capacity_remittance',
    'lob_defaults'
  ]
  loop
    -- Read + write for the authenticated role. The app now performs multi-table
    -- writes (New Business, invoicing, payments) via the lifecycle functions and
    -- direct inserts; this is a single-tenant internal MGA tool, so the policies
    -- are permissive. Per-underwriter/agency scoping (assigned_to*, agent_id)
    -- would be added here later.
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Companion `security_invoker` views: only need the GRANT. RLS is enforced
-- when the view queries its underlying base table as the calling role.
grant select on public.agencies_with_status          to authenticated;
grant select on public.clients_computed              to authenticated;
grant select on public.accounts_receivable_computed  to authenticated;
grant select on public.binder_part_computed          to authenticated;
grant select on public.license_computed              to authenticated;
grant select on public.capacity_computed             to authenticated;
grant select on public.net_com_uep                   to authenticated;
grant select on public.policies_computed             to authenticated;
grant select on public.renewals_computed             to authenticated;
