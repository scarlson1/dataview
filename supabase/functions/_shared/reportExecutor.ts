// Guarded read-only SQL executor for LLM-generated reports.
// See docs/LLM_REPORTS_PLAN.md ("The guarded executor" + "RLS / RBAC
// enforcement"). Both edge functions (run-report, generate-report's run_sql
// tool) call this single module, so the guardrails cannot be bypassed.
//
// This exported contract is FROZEN — Wave 2 (generate-report) is built against
// it in parallel. Do not rename or reshape ReportSqlResult / executeReportSql /
// runIntrospectionQuery / ROW_CAPS. (`values` was added later as an OPTIONAL
// executeReportSql field — additive, existing callers unchanged.)

import postgres from 'postgres';

export interface ReportSqlSuccess {
  ok: true;
  rows: Record<string, unknown>[];
  fields: string[]; // column names in select-list order
  rowCount: number; // rows returned (already capped)
  truncated: boolean;
  durationMs: number;
}

export interface ReportSqlFailure {
  ok: false;
  code: string; // Postgres SQLSTATE, or executor codes below
  message: string; // human/model-readable; never a raw driver stack
  hint?: string;
  position?: number;
}

export type ReportSqlResult = ReportSqlSuccess | ReportSqlFailure;

export const ROW_CAPS = {
  agentPreview: 200,
  builderPreview: 500,
  export: 50_000,
} as const;

// Cost gate thresholds (module constants — generous; this is a small internal
// DB, the gate only exists to catch accidental cross joins).
const MAX_TOTAL_COST = 1_000_000;
const MAX_PLAN_ROWS = 5_000_000;

// Byte cap for the serialized result payload (~5 MB).
const MAX_RESULT_BYTES = 5 * 1024 * 1024;

// Per-run statement timeout (belt + suspenders with the report_runner role
// default set in the migration).
const STATEMENT_TIMEOUT = '10s';

// Executor-specific failure codes (everything else is a Postgres SQLSTATE).
type ExecutorCode =
  | 'cost_limit'
  | 'byte_limit'
  | 'multi_statement'
  | 'timeout'
  | 'connect_error'
  | 'empty_sql'
  | 'forbidden_function';

const fail = (
  code: ExecutorCode | string,
  message: string,
  hint?: string,
  position?: number,
): ReportSqlFailure => ({ ok: false, code, message, hint, position });

// Module-scope client — edge isolates stay warm across invocations, so a small
// warm pool amortizes connection setup. Connects as `report_runner` via
// REPORT_DB_URL (edge-function secret; points at the transaction pooler in
// prod). Lazily created so a missing env var surfaces as a structured failure
// rather than a module-load crash.
let sql: ReturnType<typeof postgres> | null = null;

const getClient = (): ReturnType<typeof postgres> | null => {
  if (sql) return sql;
  const url = Deno.env.get('REPORT_DB_URL');
  if (!url) return null;
  sql = postgres(url, {
    max: 4,
    idle_timeout: 20,
    // Supavisor transaction mode discards session state between transactions,
    // so cross-transaction prepared-statement caching is unsafe. Extended
    // protocol is still used per query via `prepare: true` on sql.unsafe.
    prepare: false,
    // Don't spam edge logs with the driver's own notices.
    onnotice: () => {},
  });
  return sql;
};

// Strip a single trailing `;` and surrounding whitespace. The extended query
// protocol then rejects any remaining statement separators structurally, so a
// `; drop table` suffix cannot ride along.
const stripTrailingSemicolon = (s: string): string => {
  const trimmed = s.trim();
  return trimmed.endsWith(';') ? trimmed.slice(0, -1).trim() : trimmed;
};

const describe = (err: unknown): string => {
  const e = err as { message?: string };
  return typeof e?.message === 'string' ? e.message : String(err);
};

// Map a postgres.js driver error to the structured failure shape. Never surface
// a raw driver stack to the model or the UI.
const mapPgError = (err: unknown): ReportSqlFailure => {
  const e = err as {
    code?: string;
    message?: string;
    hint?: string;
    position?: string | number;
  };
  const code = typeof e.code === 'string' ? e.code : 'unknown';
  const rawMessage = typeof e.message === 'string' ? e.message : String(err);
  const position =
    e.position != null && !Number.isNaN(Number(e.position))
      ? Number(e.position)
      : undefined;

  // Statement timeout → surface as the executor `timeout` code so callers can
  // distinguish it from ordinary SQL errors. SQLSTATE 57014 = query_canceled.
  if (code === '57014') {
    return fail(
      'timeout',
      'query timed out — add filters or reduce the result set',
      e.hint,
      position,
    );
  }

  // A multi-statement string reaches the server as a syntax error (42601) with
  // the parser choking on the second statement. Surface it as `multi_statement`
  // so the caller/model gets an actionable message instead of a bare syntax
  // error.
  if (
    code === '42601' &&
    /cannot insert multiple commands|multiple commands into a prepared statement/i.test(
      rawMessage,
    )
  ) {
    return fail(
      'multi_statement',
      'only a single SQL statement is allowed',
      e.hint,
      position,
    );
  }

  return fail(code, rawMessage, e.hint, position);
};

// Byte-cap an already-fetched result set: stop accumulating once the serialized
// payload passes MAX_RESULT_BYTES, marking the result truncated.
const byteCapEncoder = new TextEncoder();

const applyByteCap = (
  rows: Record<string, unknown>[],
): { rows: Record<string, unknown>[]; truncated: boolean } => {
  let bytes = 0;
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    bytes += byteCapEncoder.encode(JSON.stringify(row)).length;
    if (bytes > MAX_RESULT_BYTES) {
      return { rows: out, truncated: true };
    }
    out.push(row);
  }
  return { rows: out, truncated: false };
};

// Evaluate the EXPLAIN plan against the cost/row thresholds. Returns a failure
// to reject, or null to allow.
const costGate = (plan: unknown): ReportSqlFailure | null => {
  const root = Array.isArray(plan)
    ? (plan[0] as Record<string, unknown> | undefined)?.['Plan']
    : (plan as Record<string, unknown> | undefined)?.['Plan'];
  const node = root as Record<string, unknown> | undefined;
  const totalCost = Number(node?.['Total Cost'] ?? 0);
  const planRows = Number(node?.['Plan Rows'] ?? 0);
  if (totalCost > MAX_TOTAL_COST || planRows > MAX_PLAN_ROWS) {
    return fail(
      'cost_limit',
      'query too expensive — add filters or join on keys',
    );
  }
  return null;
};

// Coerce driver-native values to JSON-safe primitives. postgres.js returns
// timestamp/timestamptz/date columns as JS `Date` objects and int8 as `bigint`
// in some configs — neither is a valid `JSONValue`. The generate-report agent
// hands run_sql/sample_rows output straight back to the AI SDK, which validates
// the tool result as `JSONValue` when standardizing the next-step prompt; a raw
// `Date` there throws AI_InvalidPromptError and aborts the whole agent loop
// (symptom: a report over any table with a timestamp column silently produces
// no result and no candidate SQL). Normalizing here fixes both the model path
// and the streamed preview in one place. Date → ISO string (via toJSON),
// bigint → string; everything else round-trips through JSON unchanged.
const toJsonSafe = (
  rows: Record<string, unknown>[],
): Record<string, unknown>[] =>
  JSON.parse(
    JSON.stringify(rows, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );

// Column names in select-list order. postgres.js attaches `.columns` (an array
// of { name }) to the returned result array; fall back to first-row keys.
const extractFields = (rows: Record<string, unknown>[]): string[] => {
  const cols = (rows as unknown as { columns?: { name: string }[] }).columns;
  if (Array.isArray(cols) && cols.length) return cols.map((c) => c.name);
  return rows.length ? Object.keys(rows[0]) : [];
};

/**
 * Run untrusted SQL as the calling user (RLS enforced).
 *
 * `claims` MUST be the verified access token's FULL claim set, verbatim — it
 * carries both `sub` (→ auth.uid(), ownership-scoped RLS) and the custom
 * `user_role` claim (→ authorize(), RBAC). The executor only serializes what
 * it's given; never hand-build a claims object or accept claims from a request
 * body (a hand-built `user_role` would forge RBAC).
 */
export const executeReportSql = async (opts: {
  sql: string;
  claims: Record<string, unknown>;
  rowCap: number;
  /**
   * Positional bind values for $1..$n in `sql` (parameterized reports — see
   * reportParams.ts). Bound via the extended protocol on both the EXPLAIN cost
   * gate and the capped run, so values never appear in the SQL text.
   */
  values?: unknown[];
}): Promise<ReportSqlResult> => {
  const client = getClient();
  if (!client) {
    return fail('connect_error', 'report executor is not configured');
  }

  const query = stripTrailingSemicolon(opts.sql);
  if (!query) {
    return fail('empty_sql', 'no SQL to execute');
  }

  // The untrusted SQL runs in the same session where request.jwt.claims was
  // just set, and READ ONLY does not block set_config — a SELECT could call
  // set_config('request.jwt.claims', '<forged>', true) in a CTE to escalate
  // RLS/RBAC for the rest of the query. A plain SELECT can't obfuscate the
  // function name (no DO/EXECUTE available), so a string check suffices.
  if (/set_config/i.test(query)) {
    return fail('forbidden_function', 'set_config is not allowed in report SQL');
  }

  const claimsJson = JSON.stringify(opts.claims);
  const values = (opts.values ?? []) as never[];
  const started = Date.now();

  // A single reserved connection so the sequential SET LOCAL / claims GUC apply
  // to the same session as the query. Everything runs inside one READ ONLY
  // transaction and is rolled back — nothing to persist.
  let reserved: Awaited<ReturnType<typeof client.reserve>>;
  try {
    reserved = await client.reserve();
  } catch (err) {
    return fail('connect_error', `could not connect: ${describe(err)}`);
  }

  try {
    await reserved`begin transaction read only`;
    try {
      // Reproduce PostgREST's environment: run as `authenticated` with the
      // caller's claims, so RLS + authorize() apply exactly as in the app.
      await reserved`set local role authenticated`;
      await reserved`select set_config('request.jwt.claims', ${claimsJson}, true)`;
      await reserved`set local search_path = public`;
      await reserved.unsafe(
        `set local statement_timeout = '${STATEMENT_TIMEOUT}'`,
      );

      // Cost gate: EXPLAIN (FORMAT JSON) first; reject on runaway estimates.
      // Extended protocol (prepare: true) also rejects multi-statement strings
      // here, before we ever touch data.
      let plan: unknown;
      try {
        const explainRows = await reserved.unsafe(
          `explain (format json) ${query}`,
          values,
          { prepare: true },
        );
        plan = (explainRows[0] as Record<string, unknown>)?.['QUERY PLAN'];
      } catch (err) {
        return mapPgError(err);
      }
      const gate = costGate(plan);
      if (gate) return gate;

      // Row cap: fetch cap+1 so we can detect truncation. Wrapping in a
      // subquery keeps the caller's SELECT intact. The newline before the
      // closing paren keeps a trailing `-- comment` from swallowing it.
      const cap = opts.rowCap;
      let raw: Record<string, unknown>[];
      try {
        raw = (await reserved.unsafe(
          `select * from (${query}\n) _r limit ${cap + 1}`,
          values,
          { prepare: true },
        )) as unknown as Record<string, unknown>[];
      } catch (err) {
        return mapPgError(err);
      }

      // Column order comes off the FULL result (before slicing), so an empty
      // capped result still reports its select-list columns.
      const fields = extractFields(raw);

      let truncated = false;
      if (raw.length > cap) {
        raw = raw.slice(0, cap);
        truncated = true;
      }

      const capped = applyByteCap(raw);
      if (capped.truncated) truncated = true;

      return {
        ok: true,
        rows: toJsonSafe(capped.rows),
        fields,
        rowCount: capped.rows.length,
        truncated,
        durationMs: Date.now() - started,
      };
    } finally {
      // Never commit; nothing to persist.
      await reserved`rollback`.catch(() => {});
    }
  } catch (err) {
    return mapPgError(err);
  } finally {
    reserved.release();
  }
};

/**
 * Read-only introspection (information_schema / pg_catalog) inside the same
 * read-only + SET ROLE authenticated wrapper; no claims needed (schema metadata
 * is identical for every user). Parameterized to keep it injection-safe.
 */
export const runIntrospectionQuery = async (
  sql: string,
  params: unknown[] = [],
): Promise<Record<string, unknown>[]> => {
  const client = getClient();
  if (!client) {
    throw new Error('report executor is not configured');
  }
  const reserved = await client.reserve();
  try {
    await reserved`begin transaction read only`;
    try {
      await reserved`set local role authenticated`;
      await reserved`set local search_path = public`;
      await reserved.unsafe(
        `set local statement_timeout = '${STATEMENT_TIMEOUT}'`,
      );
      const rows = (await reserved.unsafe(sql, params as never[], {
        prepare: true,
      })) as unknown as Record<string, unknown>[];
      return rows;
    } finally {
      await reserved`rollback`.catch(() => {});
    }
  } finally {
    reserved.release();
  }
};
