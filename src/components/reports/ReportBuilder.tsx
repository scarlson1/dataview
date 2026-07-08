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
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { formatForDisplay, useHotkey } from '@tanstack/react-hotkeys';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  DefaultChatTransport,
  type DynamicToolUIPart,
  getToolName,
  isToolUIPart,
  type ToolUIPart,
  type UIMessage,
} from 'ai';
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
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '#/context/AuthContext';
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
  ReportParam,
  SqlData,
  StepData,
} from '#/types/reports';
import { Prose } from './Prose';
import { SqlBlock } from './SqlBlock';

// TODO: on save -> invalidate reports tanstack query cache

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

// `__rid` goes last so a result column literally named `__rid` can't override
// the synthetic grid row id (duplicate ids crash the DataGrid).
const withRowIds = (rows: Record<string, unknown>[]) =>
  rows.map((row, i) => ({ ...row, __rid: i }));

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
  // Editable candidate SQL for the failure path, plus a hand-run preview.
  const [editSql, setEditSql] = useState('');
  const [handRun, setHandRun] = useState<PreviewData | null>(null);
  // Out-of-band progress notices for the in-flight turn (e.g. a model
  // escalation). Transient — they arrive via onData and never persist to the
  // thread history, so they're cleared at the start of every turn.
  const [notices, setNotices] = useState<string[]>([]);
  // Editable name/description for the latest proposed report. Once the user
  // edits a field by hand, later model proposals must not clobber it.
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const nameDirty = useRef(false);
  const descriptionDirty = useRef(false);

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
            setNotices((n) => [...n, (part.data as StepData).label]);
            break;
          case 'data-report': {
            const report = part.data as ReportData;
            if (!nameDirty.current) setName(report.name);
            if (!descriptionDirty.current) setDescription(report.description);
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
  const quotaHit = /quota_exceeded/.test(error?.message ?? '');

  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setHandRun(null);
    setNotices([]);
    clearError();
    void sendMessage({ text });
    setDraft('');
  };

  // Submit the composer with Cmd+Enter (Ctrl+Enter on Windows/Linux). `Mod`
  // resolves per-platform, and the listener is scoped to the composer textarea.
  useHotkey('Mod+Enter', () => send(), { target: composerRef });
  const submitShortcutDisplay = formatForDisplay('Mod+Enter');

  // Retry the last turn after a transient failure (e.g. a dropped model
  // connection). regenerate() keeps a trailing user message and re-runs it.
  const retry = () => {
    if (busy) return;
    setNotices([]);
    clearError();
    void regenerate();
  };

  // Repair needs no user instruction — the server seeds the saved SQL + runtime
  // error. Auto-send one turn on mount (guarded against StrictMode double-run).
  const autoSent = useRef(false);
  useEffect(() => {
    if (mode === 'repair' && !autoSent.current && messages.length === 0) {
      autoSent.current = true;
      setNotices([]);
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
      params,
    }: {
      finalName: string;
      finalDescription: string;
      finalSql: string;
      columns: ReportColumn[];
      params: ReportParam[];
    }) => {
      // Store [] as null so a refine that removes all parameters actually
      // clears them (and unparameterized reports stay params-free).
      const paramsJson = params.length ? (params as unknown as Json) : null;
      if (mode === 'create') {
        const { data, error: insertError } = await supabase
          .from('reports')
          .insert({
            name: finalName,
            description: finalDescription || null,
            prompt: firstUserText || null,
            sql: finalSql,
            columns: columns as unknown as Json,
            params: paramsJson,
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
          params: paramsJson,
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
                message={m}
                // The newest turn stays fully expanded (its terminal state drives
                // the action area below); earlier turns collapse their steps.
                isLatest={m.id === lastAssistant?.id}
                // Transient notices belong to the in-flight (latest) turn only.
                notices={m.id === lastAssistant?.id ? notices : undefined}
              />
            ),
          )}
        </Stack>
      )}

      {/* Slim "still working" hint — the per-step detail streams inline in the
          active turn's timeline above (each tool call shows its own spinner). */}
      {busy && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 0.5 }}>
          <CircularProgress size={13} thickness={5} />
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
            Working…
          </Typography>
          <Box sx={{ flex: 1 }}>
            <LinearProgress sx={{ borderRadius: 1 }} />
          </Box>
        </Box>
      )}

      {/* Action area — Save the latest proposed report */}
      {activeReport && (
        <Paper variant='outlined' sx={{ borderRadius: 2, p: 2.5 }}>
          <Stack spacing={2}>
            {(activeReport.params?.length ?? 0) > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.75,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                  Asks at run time:
                </Typography>
                {activeReport.params.map((p) => (
                  <Chip
                    key={p.name}
                    size='small'
                    variant='outlined'
                    label={`${p.label} (${p.type === 'entity' ? (p.entity?.table ?? 'entity') : p.type})`}
                  />
                ))}
              </Box>
            )}
            <TextField
              label='Report name'
              fullWidth
              value={name}
              onChange={(e) => {
                nameDirty.current = true;
                setName(e.target.value);
              }}
            />
            <TextField
              label='Description'
              fullWidth
              multiline
              minRows={1}
              value={description}
              onChange={(e) => {
                descriptionDirty.current = true;
                setDescription(e.target.value);
              }}
            />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant='contained'
                startIcon={
                  <Save size={16} color={'var(--variant-containedColor)'} />
                }
                disabled={!name.trim() || save.isPending}
                onClick={() =>
                  save.mutate({
                    finalName: name,
                    finalDescription: description,
                    finalSql: activeReport.sql,
                    columns: activeReport.columns,
                    // `?? []`: threads from before params existed lack the field
                    params: activeReport.params ?? [],
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
            onChange={(e) => {
              setEditSql(e.target.value);
              // The preview no longer matches the edited SQL — force a re-run
              // before Save so we never persist unvalidated SQL/stale columns.
              setHandRun(null);
            }}
            slotProps={{
              input: { sx: { fontFamily: MONO_FONT, fontSize: 12.5 } },
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
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
              disabled={
                !editSql.trim() || !name.trim() || !handRun || save.isPending
              }
              onClick={() => {
                if (!handRun) return;
                save.mutate({
                  finalName: name,
                  finalDescription: description,
                  finalSql: editSql,
                  // Hand-run SQL validated without placeholders → no params.
                  columns: fieldsToColumns(handRun.fields),
                  params: [],
                });
              }}
            >
              Save
            </Button>
            {!handRun && (
              <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                Run the SQL to validate it before saving
              </Typography>
            )}
          </Box>
          <Box sx={{ mt: 1.5 }}>
            <TextField
              label='Report name'
              size='small'
              fullWidth
              value={name}
              onChange={(e) => {
                nameDirty.current = true;
                setName(e.target.value);
              }}
              sx={{ mb: 1 }}
            />
            <TextField
              label='Description'
              size='small'
              fullWidth
              value={description}
              onChange={(e) => {
                descriptionDirty.current = true;
                setDescription(e.target.value);
              }}
            />
          </Box>
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
            startIcon={
              started ? (
                <Send
                  size={16}
                  color={
                    busy || !draft.trim()
                      ? 'var(--palette-action-disabled)'
                      : 'var(--variant-containedColor)'
                  }
                />
              ) : (
                <Sparkles
                  size={16}
                  color={
                    busy || !draft.trim()
                      ? 'var(--palette-action-disabled)'
                      : 'var(--variant-containedColor)'
                  }
                />
              )
            }
            endIcon={
              <Typography
                variant='body2'
                sx={{
                  fontSize: '0.75rem !important',
                  lineHeight: 'inherit',
                  color:
                    busy || !draft.trim()
                      ? 'var(--palette-action-disabled)'
                      : 'var(--palette-primary-contrastText)',
                }}
              >
                {submitShortcutDisplay}
              </Typography>
            }
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

// Friendly label for a server-executed tool call, shown as a timeline step.
const toolStepLabel = (part: ToolUIPart | DynamicToolUIPart): string => {
  const name = getToolName(part);
  const input =
    'input' in part
      ? (part.input as Record<string, unknown> | undefined)
      : undefined;
  switch (name) {
    case 'list_tables':
      return 'Inspecting the schema';
    case 'get_table_schema': {
      const tables = (input?.tables as string[] | undefined)?.join(', ');
      return tables ? `Reading schema: ${tables}` : 'Reading table schema';
    }
    case 'sample_rows': {
      const table = input?.table as string | undefined;
      return table ? `Sampling rows from ${table}` : 'Sampling rows';
    }
    case 'run_sql':
      return 'Running the query';
    default:
      return String(name);
  }
};

// One line in a turn's activity timeline: a spinner while the step runs, a dot
// once it finishes.
const StepRow = ({ label, running }: { label: string; running: boolean }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <Box
      sx={{
        width: 14,
        display: 'flex',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {running ? (
        <CircularProgress size={12} thickness={5} />
      ) : (
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: 'text.disabled',
          }}
        />
      )}
    </Box>
    <Typography
      sx={{
        fontSize: 12.5,
        color: running ? 'text.primary' : 'text.secondary',
        fontWeight: running ? 600 : 400,
      }}
    >
      {label}
    </Typography>
  </Box>
);

// Collapsible wrapper for a finished turn's steps/SQL/preview, so the thread
// stays scannable while keeping the detail one click away.
const StepDisclosure = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <Box>
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
        }}
      >
        <ChevronDown
          size={14}
          style={{
            transition: 'transform 0.15s ease',
            transform: open ? 'none' : 'rotate(-90deg)',
          }}
        />
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
          {open ? 'Hide steps' : 'Show steps'}
        </Typography>
      </Box>
      <Collapse in={open} timeout='auto' unmountOnExit>
        <Stack
          spacing={1.25}
          sx={(theme) => ({
            mt: 1,
            pl: 1.25,
            borderLeft: `2px solid ${theme.palette.divider}`,
          })}
        >
          {children}
        </Stack>
      </Collapse>
    </Box>
  );
};

// A tagged, in-order timeline node built from one assistant message part.
interface TimelineNode {
  key: string;
  // 'prose' stays visible on collapsed turns; 'process' folds into the
  // Show-steps disclosure.
  kind: 'prose' | 'process';
  node: ReactNode;
}

// A single assistant turn rendered as a chronological timeline: the model's
// narration (markdown), each tool step, the tested SQL, and previews interleaved
// in the order they streamed — instead of one flattened blob. The latest turn
// stays expanded; earlier turns keep their prose but fold the steps away.
const AssistantTurn = ({
  message,
  isLatest,
  notices,
}: {
  message: UIReportMessage;
  isLatest: boolean;
  /** Transient out-of-band notices for the in-flight turn (latest only). */
  notices?: string[];
}) => {
  const timeline: TimelineNode[] = [];
  let reportName: string | null = null;
  let failureMessage: string | null = null;

  message.parts.forEach((p, i) => {
    const key = `${message.id}-${i}`;
    if (p.type === 'text') {
      const text = p.text.trim();
      if (text)
        timeline.push({
          key,
          kind: 'prose',
          node: <Prose key={key} text={text} />,
        });
      return;
    }
    if (isToolUIPart(p)) {
      // submit_report's result is the proposal itself (data-report) — no step row.
      if (getToolName(p) === 'submit_report') return;
      const running =
        p.state !== 'output-available' && p.state !== 'output-error';
      timeline.push({
        key,
        kind: 'process',
        node: <StepRow key={key} label={toolStepLabel(p)} running={running} />,
      });
      return;
    }
    switch (p.type) {
      case 'data-sql':
        timeline.push({
          key,
          kind: 'process',
          node: (
            <SqlBlock
              key={key}
              sql={(p.data as SqlData).sql}
              defaultOpen={false}
              label='SQL'
            />
          ),
        });
        break;
      case 'data-preview': {
        const preview = p.data as PreviewData;
        timeline.push({
          key,
          kind: 'process',
          node: (
            <PreviewGrid
              key={key}
              title={`Preview — ${preview.rowCount} row(s)${preview.truncated ? '+' : ''}`}
              columns={previewColumns(preview.fields)}
              rows={preview.rows}
            />
          ),
        });
        break;
      }
      case 'data-report':
        reportName = (p.data as ReportData).name;
        break;
      case 'data-failure':
        failureMessage = (p.data as FailureData).message;
        break;
    }
  });

  // Latest turn: show the full interleaved timeline (its terminal report/failure
  // is handled by the action area below, so no summary line here). Transient
  // notices (e.g. a model escalation) trail the timeline as they arrive.
  if (isLatest) {
    return (
      <Stack spacing={1.25}>
        {timeline.map((t) => t.node)}
        {notices?.map((label, i) => (
          <StepRow
            // Append-only transient list; index is a stable key.
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only notices
            key={`notice-${i}`}
            label={label}
            running={false}
          />
        ))}
      </Stack>
    );
  }

  // Earlier turn: keep the narration, fold the steps, and end with a one-line
  // outcome so the thread stays scannable.
  const prose = timeline.filter((t) => t.kind === 'prose');
  const process = timeline.filter((t) => t.kind === 'process');
  return (
    <Stack spacing={1.25}>
      {prose.map((t) => t.node)}
      {process.length > 0 && (
        <StepDisclosure>{process.map((t) => t.node)}</StepDisclosure>
      )}
      {reportName && (
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
          Proposed: {reportName}
        </Typography>
      )}
      {failureMessage && (
        <Typography sx={{ fontSize: 13, color: 'warning.main' }}>
          {failureMessage}
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
