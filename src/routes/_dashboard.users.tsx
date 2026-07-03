import { InviteUserForm } from '#/components/auth/InviteUserForm';
import { roleFromSession } from '#/lib/authRole';
import { supabase } from '#/supabaseClient';
import {
  Box,
  CircularProgress,
  Grid,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { toast } from 'sonner';

export const Route = createFileRoute('/_dashboard/users')({
  // Admin-only surface. The parent _dashboard route already ensures a session
  // exists; here we additionally require the admin role. RLS + the admin-gated
  // manage-users / invite-user functions are the real boundary — this just
  // hides the UI.
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (roleFromSession(data.session) !== 'admin') {
      throw redirect({ to: '/' });
    }
  },
  component: RouteComponent,
});

// Keep in sync with the public.app_role enum (20260703021911_rbac.sql).
const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'underwriter', label: 'Underwriter' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'viewer', label: 'Viewer' },
] as const;

interface TeamMember {
  id: string;
  email: string | null;
  role: string | null;
  created_at: string;
}

const invokeManageUsers = async <T,>(
  body: Record<string, unknown>,
): Promise<T> => {
  const { data, error } = await supabase.functions.invoke('manage-users', {
    body,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
};

function RouteComponent() {
  const queryClient = useQueryClient();

  const members = useQuery({
    queryKey: ['team-members'],
    queryFn: () =>
      invokeManageUsers<{ users: TeamMember[] }>({ action: 'list' }).then(
        (d) => d.users,
      ),
  });

  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      invokeManageUsers({ action: 'setRole', user_id: userId, role }),
    onSuccess: () => {
      toast.success('Role updated');
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Grid container spacing={4}>
      <Grid size={12}>
        <Box>
          <Typography
            component='h1'
            sx={{ fontSize: 22, fontWeight: 700, mb: 0.5 }}
          >
            Team
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
            Manage who can access the workspace and what they can do.
          </Typography>
        </Box>
      </Grid>
      <Grid size={{ xs: 12, lg: 8 }}>
        {/* Members */}
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.25 }}>
            Members
          </Typography>
          <Paper
            variant='outlined'
            sx={{ borderRadius: 2, overflow: 'hidden' }}
          >
            {members.isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={22} />
              </Box>
            ) : members.error ? (
              <Box sx={{ p: 2 }}>
                <Typography sx={{ fontSize: 13, color: 'error.main' }}>
                  {(members.error as Error).message}
                </Typography>
              </Box>
            ) : (
              (members.data ?? []).map((m, i) => (
                <Box
                  key={m.id}
                  sx={(theme) => ({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    p: '10px 16px',
                    borderTop:
                      i === 0
                        ? 'none'
                        : `1px solid ${theme.vars.palette.borderSoft}`,
                  })}
                >
                  <Typography
                    sx={{
                      fontSize: 14,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {m.email ?? '(no email)'}
                  </Typography>
                  <TextField
                    select
                    size='small'
                    variant='standard'
                    value={m.role ?? ''}
                    disabled={setRole.isPending}
                    onChange={(e) =>
                      setRole.mutate({ userId: m.id, role: e.target.value })
                    }
                    sx={{ minWidth: 150, flexShrink: 0 }}
                  >
                    {m.role === null && (
                      <MenuItem value='' disabled>
                        No role
                      </MenuItem>
                    )}
                    {ROLE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
              ))
            )}
          </Paper>
        </Box>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        {/* Invite */}

        <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.25 }}>
          Invite a new member
        </Typography>
        <Paper
          variant='outlined'
          sx={{ borderRadius: 2, overflow: 'hidden', p: 3 }}
        >
          <InviteUserForm
            onInvited={() =>
              queryClient.invalidateQueries({ queryKey: ['team-members'] })
            }
          />
        </Paper>
      </Grid>
    </Grid>
  );
}
