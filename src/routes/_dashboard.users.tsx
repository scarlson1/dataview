import { Box, Chip, Grid, Paper, Typography } from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { InviteUserForm } from '#/components/auth/InviteUserForm';
import { useAuth } from '#/context/AuthContext';
import { roleFromSession } from '#/lib/authRole';
import { supabase } from '#/supabaseClient';

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

type ChipColor = 'primary' | 'info' | 'success' | 'default';

const ROLE_CHIP_COLOR: Record<string, ChipColor> = {
  admin: 'primary',
  underwriter: 'info',
  accounting: 'success',
  viewer: 'default',
};

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
  const { role: currentRole } = useAuth();
  // The route is already admin-gated, but keep the edit affordance explicitly
  // tied to the admin role so the grid stays read-only if it's ever reused or
  // the guard changes. RLS + the manage-users function remain the real check.
  const isAdmin = currentRole === 'admin';

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
  });

  const columns = useMemo<GridColDef<TeamMember>[]>(
    () => [
      {
        field: 'email',
        headerName: 'Email',
        flex: 1,
        minWidth: 220,
        valueGetter: (_value, row) => row.email ?? '(no email)',
      },
      {
        field: 'role',
        headerName: 'Role',
        width: 180,
        type: 'singleSelect',
        // Only admins get inline editing; everyone else sees a read-only cell.
        editable: isAdmin,
        valueOptions: ROLE_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
        })),
        valueFormatter: (value) =>
          ROLE_OPTIONS.find((o) => o.value === value)?.label ?? 'No role',
        renderCell: (params) => {
          const value = params.value as string | null;
          const label =
            ROLE_OPTIONS.find((o) => o.value === value)?.label ?? 'No role';
          return (
            <Chip
              size='small'
              label={label}
              color={value ? ROLE_CHIP_COLOR[value] ?? 'default' : 'default'}
              variant={value ? 'filled' : 'outlined'}
            />
          );
        },
      },
      {
        field: 'created_at',
        headerName: 'Joined',
        width: 140,
        valueFormatter: (value) =>
          value ? new Date(value as string).toLocaleDateString() : '',
      },
    ],
    [isAdmin],
  );

  // Persistence hook: called when an edited role cell is committed. Push the
  // change to the server and only resolve with the new row on success — a
  // rejected promise makes the grid revert the cell and fire the error handler.
  const processRowUpdate = async (
    newRow: TeamMember,
    oldRow: TeamMember,
  ): Promise<TeamMember> => {
    if (newRow.role === oldRow.role || !newRow.role) return oldRow;
    await setRole.mutateAsync({ userId: newRow.id, role: newRow.role });
    return newRow;
  };

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
          {members.error ? (
            <Paper
              variant='outlined'
              sx={{ borderRadius: 2, overflow: 'hidden', p: 2 }}
            >
              <Typography sx={{ fontSize: 13, color: 'error.main' }}>
                {(members.error as Error).message}
              </Typography>
            </Paper>
          ) : (
            <Paper
              variant='outlined'
              sx={{ borderRadius: 2, overflow: 'hidden' }}
            >
              <DataGrid<TeamMember>
                rows={members.data ?? []}
                columns={columns}
                getRowId={(row) => row.id}
                loading={members.isLoading}
                editMode='cell'
                processRowUpdate={processRowUpdate}
                onProcessRowUpdateError={(e: Error) => toast.error(e.message)}
                disableRowSelectionOnClick
                initialState={{
                  pagination: { paginationModel: { pageSize: 25 } },
                }}
                pageSizeOptions={[25, 50, 100]}
                sx={(theme) => ({
                  border: 0,
                  '--DataGrid-containerBackground': 'transparent',
                  '& .MuiDataGrid-columnHeaders': {
                    backgroundColor: theme.vars.palette.paper2,
                  },
                  '& .MuiDataGrid-columnHeaderTitle': {
                    fontWeight: 600,
                    fontSize: 13,
                  },
                  '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
                    outline: 'none',
                  },
                })}
              />
            </Paper>
          )}
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
