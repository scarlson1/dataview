/**
 * Saved raters list. Follows the Reports page visual pattern (title, outlined
 * card, row list). Write actions are hidden for read-only roles; RLS is the
 * real boundary.
 */

import { useAuth } from '#/context/AuthContext';
import { supabase } from '#/supabaseClient';
import type { RaterListRow } from '#/types/raters';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Archive, MoreVertical, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export const Route = createFileRoute('/_dashboard/raters-admin/')({
  component: RatersList,
  // loader: () => ({ crumb: 'raters' }),
});

const formatWhen = (value: string | null): string => {
  if (!value) return 'never';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

function RatersList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canWrite = can('raters', 'write');

  const [menuFor, setMenuFor] = useState<{
    anchor: HTMLElement;
    rater: RaterListRow;
  } | null>(null);

  const raters = useQuery({
    queryKey: ['raters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raters')
        .select('id, name, description, last_run_at, updated_at, created_at')
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as RaterListRow[];
    },
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('raters')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Rater archived');
      queryClient.invalidateQueries({ queryKey: ['raters'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = raters.data ?? [];

  return (
    <Box
      sx={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 3 }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 700 }}>Raters</Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
            Build rating logic from inputs, lookup tables, conditions, and
            formulas — then run it against submissions.
          </Typography>
        </Box>
        {canWrite && (
          <Button
            variant='contained'
            startIcon={
              <Plus size={16} color={'var(--variant-containedColor)'} />
            }
            onClick={() => navigate({ to: '/raters-admin/new' })}
          >
            New rater
          </Button>
        )}
      </Box>

      {raters.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress size={26} />
        </Box>
      ) : raters.isError ? (
        <Typography color='error' sx={{ fontSize: 13 }}>
          {(raters.error as Error).message}
        </Typography>
      ) : list.length === 0 ? (
        <Paper
          variant='outlined'
          sx={{ borderRadius: 2, p: 4, textAlign: 'center' }}
        >
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
            No raters yet.{canWrite ? ' Create one to get started.' : ''}
          </Typography>
        </Paper>
      ) : (
        <Paper variant='outlined' sx={{ borderRadius: 2, overflow: 'hidden' }}>
          {list.map((rater, i) => (
            <Box
              key={rater.id}
              onClick={() =>
                navigate({ to: '/raters-admin/$id', params: { id: rater.id } })
              }
              sx={(t) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                px: 2,
                py: 1.75,
                cursor: 'pointer',
                borderBottom:
                  i < list.length - 1
                    ? `1px solid ${t.palette.divider}`
                    : 'none',
                '&:hover': { backgroundColor: t.vars.palette.hover },
              })}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14.5, fontWeight: 600 }}>
                  {rater.name}
                </Typography>
                {rater.description && (
                  <Typography
                    sx={{
                      fontSize: 13,
                      color: 'text.secondary',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {rater.description}
                  </Typography>
                )}
              </Box>
              <Typography
                sx={{
                  fontSize: 12.5,
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                }}
              >
                Last run: {formatWhen(rater.last_run_at)}
              </Typography>
              {canWrite && (
                <IconButton
                  size='small'
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuFor({ anchor: e.currentTarget, rater });
                  }}
                >
                  <MoreVertical size={16} />
                </IconButton>
              )}
            </Box>
          ))}
        </Paper>
      )}

      <Menu
        anchorEl={menuFor?.anchor}
        open={Boolean(menuFor)}
        onClose={() => setMenuFor(null)}
      >
        <MenuItem
          onClick={() => {
            if (menuFor) {
              navigate({
                to: '/raters-admin/$id/edit',
                params: { id: menuFor.rater.id },
              });
            }
            setMenuFor(null);
          }}
        >
          <Pencil size={15} style={{ marginRight: 8 }} />
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuFor) archive.mutate(menuFor.rater.id);
            setMenuFor(null);
          }}
        >
          <Archive size={15} style={{ marginRight: 8 }} />
          Archive
        </MenuItem>
      </Menu>
    </Box>
  );
}
