// generate-report: Claude agent loop that turns a natural-language prompt into
// a tested, read-only SQL report. See docs/LLM_REPORTS_PLAN.md.
//
// POST JSON API — a CONVERSATIONAL thread. The client sends the full
// AI-SDK UI-message history each turn; the agent continues the same thread so
// the user can refine a proposed report ("group by quarter, add a total") before
// saving.
//   Request: { mode: 'create' | 'refine' | 'repair';
//              messages: UIMessage[];  // the full thread (>=1 user turn)
//              reportId?: string;      // refine + repair (seeds saved context)
//              runtimeError?: string;  // repair
//              prompt?: string }       // deprecated: create-mode fallback
//   Response: AI SDK UI-message stream with custom data parts:
//     data-step    { label }   // transient (progress only, not persisted)
//     data-sql     { sql }
//     data-preview { rows, fields, rowCount, truncated }
//     data-report  { name, description, sql, columns[{field,label,kind}] }
//     data-failure { message, lastError?, candidateSql? }
//   Quota hit → non-stream 429 { error: { code: 'quota_exceeded', message } }.
//   Each turn is one invocation (one usage-ledger row, one quota unit).
//
// Saving is the CLIENT's job (insert into `reports` under RLS after the user
// reviews name/description) — submit_report only emits the data-report part.

import { anthropic } from '@ai-sdk/anthropic';
import '@supabase/functions-js/edge-runtime.d.ts';
import { type SupabaseContext, withSupabase } from '@supabase/server';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  hasToolCall,
  type ModelMessage,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from 'ai';
import { z } from 'zod';
import { Database } from '../_shared/database.types.ts';
import { executeReportSql, ROW_CAPS } from '../_shared/reportExecutor.ts';
import {
  bustSchemaCache,
  getTableSchema,
  listTables,
  sampleRows,
} from '../_shared/schemaTools.ts';

const MODEL = 'claude-opus-4-8';
// Counted per turn: a multi-turn refinement spends one unit per exchange.
const DAILY_QUOTA = 50;
const MAX_STEPS = 12;
const MAX_CONSECUTIVE_SQL_FAILURES = 4;
// Supabase edge functions hard-cap wall-clock at 150s; stay ~10s under so our
// own abort fires first and surfaces the candidate SQL, instead of losing the
// race to a blunt platform timeout.
const WALL_CLOCK_MS = 140_000;
const MAX_OUTPUT_TOKENS = 8_192;

const COLUMN_KINDS = [
  'mono',
  'text',
  'chip',
  'number',
  'datetime',
  'bool',
  'json',
] as const;

interface ReportColumn {
  field: string;
  label: string;
  kind: (typeof COLUMN_KINDS)[number];
}

// Typed custom data parts — the frozen stream contract above.
type ReportDataParts = {
  step: { label: string };
  sql: { sql: string };
  preview: {
    rows: Record<string, unknown>[];
    fields: string[];
    rowCount: number;
    truncated: boolean;
  };
  report: {
    name: string;
    description: string;
    sql: string;
    columns: ReportColumn[];
  };
  failure: { message: string; lastError?: string; candidateSql?: string };
};
type ReportUIMessage = UIMessage<unknown, ReportDataParts>;

const bodySchema = z.object({
  mode: z.enum(['create', 'refine', 'repair']),
  // The full UI-message thread. Validated structurally by the AI SDK
  // (convertToModelMessages); we only assert it's a non-empty array here.
  messages: z.array(z.any()).optional(),
  // Deprecated create-mode fallback for a client that hasn't adopted `messages`.
  prompt: z.string().trim().min(1).optional(),
  reportId: z.string().optional(),
  runtimeError: z.string().optional(),
});

const errorResponse = (
  status: number,
  err: { code: string; message: string },
): Response => Response.json({ error: err }, { status });

const SYSTEM_PROMPT = `You are a SQL report writer for an insurance MGA's internal Postgres database (schema \`public\`).

Your job: turn the user's request into ONE tested, read-only SQL query, then deliver it with submit_report.

Rules:
- The final SQL must be a single SELECT statement. No writes, no DDL, no semicolon-chained statements, no FOR UPDATE/SHARE.
- Never guess table or column names. Inspect with list_tables and get_table_schema first.
- Prefer the public views — they already encode the business logic (joins, filters, derived fields). Reach for base tables only when no view covers the need.
- Use sample_rows when value formats matter (status strings, date shapes, category text).
- ALWAYS test your final SQL with run_sql before calling submit_report, and submit exactly the SQL that ran successfully.
- If run_sql returns an error, read the message/hint/position and fix the SQL.
- Queries run with the requesting user's row-level security. A smaller-than-expected result can be permission scoping — do not try to work around it.
- Order results sensibly (most recent first for time-based reports) and give output columns clear snake_case aliases.

submit_report metadata:
- name: short title, a few words. description: one or two sentences on what the report shows.
- columns: one entry per output column, in select-list order.
  - field: the exact column name the SQL outputs.
  - label: tidy human header ("Policy Number", not "policy_number").
  - kind: mono (ids, reference numbers, codes) | text (free text) | chip (low-cardinality status/category) | number (quantities, money) | datetime (dates, timestamps) | bool | json (nested values).`;

type Ctx = SupabaseContext<Database>;

// Supabase edge-runtime global (keeps the isolate alive for background work).
// Declared here because the edge-runtime.d.ts import doesn't surface it to the
// type checker; `| undefined` because plain `deno` runs don't have it.
declare const EdgeRuntime:
  | { waitUntil: (p: Promise<unknown>) => void }
  | undefined;

interface StoredReport {
  name: string;
  description: string | null;
  prompt: string | null;
  sql: string;
}

// Anthropic prompt-cache breakpoint. Applied to the LAST assembled message
// before the current turn's loop runs, so every step (and every follow-up turn)
// re-hits the cache for system + tools + prior thread.
const cacheBreakpoint = {
  anthropic: { cacheControl: { type: 'ephemeral' as const } },
};

// For refine/repair, prepend a single DB-authoritative context message so the
// agent grounds on the SAVED prompt + SQL (never client-sent SQL). For create,
// there's no seed — the thread's own user messages carry the request.
const buildSeedContext = (
  mode: 'create' | 'refine' | 'repair',
  runtimeError: string | undefined,
  report: StoredReport | null,
): ModelMessage[] => {
  if (mode === 'create') return [];

  let seed: string;
  if (mode === 'refine') {
    seed = `An existing report is being refined. Use the conversation that follows for the specific changes.

Original request:
${report?.prompt ?? '(not recorded)'}

Current SQL:
${report?.sql}

Adjust the report per the user's instructions. Re-test with run_sql and submit the updated report.`;
  } else {
    seed = `An existing saved report now fails at runtime (likely schema drift after a migration).

Original request:
${report?.prompt ?? '(not recorded)'}

Current SQL:
${report?.sql}

Runtime error:
${runtimeError}

Inspect the current schema, fix the SQL, re-test with run_sql, and submit the repaired report. Keep the report's intent and output shape as close to the original as possible.`;
  }

  return [{ role: 'user', content: seed }];
};

// Assemble the model input: DB seed context (refine/repair) + the client's
// converted thread. `convertToModelMessages` drops UI-only data-* parts and
// rebuilds tool-call/result pairs (our tools are server-executed and carry their
// output on the part, so no tools option is needed). The cache breakpoint rides
// the last message so every step and every follow-up turn re-hits the cache.
const assembleMessages = async (
  seedContext: ModelMessage[],
  clientMessages: UIMessage[],
): Promise<ModelMessage[]> => {
  // ignoreIncompleteToolCalls: an aborted turn (wall clock / give-up) can leave
  // a tool part stuck in `input-available` with no result; converting it to a
  // tool-call without a paired tool-result makes Anthropic 400 the next turn.
  const converted = await convertToModelMessages(clientMessages, {
    ignoreIncompleteToolCalls: true,
  });
  const all = [...seedContext, ...converted];
  const last = all.at(-1);
  if (last) {
    last.providerOptions = { ...last.providerOptions, ...cacheBreakpoint };
  }
  return all;
};

export default {
  fetch: withSupabase<Database>({ auth: ['user'] }, async (req, ctx) => {
    const claims = ctx.jwtClaims;
    if (!claims?.sub) {
      return errorResponse(401, {
        code: 'unauthorized',
        message: 'Unauthorized',
      });
    }
    if (!Deno.env.get('ANTHROPIC_API_KEY')) {
      return errorResponse(500, {
        code: 'not_configured',
        message: 'ANTHROPIC_API_KEY is not configured',
      });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return errorResponse(400, {
        code: 'bad_request',
        message: 'Invalid JSON body',
      });
    }
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return errorResponse(400, {
        code: 'bad_request',
        message: parsed.error.issues[0]?.message ?? 'Invalid request body',
      });
    }
    const { mode, prompt, reportId, runtimeError } = parsed.data;

    // The conversation thread. Prefer the client-sent history; fall back to a
    // single synthesized user message for a legacy `prompt`-only client.
    const clientMessages: UIMessage[] =
      parsed.data.messages && parsed.data.messages.length > 0
        ? (parsed.data.messages as UIMessage[])
        : prompt
          ? [
              {
                id: crypto.randomUUID(),
                role: 'user',
                parts: [{ type: 'text', text: prompt }],
              },
            ]
          : [];

    if (clientMessages.length === 0) {
      return errorResponse(400, {
        code: 'bad_request',
        message: '`messages` (or `prompt`) is required',
      });
    }

    // The latest user turn's text — logged to the usage ledger as this turn's
    // effective prompt (the thread itself isn't stored).
    const latestUserText =
      [...clientMessages]
        .reverse()
        .find((m) => m.role === 'user')
        ?.parts?.filter(
          (p): p is { type: 'text'; text: string } => p.type === 'text',
        )
        .map((p) => p.text)
        .join('\n') ??
      prompt ??
      runtimeError ??
      '';
    if ((mode === 'refine' || mode === 'repair') && !reportId) {
      return errorResponse(400, {
        code: 'bad_request',
        message: `\`reportId\` is required for mode '${mode}'`,
      });
    }
    if (mode === 'repair' && !runtimeError) {
      return errorResponse(400, {
        code: 'bad_request',
        message: "`runtimeError` is required for mode 'repair'",
      });
    }

    // Load the existing report with the CALLER's permissions (RLS applies).
    let report: StoredReport | null = null;
    if (mode !== 'create') {
      const { data, error } = await ctx.supabase
        .from('reports')
        .select('name, description, prompt, sql, archived_at')
        .eq('id', reportId as string)
        .maybeSingle();
      if (error) {
        return errorResponse(422, {
          code: error.code ?? 'load_error',
          message: error.message,
        });
      }
      if (!data || data.archived_at) {
        return errorResponse(404, {
          code: 'not_found',
          message: 'Report not found',
        });
      }
      report = data;
    }

    // Daily quota, counted against the usage ledger (quota_exceeded rows
    // excluded so hammering a closed gate doesn't extend it).
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count, error: quotaError } = await ctx.supabaseAdmin
      .from('report_generation_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', claims.sub)
      .neq('outcome', 'quota_exceeded')
      .gte('created_at', dayStart.toISOString());
    if (quotaError) {
      return errorResponse(500, {
        code: 'quota_check_failed',
        message: quotaError.message,
      });
    }
    if ((count ?? 0) >= DAILY_QUOTA) {
      logGeneration(ctx, {
        userId: claims.sub,
        reportId,
        prompt: latestUserText,
        inputTokens: 0,
        outputTokens: 0,
        steps: 0,
        outcome: 'quota_exceeded',
      });
      return errorResponse(429, {
        code: 'quota_exceeded',
        message: `Daily generation limit reached (${DAILY_QUOTA}/day). Try again tomorrow.`,
      });
    }

    // Schema drift is exactly when stale cached schema would poison the fix.
    if (mode === 'repair') bustSchemaCache();

    const claimsRecord = claims as unknown as Record<string, unknown>;
    const abort = new AbortController();
    const deadline = setTimeout(() => abort.abort(), WALL_CLOCK_MS);

    let logged = false;
    const logOnce = (
      outcome: 'succeeded' | 'failed' | 'cancelled',
      usage: { inputTokens?: number; outputTokens?: number } | undefined,
      steps: number,
    ): void => {
      if (logged) return;
      logged = true;
      clearTimeout(deadline);
      logGeneration(ctx, {
        userId: claims.sub as string,
        reportId,
        prompt: latestUserText,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        steps,
        outcome,
      });
    };

    // Convert the client thread (+ DB seed context) to model messages up front —
    // convertToModelMessages is async, so it can't live inline in streamText.
    const modelMessages = await assembleMessages(
      buildSeedContext(mode, runtimeError, report),
      clientMessages,
    );

    const stream = createUIMessageStream<ReportUIMessage>({
      onError: (error) => {
        console.error('generate-report stream error', error);
        return 'Report generation failed';
      },
      execute: ({ writer }) => {
        let submitted = false;
        let failed = false;
        let lastSql: string | undefined;
        let lastError: string | undefined;
        let consecutiveSqlFailures = 0;
        let runAttempt = 0;
        // Set when the consecutive-failure guard aborts the loop, so onAbort
        // can log it as 'failed' instead of 'cancelled' (wall clock).
        let gaveUp = false;

        const emitFailure = (message: string): void => {
          if (submitted || failed) return;
          failed = true;
          writer.write({
            type: 'data-failure',
            data: {
              message,
              ...(lastError !== undefined ? { lastError } : {}),
              ...(lastSql !== undefined ? { candidateSql: lastSql } : {}),
            },
          });
        };

        const step = (label: string): void => {
          // Transient: progress labels render live but must not persist into the
          // thread history that round-trips back on the next turn.
          writer.write({ type: 'data-step', data: { label }, transient: true });
        };

        // TEMP TIMING INSTRUMENTATION — remove after measuring list_tables cost.
        const t0 = performance.now();
        const mark = (label: string): void =>
          console.error(`[timing] +${(performance.now() - t0).toFixed(0)}ms ${label}`);
        mark('turn start (streamText called)');

        const result = streamText({
          model: anthropic(MODEL),
          system: SYSTEM_PROMPT,
          messages: modelMessages,
          abortSignal: abort.signal,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          // A little extra headroom for transient upstream blips (e.g. a dropped
          // TLS handshake to the model API) before the turn surfaces as an error.
          // Kept modest: each retry backs off and eats into WALL_CLOCK_MS.
          maxRetries: 3,
          stopWhen: [stepCountIs(MAX_STEPS), hasToolCall('submit_report')],
          onStepFinish: (stepResult) => {
            mark(
              `step finished — finishReason=${stepResult.finishReason} toolCalls=${stepResult.toolCalls.map((c) => c.toolName).join(',')}`,
            );
          },
          tools: {
            list_tables: tool({
              description:
                'List every table and view in the public schema with a short comment. Views encode the business logic — prefer them.',
              inputSchema: z.object({}),
              execute: async () => {
                step('inspecting schema');
                mark('list_tables exec start');
                const r = await listTables();
                mark('list_tables exec end');
                return r;
              },
            }),

            get_table_schema: tool({
              description:
                'Columns, primary/foreign keys, and CHECK constraints for one or more tables or views.',
              inputSchema: z.object({
                tables: z.array(z.string()).min(1),
              }),
              execute: async ({ tables }) => {
                step(`reading schema: ${tables.join(', ')}`);
                mark(`get_table_schema exec start (${tables.join(',')})`);
                const r = await getTableSchema(tables);
                mark('get_table_schema exec end');
                return r;
              },
            }),

            sample_rows: tool({
              description:
                'Preview up to 5 rows from a table or view so value formats are visible. Runs as the requesting user (RLS applies).',
              inputSchema: z.object({
                table: z.string(),
              }),
              execute: async ({ table }) => {
                step(`sampling rows from ${table}`);
                mark(`sample_rows exec start (${table})`);
                const r = await sampleRows(table, claimsRecord);
                mark('sample_rows exec end');
                return r;
              },
            }),

            run_sql: tool({
              description:
                'Execute a candidate SELECT through the guarded read-only executor (200-row preview cap). Always test the final SQL here before submit_report.',
              inputSchema: z.object({
                sql: z.string(),
              }),
              execute: async ({ sql }) => {
                runAttempt += 1;
                step(
                  runAttempt > 1
                    ? `running query (attempt ${runAttempt})`
                    : 'running query',
                );
                writer.write({ type: 'data-sql', data: { sql } });
                lastSql = sql;

                const res = await executeReportSql({
                  sql,
                  claims: claimsRecord,
                  rowCap: ROW_CAPS.agentPreview,
                });

                if (res.ok) {
                  consecutiveSqlFailures = 0;
                  lastError = undefined;
                  writer.write({
                    type: 'data-preview',
                    data: {
                      rows: res.rows,
                      fields: res.fields,
                      rowCount: res.rowCount,
                      truncated: res.truncated,
                    },
                  });
                  return {
                    ok: true,
                    rowCount: res.rowCount,
                    truncated: res.truncated,
                    rows: res.rows,
                  };
                }

                consecutiveSqlFailures += 1;
                lastError = res.message;
                if (consecutiveSqlFailures >= MAX_CONSECUTIVE_SQL_FAILURES) {
                  gaveUp = true;
                  emitFailure(
                    `Gave up after ${MAX_CONSECUTIVE_SQL_FAILURES} consecutive failed queries. The last error and SQL are below — you can edit the SQL by hand.`,
                  );
                  abort.abort();
                }
                return {
                  ok: false,
                  error: {
                    code: res.code,
                    message: res.message,
                    ...(res.hint !== undefined ? { hint: res.hint } : {}),
                    ...(res.position !== undefined
                      ? { position: res.position }
                      : {}),
                  },
                };
              },
            }),

            submit_report: tool({
              description:
                'Finish: deliver the tested report. Call once, only after run_sql succeeds on the exact final SQL.',
              inputSchema: z.object({
                name: z.string().min(1),
                description: z.string(),
                sql: z.string().min(1),
                columns: z
                  .array(
                    z.object({
                      field: z.string(),
                      label: z.string(),
                      kind: z.enum(COLUMN_KINDS),
                    }),
                  )
                  .min(1),
              }),
              execute: (submission) => {
                submitted = true;
                writer.write({ type: 'data-report', data: submission });
                return { ok: true };
              },
            }),
          },
          onAbort: ({ steps }) => {
            // Consecutive-failure aborts already emitted their failure part;
            // anything else aborting is the wall clock.
            emitFailure(
              'Generation ran out of time. The best candidate SQL so far is below — you can edit it by hand.',
            );
            logOnce(gaveUp ? 'failed' : 'cancelled', undefined, steps.length);
          },
          onFinish: ({ totalUsage, steps }) => {
            if (!submitted) {
              emitFailure(
                'The agent stopped before completing a report. The best candidate SQL so far is below.',
              );
            }
            logOnce(
              submitted ? 'succeeded' : 'failed',
              totalUsage,
              steps.length,
            );
          },
        });

        // Give the client a stable, user-readable error string (the AI SDK's
        // default is a bare "An error occurred."). The builder shows this next
        // to a Retry action; the raw cause is logged server-side above.
        writer.merge(
          result.toUIMessageStream({
            onError: () =>
              'The report agent lost its connection to the model. Retry to continue.',
          }),
        );
      },
    });

    return createUIMessageStreamResponse({ stream });
  }),
};

// --- usage ledger (service role; async, isolate kept alive) -----------------

const logGeneration = (
  ctx: Ctx,
  row: {
    userId: string;
    reportId?: string;
    prompt: string;
    inputTokens: number;
    outputTokens: number;
    steps: number;
    outcome: 'succeeded' | 'failed' | 'quota_exceeded' | 'cancelled';
  },
): void => {
  const insert = ctx.supabaseAdmin
    .from('report_generation_log')
    .insert({
      user_id: row.userId,
      report_id: row.reportId ?? null,
      prompt: row.prompt,
      model: MODEL,
      input_tokens: row.inputTokens,
      output_tokens: row.outputTokens,
      steps: row.steps,
      outcome: row.outcome,
    })
    .then(
      ({ error }) => {
        if (error)
          console.error('failed to log report generation', error.message);
      },
      (err: unknown) => console.error('failed to log report generation', err),
    );
  // onFinish/onAbort fire just as the stream (and isolate) wind down, and the
  // daily quota is counted from this table — waitUntil keeps the isolate alive
  // until the insert lands. EdgeRuntime is a Supabase edge-runtime global;
  // absent under plain `deno`, where fire-and-forget is the best we can do.
  if (typeof EdgeRuntime !== 'undefined') {
    // Promise.resolve: the Supabase builder chain is a PromiseLike, and
    // waitUntil wants a real Promise.
    EdgeRuntime.waitUntil(Promise.resolve(insert));
  }
};
