import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { roleFromSession } from '#/lib/authRole';
import { supabase } from '#/supabaseClient';

export type PermAction = 'read' | 'write';

interface AuthContextValue {
  role: string | null;
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /**
   * UX-only permission check mirroring the DB `authorize()` (RLS is the real
   * boundary). Returns false until the role's permissions have loaded.
   */
  can: (resource: string, action: PermAction) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface Permissions {
  read: Set<string>;
  write: Set<string>;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Permissions>({
    read: new Set(),
    write: new Set(),
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setRole(roleFromSession(session));
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setRole(roleFromSession(session));
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Near-instant role propagation: subscribe to this user's own user_roles row
  // and re-mint the JWT when an admin changes their role. refreshSession() runs
  // the access-token hook again, firing onAuthStateChange above with the new
  // `user_role` claim, so UI + RLS update in ~1-2s without a re-login.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user_roles:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void supabase.auth.refreshSession();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  // Load the current role's permission matrix (RLS scopes it to own role). Runs
  // whenever the role changes — including after the Realtime-triggered refresh.
  useEffect(() => {
    if (!role) {
      setPermissions({ read: new Set(), write: new Set() });
      return;
    }

    let cancelled = false;
    supabase
      .from('role_permissions')
      .select('resource, can_read, can_write')
      .then(({ data }) => {
        if (cancelled) return;
        const read = new Set<string>();
        const write = new Set<string>();
        for (const row of data ?? []) {
          if (row.can_read) read.add(row.resource);
          if (row.can_write) write.add(row.resource);
        }
        setPermissions({ read, write });
      });

    return () => {
      cancelled = true;
    };
  }, [role]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const can = useCallback(
    (resource: string, action: PermAction) => permissions[action].has(resource),
    [permissions],
  );

  const value = useMemo(
    () => ({ role, user, session, loading, signOut, can }),
    [role, user, session, loading, signOut, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);

  if (!ctx)
    throw new Error('useAuth must be used with AuthContext as a parent');

  return ctx;
};
