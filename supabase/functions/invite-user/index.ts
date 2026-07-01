// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  // 'user' requires a signed-in caller's JWT (sent automatically by
  // supabase.functions.invoke() from the browser). This is what lets us check
  // *who* is asking before we hand out an admin-only invite.
  fetch: withSupabase({ auth: ["user"] }, async (req, ctx) => {
    // Gate invite-sending to admins. Adjust this to your actual authorization
    // model — this assumes admin users carry `app_metadata.role === "admin"`,
    // set server-side via:
    //   ctx.supabaseAdmin.auth.admin.updateUserById(id, { app_metadata: { role: "admin" } })
    // Never check user_metadata here — it's user-editable and unsafe for authorization.
    if (ctx.jwtClaims.app_metadata?.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: { email?: unknown; redirectTo?: unknown };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(email)) {
      return Response.json({ error: "A valid email is required" }, { status: 400 });
    }

    // Must be on the auth.additional_redirect_urls allow-list, or Supabase
    // silently falls back to site_url instead of erroring.
    const redirectTo =
      typeof body.redirectTo === "string" ? body.redirectTo : undefined;

    // ctx.supabaseAdmin bypasses RLS / uses the secret key — required for
    // admin.inviteUserByEmail regardless of which auth mode the caller matched.
    const { data, error } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo },
    );

    if (error) {
      // e.g. 422 when the email is already registered — surface a clean
      // message instead of leaking the raw GoTrue error shape.
      const status =
        error.status && error.status >= 400 && error.status < 500
          ? error.status
          : 500;
      return Response.json({ error: error.message }, { status });
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
