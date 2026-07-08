/**
 * The AI report builder. Streams the `generate-report` agent's progress
 * (`useChat` + a `DefaultChatTransport` pointed at the edge function) and, on
 * terminal success, lets the user name/save the report. Also drives `refine`
 * and `repair` of an existing report (reached from the detail page).
 *
 * The server reads `prompt` + mode fields from the JSON body, NOT from a
 * messages array — so `prepareSendMessagesRequest` reshapes each request into
 * `{ mode, prompt, reportId, runtimeError }` and drops the messages entirely.
 */

import { useAuth } from '#/context/AuthContext';
import { columnsFromMeta } from '#/data/columns';
import type { Json } from '#/data/database.types';
import { functionUrl, reportAuthHeaders, runReport } from '#/lib/reports';
import { supabase } from '#/supabaseClient';
import { MONO_FONT } from '#/theme/tokens';
import type {
  FailureData,
  PreviewData,
  ReportColumn,
  ReportData,
  ReportDataParts,
  ReportMode,
  SqlData,
  StepData,
} from '#/types/reports';
import { useChat } from '@ai-sdk/react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { DefaultChatTransport, type UIMessage } from 'ai';
import {
  ChevronDown,
  Play,
  Save,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SqlBlock } from './SqlBlock';

type UIReportMessage = UIMessage<unknown, ReportDataParts>;

interface ReportBuilderProps {
  mode: ReportMode;
  /** Existing report id — required for `refine` and `repair`. */
  reportId?: string;
  /** For `repair`: the runtime error the saved report now throws. */
  runtimeError?: string;
  /** Prefill the prompt box (e.g. the report's original prompt for refine). */
  initialPrompt?: string;
  /** Called after a successful save so the caller can navigate / refetch. */
  onSaved?: (reportId: string) => void;
  onCancel?: () => void;
}

// Data parts accumulated from the stream. The AI SDK exposes them both on the
// assistant message's `parts` array and via the `onData` callback; the callback
// is the simplest way to keep the latest of each.
interface StreamState {
  steps: string[];
  sql: string | null;
  preview: PreviewData | null;
  report: ReportData | null;
  failure: FailureData | null;
}

const EMPTY_STREAM: StreamState = {
  steps: [],
  sql: null,
  preview: null,
  report: null,
  failure: null,
};

const previewColumns = (fields: string[]): GridColDef[] =>
  fields.map((field) => ({
    field,
    headerName: field,
    flex: 1,
    minWidth: 140,
  }));

const withRowIds = (rows: Record<string, unknown>[]) =>
  rows.map((row, i) => ({ __rid: i, ...row }));

export const ReportBuilder = ({
  mode,
  reportId,
  runtimeError,
  initialPrompt = '',
  onSaved,
  onCancel,
}: ReportBuilderProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [stream, setStream] = useState<StreamState>(EMPTY_STREAM);
  // Editable candidate SQL (failure path — user hand-fixes it) plus a preview
  // produced by re-running it through run-report.
  const [editSql, setEditSql] = useState('');
  const [handRun, setHandRun] = useState<PreviewData | null>(null);
  // Editable name/description shown once a report is proposed.
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIReportMessage>({
        api: functionUrl('generate-report'),
        headers: reportAuthHeaders,
        // The server ignores the messages array — it reads these fields from
        // the JSON body. Pull the prompt out of the last user message and send
        // only the mode envelope.
        prepareSendMessagesRequest: ({ messages, body }) => {
          const last = messages.at(-1);
          const text = last?.parts
            .filter((p) => p.type === 'text')
            .map((p) => p.text)
            .join('\n');
          return {
            body: {
              mode,
              prompt: text,
              reportId,
              runtimeError,
              ...body,
            },
          };
        },
      }),
    [mode, reportId, runtimeError],
  );

  const { sendMessage, status, error } = useChat<UIReportMessage>({
    transport,
    onData: (part) => {
      switch (part.type) {
        case 'data-step':
          setStream((s) => ({
            ...s,
            steps: [...s.steps, (part.data as StepData).label],
          }));
          break;
        case 'data-sql':
          setStream((s) => ({ ...s, sql: (part.data as SqlData).sql }));
          break;
        case 'data-preview':
          setStream((s) => ({ ...s, preview: part.data as PreviewData }));
          break;
        case 'data-report': {
          const report = part.data as ReportData;
          setStream((s) => ({ ...s, report }));
          setName(report.name);
          setDescription(report.description);
          break;
        }
        case 'data-failure': {
          const failure = part.data as FailureData;
          setStream((s) => ({ ...s, failure }));
          setEditSql(failure.candidateSql ?? '');
          break;
        }
      }
    },
  });

  const busy = status === 'submitted' || status === 'streaming';

  // Surface the quota (429) message clearly. The transport reads the error body
  // from the failed response and puts it on `error.message`.
  const quotaHit = /quota_exceeded|25\/day|quota/i.test(error?.message ?? '');

  const start = () => {
    if (!prompt.trim()) return;
    setStream(EMPTY_STREAM);
    setHandRun(null);
    void sendMessage({ text: prompt.trim() });
  };

  // Re-run the hand-edited candidate SQL through run-report for a fresh preview.
  const handRunMutation = useMutation({
    mutationFn: () => runReport({ sql: editSql, cap: 'preview' }),
    onSuccess: (res) =>
      setHandRun({
        rows: res.rows,
        fields: res.fields,
        rowCount: res.rowCount,
        truncated: res.truncated,
      }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Persist the report. create → insert; refine/repair → update the existing
  // row. RLS is the real gate; the UI is already role-gated upstream.
  const save = useMutation({
    mutationFn: async ({
      finalName,
      finalDescription,
      finalSql,
      columns,
    }: {
      finalName: string;
      finalDescription: string;
      finalSql: string;
      columns: ReportColumn[];
    }) => {
      if (mode === 'create') {
        const { data, error: insertError } = await supabase
          .from('reports')
          .insert({
            name: finalName,
            description: finalDescription || null,
            prompt: prompt.trim() || null,
            sql: finalSql,
            columns: columns as unknown as Json, // as Json[],
            created_by: user?.id ?? null,
          })
          .select('id')
          .single();
        if (insertError) throw new Error(insertError.message);
        return data.id;
      }
      if (!reportId) throw new Error('Missing report id.');
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          name: finalName,
          description: finalDescription || null,
          sql: finalSql,
          columns: columns as unknown as Json,
        })
        .eq('id', reportId);
      if (updateError) throw new Error(updateError.message);
      return reportId;
    },
    onSuccess: (id) => {
      toast.success('Report saved');
      if (onSaved) onSaved(id);
      else navigate({ to: '/reports/$id', params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const report = stream.report;
  const gridColumns = useMemo(
    () => (report ? columnsFromMeta(report.columns) : []),
    [report],
  );

  return (
    <Stack spacing={2.5}>
      {/* Prompt */}
      <Box>
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            mode === 'refine'
              ? 'Describe the change (e.g. "add a total row and filter to surplus lines")'
              : 'Describe the report in plain English (e.g. "open AR by client, bucketed by month")'
          }
          disabled={busy}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') start();
          }}
        />
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button
            variant='contained'
            startIcon={<Sparkles size={16} />}
            disabled={busy || !prompt.trim()}
            onClick={start}
          >
            {mode === 'create' ? 'Generate' : 'Regenerate'}
          </Button>
          {onCancel && (
            <Button
              variant='text'
              startIcon={<X size={16} />}
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </Box>
      </Box>

      {quotaHit && (
        <Alert severity='warning'>
          You've hit the daily report-generation limit (25/day). Try again
          tomorrow, or run and edit an existing report's SQL.
        </Alert>
      )}
      {error && !quotaHit && (
        <Alert severity='error' sx={{ fontFamily: MONO_FONT, fontSize: 13 }}>
          {error.message}
        </Alert>
      )}

      {/* Progress steps */}
      {(busy || stream.steps.length > 0) && (
        <Paper variant='outlined' sx={{ borderRadius: 2, p: 2 }}>
          {busy && <LinearProgress sx={{ mb: 1.5, borderRadius: 1 }} />}
          <Stack spacing={0.5}>
            {stream.steps.map((label, i) => {
              const latest = i === stream.steps.length - 1 && busy;
              return (
                <Typography
                  // Steps are an append-only log; index is a stable key.
                  // biome-ignore lint/suspicious/noArrayIndexKey: append-only log
                  key={i}
                  sx={{
                    fontSize: 13,
                    color: latest ? 'text.primary' : 'text.secondary',
                    fontWeight: latest ? 600 : 400,
                  }}
                >
                  {label}
                </Typography>
              );
            })}
          </Stack>
        </Paper>
      )}

      {/* Candidate SQL (in-flight) */}
      {stream.sql && !report && (
        <SqlBlock sql={stream.sql} defaultOpen={false} label='Candidate SQL' />
      )}

      {/* In-flight preview (plain columns) */}
      {stream.preview && !report && (
        <PreviewGrid
          title={`Preview — ${stream.preview.rowCount} row(s)${stream.preview.truncated ? '+' : ''}`}
          columns={previewColumns(stream.preview.fields)}
          rows={stream.preview.rows}
        />
      )}

      {/* Graceful failure — let the user hand-fix the candidate SQL */}
      {stream.failure && !report && (
        <Paper variant='outlined' sx={{ borderRadius: 2, p: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
            <TriangleAlert size={18} color='var(--mui-palette-warning-main)' />
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
              Couldn't finish automatically
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
            {stream.failure.message}
          </Typography>
          {stream.failure.lastError && (
            <Alert
              severity='error'
              sx={{ fontFamily: MONO_FONT, fontSize: 12.5, mb: 1.5 }}
            >
              {stream.failure.lastError}
            </Alert>
          )}
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, mb: 0.5 }}>
            Edit the SQL and run it yourself:
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={4}
            value={editSql}
            onChange={(e) => setEditSql(e.target.value)}
            slotProps={{
              input: { sx: { fontFamily: MONO_FONT, fontSize: 12.5 } },
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button
              variant='outlined'
              startIcon={<Play size={15} />}
              disabled={!editSql.trim() || handRunMutation.isPending}
              onClick={() => handRunMutation.mutate()}
            >
              Run
            </Button>
            <Button
              variant='contained'
              startIcon={<Save size={15} />}
              disabled={!editSql.trim() || !name.trim() || save.isPending}
              onClick={() =>
                save.mutate({
                  finalName: name || 'Untitled report',
                  finalDescription: description,
                  finalSql: editSql,
                  columns: fieldsToColumns(handRun?.fields ?? []),
                })
              }
            >
              Save
            </Button>
          </Box>
          {(!name.trim() || !handRun) && (
            <Box sx={{ mt: 1.5 }}>
              <TextField
                label='Report name'
                size='small'
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                sx={{ mb: 1 }}
              />
              <TextField
                label='Description'
                size='small'
                fullWidth
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Box>
          )}
          {handRun && (
            <Box sx={{ mt: 1.5 }}>
              <PreviewGrid
                title={`Preview — ${handRun.rowCount} row(s)${handRun.truncated ? '+' : ''}`}
                columns={previewColumns(handRun.fields)}
                rows={handRun.rows}
              />
            </Box>
          )}
        </Paper>
      )}

      {/* Terminal success — name/describe + typed preview + save */}
      {report && (
        <Paper variant='outlined' sx={{ borderRadius: 2, p: 2.5 }}>
          <Stack spacing={2}>
            <TextField
              label='Report name'
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField
              label='Description'
              fullWidth
              multiline
              minRows={1}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <SqlBlock sql={report.sql} defaultOpen={false} label='SQL' />
            {stream.preview && (
              <PreviewGrid
                title={`Preview — ${stream.preview.rowCount} row(s)${stream.preview.truncated ? '+' : ''}`}
                columns={gridColumns}
                rows={stream.preview.rows}
              />
            )}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant='contained'
                startIcon={<Save size={16} />}
                disabled={!name.trim() || save.isPending}
                onClick={() =>
                  save.mutate({
                    finalName: name,
                    finalDescription: description,
                    finalSql: report.sql,
                    columns: report.columns,
                  })
                }
              >
                Save report
              </Button>
              <Button
                variant='text'
                startIcon={<X size={16} />}
                disabled={save.isPending}
                onClick={() => setStream(EMPTY_STREAM)}
              >
                Discard
              </Button>
            </Box>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};

// Fallback column meta when only field names are known (hand-fixed SQL): every
// column is rendered as plain text.
const fieldsToColumns = (fields: string[]): ReportColumn[] =>
  fields.map((field) => ({ field, label: field, kind: 'text' }));

const PreviewGrid = ({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: GridColDef[];
  rows: Record<string, unknown>[];
}) => {
  const [open, setOpen] = useState(true);
  return (
    <Box>
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          mb: 0.75,
        }}
      >
        <ChevronDown
          size={15}
          style={{
            transition: 'transform 0.15s ease',
            transform: open ? 'none' : 'rotate(-90deg)',
          }}
        />
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{title}</Typography>
      </Box>
      <Collapse in={open} timeout='auto' unmountOnExit>
        <Paper variant='outlined' sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <DataGrid
            rows={withRowIds(rows)}
            columns={columns}
            getRowId={(row) => (row as { __rid: number }).__rid}
            density='compact'
            disableRowSelectionOnClick
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
            }}
            pageSizeOptions={[25, 50, 100]}
            sx={(theme) => ({
              border: 0,
              maxHeight: 460,
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
      </Collapse>
    </Box>
  );
};
