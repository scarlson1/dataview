/**
 * Rater run page: fill inputs (or pre-fill from a mapped record), run, and
 * see outputs + the step trace + the diagram with the executed path
 * highlighted. Below: runs history (rater_runs) with a per-run detail dialog
 * rendered against that run's own definition snapshot.
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { OutcomeBanner } from '#/components/raters/OutcomeBanner';
import { formatOutput, OutputCards } from '#/components/raters/OutputCards';
import {
  RaterRunPanel,
  type RaterRunState,
} from '#/components/raters/RaterRunPanel';
import { TracePanel } from '#/components/raters/TracePanel';
import { useAuth } from '#/context/AuthContext';
import { supabase } from '#/supabaseClient';
import {
  type RaterDefinition,
  type RaterOutcome,
  type RaterOutputValue,
  type RecordMapping,
  raterDefinitionSchema,
  type TraceStep,
} from '#/types/raters';

const RaterFlow = lazy(() =>
  import('#/components/raters/diagram/RaterFlow').then((m) => ({
    default: m.RaterFlow,
  })),
);

export const Route = createFileRoute('/_dashboard/raters/$id')({
  component: RaterDetail,
  loader: () => ({ crumb: 'rater' }),
});

interface RaterRow {
  id: string;
  name: string;
  description: string | null;
  definition: unknown;
  record_mapping: RecordMapping | null;
  archived_at: string | null;
}

interface RunRow {
  id: number;
  inputs: Record<string, unknown> | null;
  outputs: Record<string, RaterOutputValue> | null;
  outcome: RaterOutcome | null;
  definition_snapshot: unknown;
  trace: { steps: TraceStep[] } | null;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
}

function RaterDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const canWrite = can('raters', 'write');

  // Kept for the diagram column, which highlights the executed path; the panel
  // owns the run and reports each result back through onRunStateChange.
  const [runState, setRunState] = useState<RaterRunState>({
    outputs: null,
    outcome: null,
    trace: null,
    error: null,
  });
  const [viewingRun, setViewingRun] = useState<RunRow | null>(null);

  const rater = useQuery({
    queryKey: ['raters', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raters')
        .select(
          'id, name, description, definition, record_mapping, archived_at',
        )
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Rater not found');
      return data as unknown as RaterRow;
    },
  });

  const runs = useQuery({
    queryKey: ['rater_runs', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rater_runs')
        .select(
          'id, inputs, outputs, outcome, definition_snapshot, trace, duration_ms, error, created_at',
        )
        .eq('rater_id', id)
        .order('created_at', { ascending: false })
        .limit(25);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as RunRow[];
    },
  });

  if (rater.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress size={26} />
      </Box>
    );
  }
  if (rater.isError) {
    return <Alert severity='error'>{(rater.error as Error).message}</Alert>;
  }

  const row = rater.data as RaterRow;
  const parsed = raterDefinitionSchema.safeParse(row.definition);
  if (!parsed.success) {
    return (
      <Alert severity='error'>
        This rater's saved definition is invalid.
        {canWrite ? ' Open the editor to fix it.' : ''}
      </Alert>
    );
  }
  const definition: RaterDefinition = parsed.data;
  const mapping = row.record_mapping;

  return (
    <Box
      sx={{
        maxWidth: 1400,
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
      }}
    >
      {/* header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
            {row.name}
          </Typography>
          {row.description && (
            <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
              {row.description}
            </Typography>
          )}
        </Box>
        {canWrite && (
          <Button
            startIcon={<Pencil size={15} />}
            onClick={() => navigate({ to: '/raters/$id/edit', params: { id } })}
          >
            Edit
          </Button>
        )}
      </Box>

      {row.archived_at && (
        <Alert severity='warning'>This rater is archived.</Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            lg: 'minmax(420px, 1fr) minmax(380px, 1fr)',
          },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        {/* run column */}
        <Stack spacing={2.5}>
          <Paper variant='outlined' sx={{ borderRadius: 2, p: 2 }}>
            <RaterRunPanel
              raterId={id}
              definition={definition}
              recordMapping={mapping}
              archived={Boolean(row.archived_at)}
              allowManualPrefill
              onRunStateChange={setRunState}
            />
          </Paper>

          {/* runs history */}
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1 }}>
              Recent runs
            </Typography>
            {runs.isLoading ? (
              <CircularProgress size={20} />
            ) : (runs.data ?? []).length === 0 ? (
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                No runs yet.
              </Typography>
            ) : (
              <Paper
                variant='outlined'
                sx={{ borderRadius: 2, overflow: 'hidden' }}
              >
                {(runs.data ?? []).map((r, i) => (
                  <Box
                    key={r.id}
                    onClick={() => setViewingRun(r)}
                    sx={(t) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      px: 2,
                      py: 1.25,
                      cursor: 'pointer',
                      borderBottom:
                        i < (runs.data ?? []).length - 1
                          ? `1px solid ${t.palette.divider}`
                          : 'none',
                      '&:hover': { backgroundColor: t.vars.palette.hover },
                    })}
                  >
                    <Typography
                      sx={{
                        fontSize: 12.5,
                        color: 'text.secondary',
                        width: 170,
                      }}
                    >
                      {new Date(r.created_at).toLocaleString()}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 13,
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: r.error || r.outcome ? 'error.main' : undefined,
                      }}
                    >
                      {r.error
                        ? r.error
                        : r.outcome
                          ? `${r.outcome.decision.toUpperCase()}${r.outcome.reason ? ` — ${r.outcome.reason}` : ''}`
                          : Object.values(r.outputs ?? {})
                              .map((o) => `${o.label}: ${formatOutput(o)}`)
                              .join(' · ') || '—'}
                    </Typography>
                    {r.duration_ms !== null && (
                      <Typography
                        sx={{ fontSize: 11.5, color: 'text.secondary' }}
                      >
                        {r.duration_ms}ms
                      </Typography>
                    )}
                  </Box>
                ))}
              </Paper>
            )}
          </Box>
        </Stack>

        {/* diagram column */}
        <Paper
          variant='outlined'
          sx={{ borderRadius: 2, position: 'sticky', top: 16, p: 2 }}
        >
          <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1 }}>
            Logic
          </Typography>
          <Suspense fallback={<Box sx={{ height: 480 }} />}>
            <RaterFlow definition={definition} trace={runState.trace} />
          </Suspense>
        </Paper>
      </Box>

      {/* run detail dialog — rendered against the run's own snapshot */}
      <Dialog
        open={Boolean(viewingRun)}
        onClose={() => setViewingRun(null)}
        fullWidth
        maxWidth='md'
      >
        <DialogTitle sx={{ fontSize: 16 }}>
          Run ·{' '}
          {viewingRun ? new Date(viewingRun.created_at).toLocaleString() : ''}
        </DialogTitle>
        <DialogContent>
          {viewingRun && (
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              {viewingRun.error && (
                <Alert severity='error'>{viewingRun.error}</Alert>
              )}
              {viewingRun.outcome && (
                <OutcomeBanner outcome={viewingRun.outcome} />
              )}
              {viewingRun.inputs &&
                Object.keys(viewingRun.inputs).length > 0 && (
                  <Box>
                    <Typography
                      sx={{ fontSize: 12.5, fontWeight: 600, mb: 0.5 }}
                    >
                      Inputs
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontFamily: 'monospace' }}>
                      {Object.entries(viewingRun.inputs)
                        .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
                        .join('   ')}
                    </Typography>
                  </Box>
                )}
              {viewingRun.outputs &&
                Object.keys(viewingRun.outputs).length > 0 && (
                  <OutputCards outputs={viewingRun.outputs} />
                )}
              {viewingRun.trace?.steps && (
                <Box>
                  <Typography
                    sx={{ fontSize: 12.5, fontWeight: 600, mb: 0.75 }}
                  >
                    Step trace
                  </Typography>
                  <TracePanel steps={viewingRun.trace.steps} />
                </Box>
              )}
              {(() => {
                const snap = raterDefinitionSchema.safeParse(
                  viewingRun.definition_snapshot,
                );
                return snap.success ? (
                  <Box>
                    <Typography
                      sx={{ fontSize: 12.5, fontWeight: 600, mb: 0.75 }}
                    >
                      Logic at run time
                    </Typography>
                    <Suspense fallback={null}>
                      <RaterFlow
                        definition={snap.data}
                        trace={viewingRun.trace?.steps}
                        height={340}
                      />
                    </Suspense>
                  </Box>
                ) : null;
              })()}
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
