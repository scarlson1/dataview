// Setup type definitions for built-in Supabase Runtime APIs
import '@supabase/functions-js/edge-runtime.d.ts';
import { type SupabaseContext, withSupabase } from '@supabase/server';
import { Database } from '../_shared/database.types.ts';
import {
  executeReportSql,
  ROW_CAPS,
  type ReportSqlFailure,
} from '../_shared/reportExecutor.ts';

// POST JSON API. This request/response contract is FROZEN — the frontend is
// built against it in parallel.
//   Request:  { reportId?: string; sql?: string; cap?: 'preview' | 'export' }
//   Success:  { rows, fields, rowCount, truncated, durationMs, sql }
//   Failure:  { error: { code, message, hint?, position? } }  (400 / 404 / 422)
//
// The ONLY execution path is the shared guarded executor; the SQL runs as the
// calling user (RLS enforced) with the caller's verified JWT claims verbatim.

interface RunReportBody {
  reportId?: unknown;
  sql?: unknown;
  cap?: unknown;
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

    // Resolve the SQL to execute.
    let sqlToRun: string;
    if (reportId) {
      // Load the saved report with the CALLER's permissions (ctx.supabase is
      // the user-scoped client — `reports` RLS applies), so a user who can't
      // read reports can't run one.
      const { data: report, error } = await ctx.supabase
        .from('reports')
        .select('sql, archived_at')
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
    } else {
      sqlToRun = candidateSql as string;
    }

    // Execute via the shared guarded executor with the caller's claims verbatim.
    const result = await executeReportSql({
      sql: sqlToRun,
      claims: claims as Record<string, unknown>,
      rowCap,
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
