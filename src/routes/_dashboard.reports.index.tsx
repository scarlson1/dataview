/**
 * Saved reports list + the "New report" AI builder. Follows the Exports page
 * visual pattern (title, outlined card, row list). Write actions (new / rename
 * / archive) are hidden for the viewer role; RLS is the real boundary.
 */

import { ReportBuilder } from '#/components/reports/ReportBuilder';
import { useAuth } from '#/context/AuthContext';
import { supabase } from '#/supabaseClient';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Archive, MoreVertical, Pencil, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export const Route = createFileRoute('/_dashboard/reports/')({
  component: ReportsList,
  loader: () => ({ crumb: 'reports' }),
});

interface ReportRow {
  id: string;
  name: string;
  description: string | null;
  last_run_at: string | null;
  created_at: string;
}

const formatWhen = (value: string | null): string => {
  if (!value) return 'never';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

function ReportsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canWrite = can('reports', 'write');

  const [building, setBuilding] = useState(false);
  const [menuFor, setMenuFor] = useState<{
    anchor: HTMLElement;
    report: ReportRow;
  } | null>(null);
  const [renaming, setRenaming] = useState<ReportRow | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const reports = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('id, name, description, last_run_at, created_at')
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as ReportRow[];
    },
  });

  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from('reports')
        .update({ name })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Report renamed');
      setRenaming(null);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reports')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Report archived');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = reports.data ?? [];

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
          <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
            Reports
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
            Describe a report in plain English; the AI writes and runs the SQL.
            Saved reports re-run without the AI.
          </Typography>
        </Box>
        {canWrite && !building && (
          <Button
            variant='contained'
            startIcon={
              <Plus size={16} color={'var(--variant-containedColor)'} />
            }
            onClick={() => setBuilding(true)}
          >
            New report
          </Button>
        )}
      </Box>

      {building && (
        <Paper variant='outlined' sx={{ borderRadius: 2, p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Sparkles size={18} />
            <Typography sx={{ fontSize: 16, fontWeight: 600 }}>
              New report
            </Typography>
          </Box>
          <ReportBuilder
            mode='create'
            onCancel={() => setBuilding(false)}
            onSaved={(id) => navigate({ to: '/reports/$id', params: { id } })}
          />
        </Paper>
      )}

      {reports.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress size={26} />
        </Box>
      ) : reports.isError ? (
        <Typography color='error' sx={{ fontSize: 13 }}>
          {(reports.error as Error).message}
        </Typography>
      ) : list.length === 0 ? (
        <Paper
          variant='outlined'
          sx={{ borderRadius: 2, p: 4, textAlign: 'center' }}
        >
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
            No saved reports yet.
            {canWrite ? ' Create one to get started.' : ''}
          </Typography>
        </Paper>
      ) : (
        <Paper variant='outlined' sx={{ borderRadius: 2, overflow: 'hidden' }}>
          {list.map((report, i) => (
            <Box
              key={report.id}
              onClick={() =>
                navigate({ to: '/reports/$id', params: { id: report.id } })
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
                  {report.name}
                </Typography>
                {report.description && (
                  <Typography
                    sx={{
                      fontSize: 13,
                      color: 'text.secondary',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {report.description}
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
                Last run: {formatWhen(report.last_run_at)}
              </Typography>
              {canWrite && (
                <IconButton
                  size='small'
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuFor({ anchor: e.currentTarget, report });
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
              setRenaming(menuFor.report);
              setRenameValue(menuFor.report.name);
            }
            setMenuFor(null);
          }}
        >
          <Pencil size={15} style={{ marginRight: 8 }} />
          Rename
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuFor) archive.mutate(menuFor.report.id);
            setMenuFor(null);
          }}
        >
          <Archive size={15} style={{ marginRight: 8 }} />
          Archive
        </MenuItem>
      </Menu>

      <Dialog
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        fullWidth
        maxWidth='xs'
      >
        <DialogTitle>Rename report</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenaming(null)}>Cancel</Button>
          <Button
            variant='contained'
            disabled={!renameValue.trim() || rename.isPending}
            onClick={() =>
              renaming &&
              rename.mutate({ id: renaming.id, name: renameValue.trim() })
            }
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
