/**
 * The AI report builder — a conversational thread. Streams the `generate-report`
 * agent's progress (`useChat` + a `DefaultChatTransport` pointed at the edge
 * function) and lets the user REFINE a proposed report over multiple turns
 * ("group by quarter, add a total row") before saving. On any turn that ends in
 * a report proposal the user can name/save it; a turn that fails leaves an
 * editable candidate SQL to hand-fix. Also drives `refine` and `repair` of an
 * existing report (reached from the detail page), which seed the thread from the
 * saved report server-side.
 *
 * Unlike the old single-shot design, the transport sends the FULL message
 * history each turn (`prepareSendMessagesRequest`), so the agent keeps context.
 * The server reads `{ mode, reportId, runtimeError, messages }` from the body.
 */

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
import { useHotkey } from '@tanstack/react-hotkeys';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { DefaultChatTransport, type UIMessage } from 'ai';
import {
  ChevronDown,
  Play,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
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
} from '#/types/reports';
import { SqlBlock } from './SqlBlock';

type UIReportMessage = UIMessage<unknown, ReportDataParts>;

interface ReportBuilderProps {
  mode: ReportMode;
  /** Existing report id — required for `refine` and `repair`. */
  reportId?: string;
  /** For `repair`: the runtime error the saved report now throws. */
  runtimeError?: string;
  /** Prefill the composer (e.g. an original prompt for refine). */
  initialPrompt?: string;
  /** Called after a successful save so the caller can navigate / refetch. */
  onSaved?: (reportId: string) => void;
  onCancel?: () => void;
}

// The latest of each interesting part within one assistant turn. A turn may run
// `run_sql` several times (multiple data-sql/data-preview); we keep the last.
interface TurnView {
  text: string;
  sql: string | null;
  preview: PreviewData | null;
  report: ReportData | null;
  failure: FailureData | null;
}

const readTurn = (m: UIReportMessage): TurnView => {
  const view: TurnView = {
    text: '',
    sql: null,
    preview: null,
    report: null,
    failure: null,
  };
  for (const p of m.parts) {
    switch (p.type) {
      case 'text':
        view.text += p.text;
        break;
      case 'data-sql':
        view.sql = (p.data as SqlData).sql;
        break;
      case 'data-preview':
        view.preview = p.data as PreviewData;
        break;
      case 'data-report':
        view.report = p.data as ReportData;
        break;
      case 'data-failure':
        view.failure = p.data as FailureData;
        break;
    }
  }
  return view;
};

const readUserText = (m: UIReportMessage): string =>
  m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n');

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
  // Composer textarea — the hotkey listener is scoped to this element so
  // Cmd/Ctrl+Enter only submits while the user is typing in the composer.
  const composerRef = useRef<HTMLElement>(null);
  // Composer draft (repair auto-sends, so start empty there).
  const [draft, setDraft] = useState(mode === 'repair' ? '' : initialPrompt);
  // Live progress labels for the in-flight turn (data-step is transient — it
  // arrives via onData and is never persisted to message history).
  const [steps, setSteps] = useState<string[]>([]);
  // Editable candidate SQL for the failure path, plus a hand-run preview.
  const [editSql, setEditSql] = useState('');
  const [handRun, setHandRun] = useState<PreviewData | null>(null);
  // Editable name/description for the latest proposed report.
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIReportMessage>({
        api: functionUrl('generate-report'),
        headers: reportAuthHeaders,
        // Send the FULL thread; the server reads these fields + `messages` from
        // the body and continues the conversation.
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            mode,
            reportId,
            runtimeError,
            messages,
            ...body,
          },
        }),
      }),
    [mode, reportId, runtimeError],
  );

  const { messages, sendMessage, regenerate, clearError, status, error } =
    useChat<UIReportMessage>({
      transport,
      onData: (part) => {
        switch (part.type) {
          case 'data-step':
            setSteps((s) => [...s, (part.data as { label: string }).label]);
            break;
          case 'data-report': {
            const report = part.data as ReportData;
            setName(report.name);
            setDescription(report.description);
            break;
          }
          case 'data-failure':
            setEditSql((part.data as FailureData).candidateSql ?? '');
            break;
        }
      },
    });

  const busy = status === 'submitted' || status === 'streaming';

  // Surface the daily-limit (429) message clearly. The transport puts the failed
  // response body on `error.message`. Match the specific `quota_exceeded` code —
  // not any message containing "quota" — so unrelated failures like
  // `quota_check_failed` surface their real error instead of a bogus limit notice.
  const quotaHit = /"code"\s*:\s*"quota_exceeded"|quota_exceeded/.test(
    error?.message ?? '',
  );

  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setSteps([]);
    setHandRun(null);
    clearError();
    void sendMessage({ text });
    setDraft('');
  };

  // Submit the composer with Cmd+Enter (Ctrl+Enter on Windows/Linux). `Mod`
  // resolves per-platform, and the listener is scoped to the composer textarea.
  useHotkey('Mod+Enter', () => send(), { target: composerRef });

  // Retry the last turn after a transient failure (e.g. a dropped model
  // connection). regenerate() keeps a trailing user message and re-runs it.
  const retry = () => {
    if (busy) return;
    setSteps([]);
    clearError();
    void regenerate();
  };

  // Repair needs no user instruction — the server seeds the saved SQL + runtime
  // error. Auto-send one turn on mount (guarded against StrictMode double-run).
  const autoSent = useRef(false);
  useEffect(() => {
    if (mode === 'repair' && !autoSent.current && messages.length === 0) {
      autoSent.current = true;
      setSteps([]);
      void sendMessage({ text: 'Repair this report so it runs correctly.' });
    }
  }, [mode, messages.length, sendMessage]);

  // The original request → stored as the report's `prompt` on create.
  const firstUserText = useMemo(() => {
    const first = messages.find((m) => m.role === 'user');
    return first ? readUserText(first) : '';
  }, [messages]);

  // The newest assistant terminal state drives the interactive action area.
  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant'),
    [messages],
  );
  const lastView = lastAssistant ? readTurn(lastAssistant) : null;
  const activeReport = !busy ? (lastView?.report ?? null) : null;
  const activeFailure = !busy ? (lastView?.failure ?? null) : null;

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
            prompt: firstUserText || null,
            sql: finalSql,
            columns: columns as unknown as Json,
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

  const started = messages.length > 0;

  return (
    <Stack spacing={2.5}>
      {quotaHit && (
        <Alert severity='warning'>
          You've hit the daily report-generation limit. Try again tomorrow, or
          run and edit an existing report's SQL.
        </Alert>
      )}
      {error && !quotaHit && (
        <Alert
          severity='error'
          sx={{ fontSize: 13 }}
          action={
            <Button
              color='inherit'
              size='small'
              startIcon={<RotateCcw size={15} />}
              disabled={busy}
              onClick={retry}
            >
              Retry
            </Button>
          }
        >
          The report agent hit a problem (often a brief connection drop). Your
          conversation is intact — retry to continue.
        </Alert>
      )}

      {/* Conversation transcript */}
      {started && (
        <Stack spacing={2}>
          {messages.map((m) =>
            m.role === 'user' ? (
              <UserBubble key={m.id} text={readUserText(m)} />
            ) : (
              <AssistantTurn
                key={m.id}
                view={readTurn(m)}
                // The newest turn's terminal state renders in the action area
                // below, so suppress its inline summary to avoid duplication.
                isLatest={m.id === lastAssistant?.id}
              />
            ),
          )}
        </Stack>
      )}

      {/* In-flight progress for the current turn */}
      {busy && (
        <Paper variant='outlined' sx={{ borderRadius: 2, p: 2 }}>
          <LinearProgress sx={{ mb: 1.5, borderRadius: 1 }} />
          <Stack spacing={0.5}>
            {steps.map((label, i) => {
              const latest = i === steps.length - 1;
              return (
                <Typography
                  // Progress log; index is a stable key for an append-only list.
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

      {/* Action area — Save the latest proposed report */}
      {activeReport && (
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
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant='contained'
                startIcon={<Save size={16} />}
                disabled={!name.trim() || save.isPending}
                onClick={() =>
                  save.mutate({
                    finalName: name,
                    finalDescription: description,
                    finalSql: activeReport.sql,
                    columns: activeReport.columns,
                  })
                }
              >
                Save report
              </Button>
              <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                or ask for another change below
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}

      {/* Action area — hand-fix the latest failed turn's SQL */}
      {activeFailure && (
        <Paper variant='outlined' sx={{ borderRadius: 2, p: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
            <TriangleAlert size={18} color='var(--mui-palette-warning-main)' />
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
              Couldn't finish automatically
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
            {activeFailure.message} You can ask for a fix below, or edit the SQL
            by hand.
          </Typography>
          {activeFailure.lastError && (
            <Alert
              severity='error'
              sx={{ fontFamily: MONO_FONT, fontSize: 12.5, mb: 1.5 }}
            >
              {activeFailure.lastError}
            </Alert>
          )}
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

      {/* Composer — always available */}
      <Box>
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            started
              ? 'Ask for a change (e.g. "group by quarter and add a total row")'
              : mode === 'refine'
                ? 'Describe the change (e.g. "add a total row and filter to surplus lines")'
                : 'Describe the report in plain English (e.g. "open AR by client, bucketed by month")'
          }
          disabled={busy}
          inputRef={composerRef}
        />
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button
            variant='contained'
            startIcon={started ? <Send size={16} /> : <Sparkles size={16} />}
            disabled={busy || !draft.trim()}
            onClick={send}
          >
            {started ? 'Send' : mode === 'create' ? 'Generate' : 'Start'}
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
    </Stack>
  );
};

// A single user turn.
const UserBubble = ({ text }: { text: string }) => (
  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
    <Paper
      variant='outlined'
      sx={{
        borderRadius: 2,
        px: 1.75,
        py: 1,
        maxWidth: '85%',
        bgcolor: 'paper2',
      }}
    >
      <Typography sx={{ fontSize: 13.5, whiteSpace: 'pre-wrap' }}>
        {text}
      </Typography>
    </Paper>
  </Box>
);

// A single assistant turn: any prose, the tested SQL, the preview, and — for
// earlier turns — a compact terminal summary (the latest turn's terminal state
// is handled by the interactive action area).
const AssistantTurn = ({
  view,
  isLatest,
}: {
  view: TurnView;
  isLatest: boolean;
}) => {
  const gridColumns = view.report
    ? columnsFromMeta(view.report.columns)
    : view.preview
      ? previewColumns(view.preview.fields)
      : [];
  return (
    <Stack spacing={1.25}>
      {view.text.trim() && (
        <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>
          {view.text.trim()}
        </Typography>
      )}
      {view.sql && <SqlBlock sql={view.sql} defaultOpen={false} label='SQL' />}
      {view.preview && (
        <PreviewGrid
          title={`Preview — ${view.preview.rowCount} row(s)${view.preview.truncated ? '+' : ''}`}
          columns={gridColumns}
          rows={view.preview.rows}
        />
      )}
      {!isLatest && view.report && (
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
          Proposed: {view.report.name}
        </Typography>
      )}
      {!isLatest && view.failure && (
        <Typography sx={{ fontSize: 13, color: 'warning.main' }}>
          {view.failure.message}
        </Typography>
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
