import type { Session } from '@supabase/supabase-js';
import { jwtDecode } from 'jwt-decode';

/**
 * The custom access token hook injects `user_role` into the JWT
 * (supabase/migrations/20260703023018_auth-hook.sql), so the role rides along
 * with the session. Shared by AuthContext and route guards (which run outside
 * React and can't use the useAuth hook).
 */
export const roleFromSession = (session: Session | null): string | null => {
  if (!session) return null;
  try {
    const { user_role } = jwtDecode<{ user_role?: string | null }>(
      session.access_token,
    );
    return user_role ?? null;
  } catch {
    return null;
  }
};
