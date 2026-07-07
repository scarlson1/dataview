// Setup type definitions for built-in Supabase Runtime APIs
import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';
import { Database, TablesInsert } from '../_shared/database.types.ts';

// Keep in sync with the public.app_role enum (20260703021911_rbac.sql).
const ROLES = ['admin', 'underwriter', 'accounting', 'viewer'] as const;
type Role = (typeof ROLES)[number];

export default {
  // Admin-only user management: list users with their roles, and change a role.
  // Role writes go through service_role here (bypasses RLS) rather than being
  // exposed to the client. The target user's session updates on its own via the
  // Realtime subscription on user_roles (see src/context/AuthContext.tsx).
  fetch: withSupabase<Database>({ auth: ['user'] }, async (req, ctx) => {
    const callerId = ctx.jwtClaims?.sub;
    if (!callerId)
      return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: caller, error: callerError } = await ctx.supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .maybeSingle();

    if (callerError)
      return Response.json({ error: callerError.message }, { status: 500 });

    if (caller?.role !== 'admin')
      return Response.json({ error: 'Admin role required' }, { status: 403 });

    let body: { action?: unknown; user_id?: unknown; role?: unknown };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (body.action === 'list') {
      const { data: list, error: listError } =
        await ctx.supabaseAdmin.auth.admin.listUsers();
      if (listError)
        return Response.json({ error: listError.message }, { status: 500 });

      const { data: roles, error: rolesError } = await ctx.supabaseAdmin
        .from('user_roles')
        .select('user_id, role');

      if (rolesError)
        return Response.json({ error: rolesError.message }, { status: 500 });

      const roleByUser = new Map(roles?.map((r) => [r.user_id, r.role]));
      const users = list.users.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        role: roleByUser.get(u.id) ?? null,
        created_at: u.created_at,
      }));
      return Response.json({ users });
    }

    if (body.action === 'setRole') {
      const userId = body.user_id;
      const role = body.role;
      if (typeof userId !== 'string' || !userId) {
        return Response.json({ error: 'user_id is required' }, { status: 400 });
      }
      if (typeof role !== 'string' || !ROLES.includes(role as Role)) {
        return Response.json(
          { error: 'A valid role is required' },
          {
            status: 400,
          },
        );
      }
      // Guard against an admin removing the last admin (and locking everyone out).
      if (userId === callerId && role !== 'admin') {
        return Response.json(
          { error: 'You cannot remove your own admin role' },
          { status: 400 },
        );
      }
      const { error } = await ctx.supabaseAdmin
        .from('user_roles')
        .upsert<
          TablesInsert<'user_roles'>
        >({ user_id: userId, role: role as Role }, { onConflict: 'user_id' });
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  }),
};
