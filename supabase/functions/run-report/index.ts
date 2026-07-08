// Setup type definitions for built-in Supabase Runtime APIs
import '@supabase/functions-js/edge-runtime.d.ts';
import { type SupabaseContext, withSupabase } from '@supabase/server';
import { Database } from '../_shared/database.types.ts';
import {
  executeReportSql,
  ROW_CAPS,
  type ReportSqlFailure,
} from '../_shared/reportExecutor.ts';
import {
  coerceParamValues,
  compileNamedPlaceholders,
  type ParamScalar,
  reportParamsSchema,
} from '../_shared/reportParams.ts';

// POST JSON API. This request/response contract is FROZEN — the frontend is
// built against it in parallel. (`params` was added later as an OPTIONAL
// field — additive, existing callers unchanged.)
//   Request:  { reportId?: string; sql?: string; cap?: 'preview' | 'export';
//               params?: Record<string, unknown> }  // parameterized reports
//   Success:  { rows, fields, rowCount, truncated, durationMs, sql }
//   Failure:  { error: { code, message, hint?, position? } }  (400 / 404 / 422)
//
// The ONLY execution path is the shared guarded executor; the SQL runs as the
// calling user (RLS enforced) with the caller's verified JWT claims verbatim.
// Parameter values are bound via positional bind parameters (reportParams.ts),
// never interpolated into the SQL text.

interface RunReportBody {
  reportId?: unknown;
  sql?: unknown;
  cap?: unknown;
  params?: unknown;
}

const errorResponse = (
  status: number,
  err: { code: string; message: string; hint?: string; position?: number },
): Response => Response.json({ error: err }, { status });

export default {
  fetch: withSupabase<Database>({ auth: ['user'] }, async (req, ctx) => {
    // withSupabase({ auth: ['user'] }) has already verified the JWT; jwtClaims
    // is the raw verified payload (carries `sub` + the custom `user_role`).
    const claims = ctx.jwtClaims;
    if (!claims?.sub) {
      return errorResponse(401, {
        code: 'unauthorized',
        message: 'Unauthorized',
      });
    }

    let body: RunReportBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, {
        code: 'bad_request',
        message: 'Invalid JSON body',
      });
    }

    const reportId = typeof body.reportId === 'string' ? body.reportId : null;
    const candidateSql = typeof body.sql === 'string' ? body.sql : null;

    // Exactly one of reportId / sql.
    if ((reportId && candidateSql) || (!reportId && !candidateSql)) {
      return errorResponse(400, {
        code: 'bad_request',
        message: 'Provide exactly one of `reportId` or `sql`',
      });
    }

    // cap defaults to 'preview' (builder preview grid, 500 rows).
    const capMode = body.cap === 'export' ? 'export' : 'preview';
    const rowCap =
      capMode === 'export' ? ROW_CAPS.export : ROW_CAPS.builderPreview;

    const providedParams: Record<string, unknown> =
      body.params !== null &&
      typeof body.params === 'object' &&
      !Array.isArray(body.params)
        ? (body.params as Record<string, unknown>)
        : {};

    // Resolve the SQL to execute + bind values for any {{placeholder}}s.
    // `sqlToRun` stays in the stored placeholder form (echoed back for the UI);
    // the compiled $1..$n form + values go to the executor.
    let sqlToRun: string;
    let compiledSql: string;
    let values: ParamScalar[];

    if (reportId) {
      // Load the saved report with the CALLER's permissions (ctx.supabase is
      // the user-scoped client — `reports` RLS applies), so a user who can't
      // read reports can't run one.
      const { data: report, error } = await ctx.supabase
        .from('reports')
        .select('sql, params, archived_at')
        .eq('id', reportId)
        .maybeSingle();

      if (error) {
        return errorResponse(422, {
          code: error.code ?? 'load_error',
          message: error.message,
        });
      }
      // Unknown (or RLS-hidden) or archived → 404.
      if (!report || report.archived_at) {
        return errorResponse(404, {
          code: 'not_found',
          message: 'Report not found',
        });
      }
      sqlToRun = report.sql;
      const compiled = compileNamedPlaceholders(report.sql);
      compiledSql = compiled.sql;

      if (report.params !== null) {
        // Saved config is validated defensively — it was checked at submit
        // time, but a bad row must fail closed, not execute broken SQL.
        const config = reportParamsSchema.safeParse(report.params);
        if (!config.success) {
          return errorResponse(422, {
            code: 'invalid_param_config',
            message:
              'This report has an invalid parameter config. Refine it with AI to regenerate.',
          });
        }
        const known = new Set(config.data.map((p) => p.name));
        const unknown = compiled.order.filter((n) => !known.has(n));
        if (unknown.length) {
          return errorResponse(422, {
            code: 'unknown_placeholder',
            message: `Report SQL references undeclared parameters: ${unknown.join(', ')}. Refine it with AI to fix.`,
          });
        }
        const coerced = coerceParamValues(config.data, providedParams);
        if (!coerced.ok) {
          return errorResponse(422, {
            code: coerced.code,
            message: coerced.message,
          });
        }
        values = compiled.order.map((n) => coerced.values[n]);
      } else if (compiled.order.length) {
        return errorResponse(422, {
          code: 'unknown_placeholder',
          message: `Report SQL has placeholders (${compiled.order.join(', ')}) but no parameter config. Refine it with AI to fix.`,
        });
      } else {
        values = [];
      }
    } else {
      // Ad-hoc SQL (builder hand-run). There's no saved config to coerce
      // against, so placeholders just need a plain scalar per name.
      sqlToRun = candidateSql as string;
      const compiled = compileNamedPlaceholders(sqlToRun);
      compiledSql = compiled.sql;

      const missing: string[] = [];
      values = compiled.order.map((n) => {
        const v = providedParams[n];
        if (
          v === null ||
          typeof v === 'string' ||
          typeof v === 'number' ||
          typeof v === 'boolean'
        ) {
          return v;
        }
        missing.push(n);
        return null;
      });
      if (missing.length) {
        return errorResponse(422, {
          code: 'missing_param',
          message: `Provide a value for each placeholder in \`params\`: ${missing.map((n) => `{{${n}}}`).join(', ')}`,
        });
      }
    }

    // Execute via the shared guarded executor with the caller's claims verbatim.
    const result = await executeReportSql({
      sql: compiledSql,
      claims: claims as Record<string, unknown>,
      rowCap,
      values,
    });

    if (!result.ok) {
      // Audit the failed run for saved reports (fire-and-forget, service role).
      if (reportId) {
        logRun(ctx, {
          reportId,
          userId: claims.sub,
          durationMs: null,
          rowCount: null,
          error: result.message,
        });
      }
      return errorResponse(422, failureBody(result));
    }

    // Fire-and-forget audit + last_run_at bump for saved reports. Never let an
    // audit failure break the response.
    if (reportId) {
      touchLastRun(ctx, reportId);
      logRun(ctx, {
        reportId,
        userId: claims.sub,
        durationMs: result.durationMs,
        rowCount: result.rowCount,
        error: null,
      });
    }

    return Response.json({
      rows: result.rows,
      fields: result.fields,
      rowCount: result.rowCount,
      truncated: result.truncated,
      durationMs: result.durationMs,
      sql: sqlToRun, // what was executed, so the builder can show it
    });
  }),
};

const failureBody = (f: ReportSqlFailure) => ({
  code: f.code,
  message: f.message,
  ...(f.hint !== undefined ? { hint: f.hint } : {}),
  ...(f.position !== undefined ? { position: f.position } : {}),
});

// --- audit helpers (service role; bypasses RLS) -----------------------------

type Ctx = SupabaseContext<Database>;

const touchLastRun = (ctx: Ctx, reportId: string): void => {
  ctx.supabaseAdmin
    .from('reports')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', reportId)
    .then(undefined, () => {});
};

const logRun = (
  ctx: Ctx,
  row: {
    reportId: string;
    userId: string;
    durationMs: number | null;
    rowCount: number | null;
    error: string | null;
  },
): void => {
  ctx.supabaseAdmin
    .from('report_runs')
    .insert({
      report_id: row.reportId,
      user_id: row.userId,
      duration_ms: row.durationMs,
      row_count: row.rowCount,
      error: row.error,
    })
    .then(undefined, () => {});
};
