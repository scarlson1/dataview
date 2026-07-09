// Rater interpreter — executes a validated definition against coerced inputs.
//
// Runtime-agnostic: all I/O (db queries, external http) is injected via
// RaterAdapters, so the same code runs in the run-rater edge function, unit
// tests with stub adapters, and (later) a client-side dry run.
//
// Execution is a sequential walk of the step list; a branch evaluates its
// case guards in order and recurses into the first truthy case (other cases'
// steps are recorded as `skipped` in the trace). The first step error halts
// the run — remaining steps are recorded as skipped and the error is
// reported with its stepId.

import { evaluate, ExprError, parse, type Scope } from './expr.ts';
import type {
  BranchStep,
  DbFetchStep,
  HttpFetchStep,
  InlineLookupStep,
  RaterDefinition,
  RaterOutputValue,
  RaterRunResult,
  RaterStep,
  TraceStep,
} from './schema.ts';

export interface DbFetchQuery {
  table: string;
  select: string[];
  filters: { column: string; op: DbFetchStep['filters'][number]['op']; value: unknown }[];
  limit?: number;
  orderBy?: { column: string; ascending: boolean };
}

export interface HttpFetchRequest {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  timeoutMs: number;
}

export interface RaterAdapters {
  dbFetch: (query: DbFetchQuery) => Promise<Record<string, unknown>[]>;
  // Absent → http fetch steps fail with a clear error (e.g. client-side runs).
  httpFetch?: (request: HttpFetchRequest) => Promise<unknown>;
}

class StepError extends Error {
  constructor(
    readonly stepId: string,
    message: string,
  ) {
    super(message);
    this.name = 'StepError';
  }
}

const now = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

export const executeRater = async (
  definition: RaterDefinition,
  inputs: Record<string, unknown>,
  adapters: RaterAdapters,
): Promise<RaterRunResult> => {
  const scope: Scope = { inputs };
  const trace: TraceStep[] = [];
  const outputs: Record<string, RaterOutputValue> = {};
  let error: RaterRunResult['error'] = null;
  let outcome: RaterRunResult['outcome'] = null;

  const evalExpr = (stepId: string, what: string, src: string): unknown => {
    try {
      return evaluate(parse(src), scope);
    } catch (e) {
      const msg = e instanceof ExprError ? e.message : String(e);
      throw new StepError(stepId, `${what}: ${msg}`);
    }
  };

  // Record every step in a subtree as skipped (untaken branch cases, steps
  // after a halt).
  const recordSkipped = (steps: RaterStep[]): void => {
    for (const step of steps) {
      trace.push({ id: step.id, type: step.type, label: step.label, status: 'skipped' });
      if (step.type === 'branch') {
        for (const c of step.cases) recordSkipped(c.steps);
        if (step.else) recordSkipped(step.else);
      }
    }
  };

  // `step` is always the inline shape here: ref lookups are materialized into
  // inline steps (columns + rows) before execution — see materialize.ts.
  const runLookup = (
    step: InlineLookupStep,
  ): { value: unknown; detail: Record<string, unknown> } => {
    const colIndex = new Map(step.columns.map((c, i) => [c.name, i]));
    const rowToObject = (row: (typeof step.rows)[number]): Record<string, unknown> =>
      Object.fromEntries(step.columns.map((c, i) => [c.name, row[i]]));

    // Evaluate each match's probe value once, then scan rows in order.
    const probes = step.match.map((m, i) =>
      evalExpr(step.id, `match ${i + 1} value`, m.value),
    );

    const matches = (row: (typeof step.rows)[number]): boolean =>
      step.match.every((m, mi) => {
        const probe = probes[mi];
        if (m.mode === 'exact') {
          const cell = row[colIndex.get(m.column) as number];
          if (typeof cell === 'string' && typeof probe === 'string') {
            return cell.toLowerCase() === probe.toLowerCase();
          }
          return cell === probe;
        }
        // range banding: null bound = open-ended
        const value =
          typeof probe === 'number'
            ? probe
            : (() => {
                throw new StepError(
                  step.id,
                  `match ${mi + 1}: range matching needs a number, got ${JSON.stringify(probe)}`,
                );
              })();
        const min = row[colIndex.get(m.minColumn) as number];
        const max = row[colIndex.get(m.maxColumn) as number];
        if (min !== null && typeof min === 'number') {
          if (m.minInclusive ? value < min : value <= min) return false;
        }
        if (max !== null && typeof max === 'number') {
          if (m.maxInclusive ? value > max : value >= max) return false;
        }
        return true;
      });

    for (const [i, row] of step.rows.entries()) {
      if (matches(row)) {
        return { value: rowToObject(row), detail: { matchedRowIndex: i } };
      }
    }

    if (step.onMiss === 'default' && step.defaultRow) {
      return { value: step.defaultRow, detail: { matchedRowIndex: null, usedDefault: true } };
    }
    throw new StepError(
      step.id,
      `no lookup row matched (probes: ${probes.map((p) => JSON.stringify(p)).join(', ')})`,
    );
  };

  const runDbFetch = async (
    step: DbFetchStep,
  ): Promise<{ value: unknown; detail: Record<string, unknown> }> => {
    const filters = step.filters.map((f) => ({
      column: f.column,
      op: f.op,
      value: evalExpr(step.id, `filter on '${f.column}'`, f.value),
    }));

    let rows: Record<string, unknown>[];
    try {
      rows = await adapters.dbFetch({
        table: step.table,
        select: step.select,
        filters,
        limit: step.mode === 'list' ? step.limit : 2, // 2 is enough to detect ambiguity
        orderBy: step.orderBy
          ? { column: step.orderBy.column, ascending: step.orderBy.ascending }
          : undefined,
      });
    } catch (e) {
      throw new StepError(step.id, `query failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    const detail: Record<string, unknown> = {
      table: step.table,
      rowCount: rows.length,
      filters: filters.map((f) => ({ column: f.column, op: f.op, value: f.value })),
    };

    if (step.mode === 'list') return { value: rows, detail };
    if (rows.length === 0) {
      if (step.onEmpty === 'error' || step.mode === 'single') {
        throw new StepError(step.id, `no ${step.table} row matched`);
      }
      return { value: null, detail };
    }
    if (rows.length > 1 && step.mode === 'single') {
      throw new StepError(step.id, `expected exactly one ${step.table} row, got more`);
    }
    return { value: rows[0], detail };
  };

  const runHttpFetch = async (
    step: HttpFetchStep,
  ): Promise<{ value: unknown; detail: Record<string, unknown> }> => {
    if (!adapters.httpFetch) {
      throw new StepError(step.id, 'external API fetches only run on the server');
    }

    // Resolve {{expr}} segments in the url template (URL-encoded).
    const url = step.url.replace(/\{\{(.*?)\}\}/g, (_m, src: string) => {
      const v = evalExpr(step.id, 'url segment', src);
      return encodeURIComponent(v === null || v === undefined ? '' : String(v));
    });

    const query = Object.entries(step.query ?? {}).map(([key, src]) => {
      const v = evalExpr(step.id, `query '${key}'`, src);
      return [key, v === null || v === undefined ? '' : String(v)] as const;
    });
    const withQuery = query.length
      ? `${url}${url.includes('?') ? '&' : '?'}${query
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&')}`
      : url;

    let response: unknown;
    try {
      response = await adapters.httpFetch({
        method: step.method,
        url: withQuery,
        headers: step.headers ?? {},
        timeoutMs: step.timeoutMs,
      });
    } catch (e) {
      throw new StepError(step.id, `request failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    const value: Record<string, unknown> = {};
    for (const ex of step.extract) {
      let current: unknown = response;
      for (const key of ex.path.split('.')) {
        if (current === null || current === undefined || typeof current !== 'object') {
          throw new StepError(step.id, `extract '${ex.name}': path '${ex.path}' not found in response`);
        }
        current = (current as Record<string, unknown>)[key];
      }
      if (current === undefined) {
        throw new StepError(step.id, `extract '${ex.name}': path '${ex.path}' not found in response`);
      }
      value[ex.name] = current;
    }

    return { value, detail: { url: withQuery, extracted: Object.keys(value) } };
  };

  const runSteps = async (steps: RaterStep[]): Promise<void> => {
    for (const [index, step] of steps.entries()) {
      // A prior error OR a fired decision halts everything below it.
      if (error || outcome) {
        recordSkipped(steps.slice(index));
        return;
      }

      const started = now();
      try {
        // Decision: a terminal step. Fires when `when` is absent or truthy;
        // sets the run outcome and halts. A falsy `when` falls through.
        if (step.type === 'decision') {
          let fires = true;
          if (step.when !== undefined) {
            const cond = evalExpr(step.id, 'condition', step.when);
            if (typeof cond !== 'boolean') {
              throw new StepError(
                step.id,
                `condition must be true/false, got ${JSON.stringify(cond)}`,
              );
            }
            fires = cond;
          }

          if (!fires) {
            trace.push({
              id: step.id,
              type: 'decision',
              label: step.label,
              status: 'ok',
              ms: Math.round(now() - started),
              detail: { fired: false },
            });
            continue;
          }

          const reason =
            step.reason !== undefined
              ? (() => {
                  const r = evalExpr(step.id, 'reason', step.reason);
                  return r === null || r === undefined ? null : String(r);
                })()
              : null;

          outcome = {
            decision: step.outcome,
            reason,
            stepId: step.id,
            ...(step.label ? { label: step.label } : {}),
          };
          trace.push({
            id: step.id,
            type: 'decision',
            label: step.label,
            status: 'ok',
            ms: Math.round(now() - started),
            detail: { fired: true, outcome: step.outcome, reason },
          });
          recordSkipped(steps.slice(index + 1));
          return;
        }

        if (step.type === 'branch') {
          const branch = step as BranchStep;
          let taken: number | 'else' | null = null;
          for (const [i, c] of branch.cases.entries()) {
            const cond = evalExpr(step.id, `case ${i + 1} ('${c.label}') condition`, c.when);
            if (typeof cond !== 'boolean') {
              throw new StepError(
                step.id,
                `case ${i + 1} ('${c.label}') condition must be true/false, got ${JSON.stringify(cond)}`,
              );
            }
            if (cond) {
              taken = i;
              break;
            }
          }
          if (taken === null) taken = 'else';

          trace.push({
            id: step.id,
            type: 'branch',
            label: step.label,
            status: 'ok',
            ms: Math.round(now() - started),
            detail: {
              caseTaken: taken,
              caseLabel: taken === 'else' ? 'else' : branch.cases[taken].label,
            },
          });

          for (const [i, c] of branch.cases.entries()) {
            if (i !== taken) recordSkipped(c.steps);
          }
          if (taken === 'else') {
            if (branch.else) await runSteps(branch.else);
          } else {
            if (branch.else) recordSkipped(branch.else);
            await runSteps(branch.cases[taken].steps);
          }
          continue;
        }

        let value: unknown;
        let detail: Record<string, unknown> | undefined;

        switch (step.type) {
          case 'calc':
            value = evalExpr(step.id, 'expression', step.expr);
            break;
          case 'lookup': {
            if (step.source === 'ref') {
              // Should never reach the interpreter: the run path materializes
              // ref lookups into inline steps first. Fail closed if it didn't.
              throw new StepError(
                step.id,
                'unresolved shared lookup table reference (resolve it before running)',
              );
            }
            const r = runLookup(step);
            value = r.value;
            detail = r.detail;
            break;
          }
          case 'fetch': {
            const r = step.source === 'db' ? await runDbFetch(step) : await runHttpFetch(step);
            value = r.value;
            detail = r.detail;
            break;
          }
          case 'output': {
            value = evalExpr(step.id, 'expression', step.expr);
            outputs[step.id] = { label: step.label, value, format: step.format };
            break;
          }
        }

        scope[step.id] = value;
        trace.push({
          id: step.id,
          type: step.type,
          label: step.label,
          status: 'ok',
          value,
          ms: Math.round(now() - started),
          ...(detail ? { detail } : {}),
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const stepId = e instanceof StepError ? e.stepId : step.id;
        trace.push({
          id: step.id,
          type: step.type,
          label: step.label,
          status: 'error',
          ms: Math.round(now() - started),
          error: message,
        });
        error = { stepId, message };
        recordSkipped(steps.slice(index + 1));
        return;
      }
    }
  };

  await runSteps(definition.steps);

  return { outputs, outcome, trace: { steps: trace }, error };
};
