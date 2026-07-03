-- Apply RBAC policies to all tables using the 

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
        'lob_defaults',
        'subscription',
        'subscription_participant',
        'budget_targets',
        'air_exposure',
        'air_equipment'
    ] loop
    -- set read policy for each table using `authorize(resource=table, action='read')`
    execute format('create policy "rbac read"  on public.%I for select to authenticated using (public.authorize(%L, ''read''))', t, t);
    execute format('create policy "rbac write" on public.%I for all    to authenticated using (public.authorize(%L, ''write'')) with check (public.authorize(%L, ''write''))', t, t, t);
    end loop;
end $$;

-- Seed role_permissions: for each table, set the read/write policy for each role
do $$
declare
    t text;
    all_tables text[] := array[
        'agencies','carriers','clients','binder','binder_section','binder_part',
        'surplus_lines_state_rules','license','underwriters','policies',
        'new_business_submissions','renewals','claims','payments','invoices',
        'accounts_receivable','accounts_receivable_payments','capacity',
        'capacity_remittance','lob_defaults',
        'subscription','subscription_participant','budget_targets',
        'air_exposure','air_equipment'
    ];
    uw_write text[] := array[
        'policies','binder','binder_section','binder_part','new_business_submissions',
    'renewals','claims','agencies','carriers','clients','underwriters',
    'capacity','license','air_exposure','air_equipment'
    ];
    acct_write text[] := array[
        'invoices','payments','accounts_receivable','accounts_receivable_payments',
        'capacity_remittance','budget_targets','subscription','subscription_participant'
    ];
begin
    foreach t in array all_tables loop
        insert into public.role_permissions (role, resource, can_read, can_write) values
            ('admin',       t, true, true),
            ('underwriter',       t, true, t = any(uw_write)),
            ('accounting',       t, true, t = any(acct_write)),
            ('viewer',       t, true, false),
    end loop;
end $$;