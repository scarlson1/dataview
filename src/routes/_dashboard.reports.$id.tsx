/**
 * Saved report detail — run the stored SQL (no LLM) via `run-report`, render
 * through the stored `columns` meta (same kind→cell rendering as the schema
 * tables), and export to CSV. Refine/Repair (write-gated) re-enter the builder
 * in that mode; a run error surfaces a Repair affordance.
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { DataGrid } from '@mui/x-data-grid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Download, Play, Sparkles, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ReportBuilder } from '#/components/reports/ReportBuilder';
import { SqlBlock } from '#/components/reports/SqlBlock';
import { useAuth } from '#/context/AuthContext';
import { columnsFromMeta } from '#/data/columns';
import { downloadCsv } from '#/lib/csv';
import { type RunReportError, runReport } from '#/lib/reports';
import { supabase } from '#/supabaseClient';
import { MONO_FONT } from '#/theme/tokens';
import type { ReportColumn, RunReportSuccess } from '#/types/reports';

export const Route = createFileRoute('/_dashboard/reports/$id')({
  component: ReportDetail,
});

interface ReportRow {
  id: string;
  name: string;
  description: string | null;
  prompt: string | null;
  sql: string;
  columns: ReportColumn[] | null;
  last_run_at: string | null;
}

type BuilderMode = { mode: 'refine' } | { mode: 'repair'; error: string };

const formatWhen = (value: string | null): string => {
  if (!value) return 'never';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

function ReportDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const canWrite = can('reports', 'write');

  const [result, setResult] = useState<RunReportSuccess | null>(null);
  const [runError, setRunError] = useState<RunReportError | null>(null);
  const [builder, setBuilder] = useState<BuilderMode | null>(null);

  const report = useQuery({
    queryKey: ['report', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('id, name, description, prompt, sql, columns, last_run_at')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      return data as unknown as ReportRow;
    },
  });

  const run = useMutation({
    mutationFn: () => runReport({ reportId: id, cap: 'preview' }),
    onSuccess: (res) => {
      setResult(res);
      setRunError(null);
      // The server bumps last_run_at; refetch so the display updates.
      queryClient.invalidateQueries({ queryKey: ['report', id] });
    },
    onError: (e: RunReportError) => {
      setResult(null);
      setRunError(e);
    },
  });

  const exportCsv = useMutation({
    mutationFn: async () => {
      const res = await runReport({ reportId: id, cap: 'export' });
      if (res.rows.length === 0) throw new Error('No rows to export');
      const cols = report.data?.columns ?? undefined;
      const csvColumns = cols?.map((c) => ({ field: c.field, label: c.label }));
      const stamp = new Date().toISOString().slice(0, 10);
      const slug =
        report.data?.name.toLowerCase().replace(/\s+/g, '-') ?? 'report';
      downloadCsv(`${slug}-${stamp}`, res.rows, csvColumns);
      return res.rowCount;
    },
    onSuccess: (n) => toast.success(`Exported ${n.toLocaleString()} row(s)`),
    onError: (e: Error) => toast.error(e.message),
  });

  const data = report.data;
  const gridColumns = useMemo(
    () => (data?.columns ? columnsFromMeta(data.columns) : []),
    [data?.columns],
  );
  const rows = useMemo(
    () => (result?.rows ?? []).map((row, i) => ({ __rid: i, ...row })),
    [result],
  );

  if (report.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress size={26} />
      </Box>
    );
  }
  if (report.isError || !data) {
    return (
      <Box sx={{ maxWidth: 900 }}>
        <BackButton onClick={() => navigate({ to: '/reports' })} />
        <Typography color='error'>
          {(report.error as Error)?.message ?? 'Report not found.'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1100 }}>
      <BackButton onClick={() => navigate({ to: '/reports' })} />

      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          mb: 2,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
            {data.name}
          </Typography>
          {data.description && (
            <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
              {data.description}
            </Typography>
          )}
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.5 }}>
            Last run: {formatWhen(data.last_run_at)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <Button
            variant='contained'
            startIcon={<Play size={16} />}
            disabled={run.isPending}
            onClick={() => run.mutate()}
          >
            Run
          </Button>
          <Button
            variant='outlined'
            startIcon={<Download size={16} />}
            disabled={exportCsv.isPending}
            onClick={() => exportCsv.mutate()}
          >
            CSV
          </Button>
          {canWrite && (
            <Button
              variant='outlined'
              startIcon={<Sparkles size={16} />}
              onClick={() => setBuilder({ mode: 'refine' })}
            >
              Refine
            </Button>
          )}
        </Box>
      </Box>

      {builder && (
        <Paper variant='outlined' sx={{ borderRadius: 2, p: 2.5, mb: 2 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600, mb: 1.5 }}>
            {builder.mode === 'refine' ? 'Refine report' : 'Repair report'}
          </Typography>
          <ReportBuilder
            mode={builder.mode}
            reportId={id}
            runtimeError={builder.mode === 'repair' ? builder.error : undefined}
            initialPrompt={builder.mode === 'refine' ? '' : (data.prompt ?? '')}
            onCancel={() => setBuilder(null)}
            onSaved={() => {
              setBuilder(null);
              setResult(null);
              setRunError(null);
              queryClient.invalidateQueries({ queryKey: ['report', id] });
            }}
          />
        </Paper>
      )}

      <Box sx={{ mb: 2 }}>
        <SqlBlock sql={data.sql} defaultOpen={false} />
      </Box>

      {runError && (
        <Alert
          severity='error'
          sx={{ mb: 2, fontFamily: MONO_FONT, fontSize: 13 }}
          action={
            canWrite ? (
              <Button
                color='inherit'
                size='small'
                startIcon={<Wrench size={15} />}
                onClick={() =>
                  setBuilder({ mode: 'repair', error: runError.message })
                }
              >
                Repair with AI
              </Button>
            ) : undefined
          }
        >
          {runError.message}
          {runError.hint ? ` — ${runError.hint}` : ''}
        </Alert>
      )}

      {result && (
        <>
          {result.truncated && (
            <Alert severity='info' sx={{ mb: 1 }}>
              Showing the first {result.rowCount} rows. Export to CSV for the
              full result.
            </Alert>
          )}
          <Paper
            variant='outlined'
            sx={{ borderRadius: 2, overflow: 'hidden' }}
          >
            <DataGrid
              rows={rows}
              columns={gridColumns}
              getRowId={(row) => (row as { __rid: number }).__rid}
              loading={run.isPending}
              disableRowSelectionOnClick
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
              }}
              pageSizeOptions={[25, 50, 100]}
              sx={(theme) => ({
                border: 0,
                height: 'calc(100vh - 360px)',
                minHeight: 400,
                '--DataGrid-containerBackground': 'transparent',
                '& .MuiDataGrid-columnHeaders': {
                  backgroundColor: theme.vars.palette.paper2,
                },
                '& .MuiDataGrid-columnHeaderTitle': {
                  fontWeight: 600,
                  fontSize: 13,
                },
              })}
            />
          </Paper>
        </>
      )}
    </Box>
  );
}

const BackButton = ({ onClick }: { onClick: () => void }) => (
  <Button
    size='small'
    startIcon={<ArrowLeft size={16} />}
    onClick={onClick}
    sx={{ mb: 2 }}
  >
    Reports
  </Button>
);
