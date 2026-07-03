// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Keep in sync with the public.app_role enum (20260703021911_rbac.sql).
const ROLES = ["admin", "underwriter", "accounting", "viewer"] as const;
type Role = (typeof ROLES)[number];

export default {
  // 'user' requires a signed-in caller's JWT (sent automatically by
  // supabase.functions.invoke() from the browser). Inviting a user and
  // assigning their role is an admin-only action, so we gate on the caller's
  // role below.
  fetch: withSupabase({ auth: ["user"] }, async (req, ctx) => {
    // Authorize the caller as an admin. The JWT carries a `user_role` claim,
    // but it can be up to jwt_expiry stale, so check user_roles (the source of
    // truth) via the admin client for this privilege-escalation surface.
    const callerId = ctx.jwtClaims?.sub;
    if (!callerId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: caller, error: callerError } = await ctx.supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .maybeSingle();
    if (callerError) {
      return Response.json({ error: callerError.message }, { status: 500 });
    }
    if (caller?.role !== "admin") {
      return Response.json({ error: "Admin role required" }, { status: 403 });
    }

    let body: { email?: unknown; role?: unknown; redirectTo?: unknown };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const email = typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";
    if (!EMAIL_RE.test(email)) {
      return Response.json({ error: "A valid email is required" }, {
        status: 400,
      });
    }

    const role = body.role;
    if (typeof role !== "string" || !ROLES.includes(role as Role)) {
      return Response.json({ error: "A valid role is required" }, {
        status: 400,
      });
    }

    // Must be on the auth.additional_redirect_urls allow-list, or Supabase
    // silently falls back to site_url instead of erroring.
    const redirectTo = typeof body.redirectTo === "string"
      ? body.redirectTo
      : undefined;

    // ctx.supabaseAdmin bypasses RLS / uses the secret key — required for
    // admin.inviteUserByEmail regardless of which auth mode the caller matched.
    const { data, error } = await ctx.supabaseAdmin.auth.admin
      .inviteUserByEmail(
        email,
        { redirectTo },
      );

    if (error) {
      // e.g. 422 when the email is already registered — surface a clean
      // message instead of leaking the raw GoTrue error shape.
      const status = error.status && error.status >= 400 && error.status < 500
        ? error.status
        : 500;
      return Response.json({ error: error.message }, { status });
    }

    // Persist the chosen role now that we have the invited user's id. Upsert on
    // user_id handles re-invites and delete-then-re-invite cleanly.
    const { error: roleError } = await ctx.supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.user.id, role }, { onConflict: "user_id" });
    if (roleError) {
      return Response.json(
        { error: `User invited but role assignment failed: ${roleError.message}` },
        { status: 500 },
      );
    }

    return Response.json({ user: data.user });
  }),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Sign in from the app so you have a session, then call it from the browser console:

  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: { email: 'newuser@example.com', redirectTo: 'http://127.0.0.1:3000/accept-invite' },
  })

  Or with curl, using a real user access_token (from `supabase.auth.getSession()`):

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/invite-user' \
    --header 'Authorization: Bearer <user-access-token>' \
    --header 'Content-Type: application/json' \
    --data '{"email":"newuser@example.com","redirectTo":"http://127.0.0.1:3000/accept-invite"}'

*/
