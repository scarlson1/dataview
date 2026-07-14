// Setup type definitions for built-in Supabase Runtime APIs
import '@supabase/functions-js/edge-runtime.d.ts';
import { type SupabaseContext, withSupabase } from '@supabase/server';
import { Database } from '../_shared/database.types.ts';
import { coerceInputValues } from '../_shared/rater/coerce.ts';
import {
  type DbFetchQuery,
  executeRater,
  type HttpFetchRequest,
  type RaterAdapters,
} from '../_shared/rater/interpreter.ts';
import { materializeLookupTables } from '../_shared/rater/materialize.ts';
import {
  type LookupTableContent,
  type RaterDefinition,
  raterDefinitionSchema,
} from '../_shared/rater/schema.ts';
import { validateRaterDefinition } from '../_shared/rater/validate.ts';

// POST JSON API — the single execution path for saved raters AND builder test
// runs (inline definitions).
//   Request:  { raterId?: string; definition?: RaterDefinition;   // exactly one
//               inputs?: Record<string, unknown>;
//               sourceRecord?: { table: string; id: number };
//               dryRun?: boolean }                                // no audit row / last_run_at bump
//   Success:  { outputs, trace, durationMs }
//   Failure:  { error: { code, message, stepId? } }  (400 / 404 / 422)
//
// DB fetch steps run through the CALLER's user-scoped client — RLS is the
// gate on what a rater can read. External http fetch steps are guarded by the
// RATER_HTTP_ALLOWLIST env var (comma-separated host suffixes; unset/empty =
// external fetches disabled), https-only, with a timeout and a response cap.

interface RunRaterBody {
  raterId?: unknown;
  definition?: unknown;
  inputs?: unknown;
  sourceRecord?: unknown;
  dryRun?: unknown;
}

const MAX_HTTP_RESPONSE_BYTES = 1_000_000;

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*', // Or restrict to 'https://dataview-nine.vercel.app'
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
//   'Access-Control-Allow-Methods': 'POST, OPTIONS',
// }

const errorResponse = (
  status: number,
  err: { code: string; message: string; stepId?: string },
): Response => Response.json({ error: err }, { status });

const httpAllowlist = (): string[] =>
  (Deno.env.get('RATER_HTTP_ALLOWLIST') ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const hostAllowed = (host: string, allowlist: string[]): boolean =>
  allowlist.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));

// Reject obvious private/internal targets. (Best-effort literal check; the
// allowlist is the primary gate.)
const PRIVATE_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$|172\.(1[6-9]|2\d|3[01])\.)/i;

const guardedHttpFetch = async (
  request: HttpFetchRequest,
): Promise<unknown> => {
  const url = new URL(request.url);
  if (url.protocol !== 'https:') {
    throw new Error('external fetches must use https');
  }
  if (PRIVATE_HOST_RE.test(url.hostname)) {
    throw new Error('internal hosts are not allowed');
  }
  const allowlist = httpAllowlist();
  if (!allowlist.length) {
    throw new Error(
      'external API fetches are disabled (RATER_HTTP_ALLOWLIST is not set)',
    );
  }
  if (!hostAllowed(url.hostname.toLowerCase(), allowlist)) {
    throw new Error(`host '${url.hostname}' is not on the allowlist`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs);
  try {
    const response = await fetch(url, {
      method: request.method,
      headers: { Accept: 'application/json', ...request.headers },
      signal: controller.signal,
      redirect: 'error',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    if (text.length > MAX_HTTP_RESPONSE_BYTES) {
      throw new Error('response too large');
    }
    return JSON.parse(text);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`timed out after ${request.timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
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

    let body: RunRaterBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, {
        code: 'bad_request',
        message: 'Invalid JSON body',
      });
    }

    const raterId = typeof body.raterId === 'string' ? body.raterId : null;
    const inlineDefinition = body.definition ?? null;

    // Exactly one of raterId / definition.
    if ((raterId && inlineDefinition) || (!raterId && !inlineDefinition)) {
      return errorResponse(400, {
        code: 'bad_request',
        message: 'Provide exactly one of `raterId` or `definition`',
      });
    }

    const providedInputs: Record<string, unknown> =
      body.inputs !== null &&
      typeof body.inputs === 'object' &&
      !Array.isArray(body.inputs)
        ? (body.inputs as Record<string, unknown>)
        : {};

    const sourceRecord =
      body.sourceRecord !== null &&
      typeof body.sourceRecord === 'object' &&
      !Array.isArray(body.sourceRecord) &&
      typeof (body.sourceRecord as Record<string, unknown>).table ===
        'string' &&
      typeof (body.sourceRecord as Record<string, unknown>).id === 'number'
        ? (body.sourceRecord as { table: string; id: number })
        : null;

    const dryRun = body.dryRun === true;

    // Resolve the definition to execute. (Single resolution point — when
    // rater_versions lands, version selection swaps in here.)
    let rawDefinition: unknown;
    if (raterId) {
      // Loaded with the CALLER's permissions (raters RLS applies), so a user
      // who can't read raters can't run one.
      const { data: rater, error } = await ctx.supabase
        .from('raters')
        .select('definition, archived_at')
        .eq('id', raterId)
        .maybeSingle();

      if (error) {
        return errorResponse(422, {
          code: error.code ?? 'load_error',
          message: error.message,
        });
      }
      if (!rater || rater.archived_at) {
        return errorResponse(404, {
          code: 'not_found',
          message: 'Rater not found',
        });
      }
      rawDefinition = rater.definition;
    } else {
      rawDefinition = inlineDefinition;
    }

    // Zod + static validation — the saved definition is re-validated
    // defensively (a bad row must fail closed, not execute).
    const parsed = raterDefinitionSchema.safeParse(rawDefinition);
    if (!parsed.success) {
      return errorResponse(422, {
        code: 'invalid_definition',
        message: `Invalid rater definition: ${parsed.error.issues[0]?.message ?? 'schema mismatch'}`,
      });
    }
    const definition: RaterDefinition = parsed.data;

    const staticCheck = validateRaterDefinition(definition);
    if (staticCheck.errors.length) {
      const first = staticCheck.errors[0];
      return errorResponse(422, {
        code: 'invalid_definition',
        message: first.message,
        ...(first.stepId ? { stepId: first.stepId } : {}),
      });
    }

    // Resolve any shared lookup-table references into inline grids. The load
    // runs through the CALLER's client, so rater_lookup_tables RLS gates what a
    // rater can reach; the materialized definition is what executes AND what is
    // snapshotted, keeping past runs reproducible after a shared table changes.
    const materialized = await materializeLookupTables(
      definition,
      async (tableId) => {
        const { data, error } = await ctx.supabase
          .from('rater_lookup_tables')
          .select('columns, rows')
          .eq('id', tableId)
          .is('archived_at', null)
          .maybeSingle();
        if (error || !data) return null;
        return { columns: data.columns, rows: data.rows } as LookupTableContent;
      },
    );
    if (materialized.errors.length) {
      const first = materialized.errors[0];
      return errorResponse(422, {
        code: 'invalid_definition',
        message: first.message,
        stepId: first.stepId,
      });
    }
    const execDefinition = materialized.definition;

    const coerced = coerceInputValues(definition.inputs, providedInputs);
    if (!coerced.ok) {
      return errorResponse(422, {
        code: coerced.code,
        message: coerced.message,
      });
    }

    // DB fetch steps run through the user-scoped client — RLS applies.
    const adapters: RaterAdapters = {
      dbFetch: async (query: DbFetchQuery) => {
        let q = ctx.supabase
          .from(query.table as never)
          .select(query.select.join(','));
        for (const f of query.filters) {
          // PostgREST `in` takes a parenthesized list; strings are quoted.
          const value =
            f.op === 'in' && Array.isArray(f.value)
              ? `(${f.value
                  .map((v) =>
                    typeof v === 'string'
                      ? `"${v.replace(/"/g, '\\"')}"`
                      : String(v),
                  )
                  .join(',')})`
              : f.value;
          q = q.filter(f.column, f.op, value as never);
        }
        if (query.orderBy) {
          q = q.order(query.orderBy.column, {
            ascending: query.orderBy.ascending,
          });
        }
        if (query.limit !== undefined) {
          q = q.limit(query.limit);
        }
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return (data ?? []) as unknown as Record<string, unknown>[];
      },
      httpFetch: guardedHttpFetch,
    };

    const started = Date.now();
    const result = await executeRater(execDefinition, coerced.values, adapters);
    const durationMs = Date.now() - started;

    // Audit + last_run_at for saved raters (fire-and-forget; never let audit
    // failures break the response). Failed runs are audited too.
    if (raterId && !dryRun) {
      touchLastRun(ctx, raterId);
      logRun(ctx, {
        raterId,
        userId: claims.sub,
        inputs: coerced.values,
        outputs: result.outputs,
        outcome: result.outcome,
        definitionSnapshot: execDefinition,
        trace: result.trace,
        sourceRecord,
        durationMs,
        error: result.error
          ? `${result.error.stepId}: ${result.error.message}`
          : null,
      });
    }

    if (result.error) {
      // Carries the partial trace + outputs so the builder can show exactly
      // where the run stopped.
      return Response.json(
        {
          error: {
            code: 'step_error',
            message: result.error.message,
            stepId: result.error.stepId,
          },
          outputs: result.outputs,
          trace: result.trace,
          durationMs,
        },
        { status: 422 },
      );
    }

    // A terminal decision (e.g. decline) is a SUCCESSFUL outcome, not an error
    // — 200 with `outcome` set. The UI shows a banner instead of premium cards.
    return Response.json({
      outputs: result.outputs,
      outcome: result.outcome,
      trace: result.trace,
      durationMs,
    });
  }),
};

// --- audit helpers (service role; bypasses RLS) -----------------------------

type Ctx = SupabaseContext<Database>;

const touchLastRun = (ctx: Ctx, raterId: string): void => {
  ctx.supabaseAdmin
    .from('raters')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', raterId)
    .then(undefined, () => {});
};

const logRun = (
  ctx: Ctx,
  row: {
    raterId: string;
    userId: string;
    inputs: Record<string, unknown>;
    outputs: unknown;
    outcome: unknown;
    definitionSnapshot: RaterDefinition;
    trace: unknown;
    sourceRecord: { table: string; id: number } | null;
    durationMs: number;
    error: string | null;
  },
): void => {
  ctx.supabaseAdmin
    .from('rater_runs')
    .insert({
      rater_id: row.raterId,
      user_id: row.userId,
      inputs: row.inputs as never,
      outputs: row.outputs as never,
      outcome: row.outcome as never,
      definition_snapshot: row.definitionSnapshot as never,
      trace: row.trace as never,
      source_record: row.sourceRecord as never,
      duration_ms: row.durationMs,
      error: row.error,
    })
    .then(undefined, () => {});
};
