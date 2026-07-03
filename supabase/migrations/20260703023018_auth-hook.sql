/**
 * AUTH HOOKS
 * Create an auth hook to add a custom claim to the access token jwt.
 */

-- Create the auth hook function
-- https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
    declare
        claims jsonb;
        user_role public.app_role;
    begin
        select role into user_role from public.user_roles where user_id = (event->>'user_id')::uuid;

        claims := event->'claims';

        if user_role is not null then
            -- set the claim
            claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
        else
            claims := jsonb_set(claims, '{user_role}', 'null'::jsonb); -- TODO: or decide 'viewer' ??
        end if;
    
        event := jsonb_set(event, '{claims}', claims);

        return event;
    end;
$$;

grant usage on schema public to supabase_auth_admin;

-- Grant supabase admin permissions to invoke function
grant execute 
    on function public.custom_access_token_hook
    to supabase_auth_admin;

revoke execute
    on function public.custom_access_token_hook
    from authenticated, anon, public;

grant all
    on table public.user_roles
to supabase_auth_admin;

revoke all
    on table public.user_roles
    from authenticated, anon, public;

-- The invite-user edge function assigns/updates roles through the service_role
-- client (bypasses RLS but still needs table privileges). The revoke above
-- stripped its inherited DML, so grant it back explicitly.
grant select, insert, update, delete on table public.user_roles to service_role;

create policy "Allow auth admin to read user roles" ON public.user_roles
    as permissive for select
    to supabase_auth_admin
    using (true);

-- Client read access to user_roles. The `revoke all` above stripped the
-- authenticated role, so grant SELECT back (writes stay off the client: role
-- changes go through the admin-gated invite-user edge function via service_role,
-- which bypasses RLS). A user may read only its own row — it subscribes to that
-- row via Realtime and calls refreshSession() when its role changes. Admins may
-- read every row for the Team/Users admin screen.
grant select on table public.user_roles to authenticated;

create policy "read own role" on public.user_roles
    for select to authenticated
    using ( (select auth.uid()) = user_id );

create policy "admin read all roles" on public.user_roles
    for select to authenticated
    using ( (auth.jwt() ->> 'user_role') = 'admin' );