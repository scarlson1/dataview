// Rater DSL — the canonical schema for rater logic definitions.
//
// A rater definition is a single self-contained JSON document: typed inputs
// plus an ordered list of steps (calc / lookup / fetch / branch / output).
// Each step's `id` doubles as its binding name; expressions reference
// `inputs.<name>` and bindings declared earlier in document order. Branch
// steps nest sub-lists per case (linear-with-branches, not a free DAG).
//
// This module is runtime-agnostic (Deno edge functions AND the Vite app via
// the `#rater-shared/*` alias) — keep it dependency-free apart from zod and
// never touch `Deno.*` / DOM APIs here.

import { z } from 'zod';

export const RATER_SCHEMA_VERSION = 1;

// Engine caps — keep definitions small enough to validate, render, and run
// interactively.
export const RATER_LIMITS = {
  maxSteps: 100, // total across all branch paths
  maxInputs: 24,
  maxLookupRows: 500,
  maxLookupColumns: 12,
  maxFetchSteps: 10,
  maxExprLength: 2000,
  maxBranchDepth: 3,
  maxBranchCases: 12,
  maxHttpTimeoutMs: 10_000,
} as const;

const NAME_RE = /^[a-z][a-z0-9_]*$/;

const bindingName = z
  .string()
  .max(64)
  .regex(NAME_RE, 'names are snake_case: [a-z][a-z0-9_]*');

const expression = z.string().min(1).max(RATER_LIMITS.maxExprLength);

// --- inputs ------------------------------------------------------------------

// Same shape as reportParamSchema (reportParams.ts) so the run-form UX and
// value coercion carry over. `inputs` is a reserved scope name; input values
// are referenced in expressions as `inputs.<name>`.
export const RATER_INPUT_TYPES = [
  'text',
  'number',
  'date',
  'select',
  'boolean',
  'entity',
] as const;

export type RaterInputType = (typeof RATER_INPUT_TYPES)[number];

// Tables an `entity` input may reference (value = row id). RLS still applies
// to whatever the picker queries client-side.
export const RATER_ENTITY_TABLES = [
  'carriers',
  'agencies',
  'clients',
  'policies',
  'new_business_submissions',
] as const;

export const raterInputSchema = z
  .object({
    name: bindingName,
    label: z.string().min(1),
    type: z.enum(RATER_INPUT_TYPES),
    required: z.boolean(),
    default: z.union([z.string(), z.number(), z.boolean()]).nullish(),
    options: z
      .array(z.object({ value: z.string(), label: z.string() }))
      .min(1)
      .optional(),
    entity: z.object({ table: z.enum(RATER_ENTITY_TABLES) }).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.type === 'select' && !input.options?.length) {
      ctx.addIssue({
        code: 'custom',
        message: `select input '${input.name}' needs a non-empty options list`,
      });
    }
    if (input.type === 'entity' && !input.entity) {
      ctx.addIssue({
        code: 'custom',
        message: `entity input '${input.name}' needs entity.table (one of: ${RATER_ENTITY_TABLES.join(', ')})`,
      });
    }
  });

export type RaterInput = z.infer<typeof raterInputSchema>;

// --- steps ---------------------------------------------------------------------

const stepBase = {
  id: bindingName,
  label: z.string().max(120).optional(),
};

export const calcStepSchema = z.object({
  ...stepBase,
  type: z.literal('calc'),
  expr: expression,
});

export type CalcStep = z.infer<typeof calcStepSchema>;

// Lookup: a reference table matched against probe values. `match` entries AND
// together; the first row satisfying all of them wins (row order matters). The
// step binds the matched row as an object, e.g. `base_rate.rate`. The grid is
// either carried inline on the step (source: 'inline') or references a shared
// rater_lookup_tables row (source: 'ref'), resolved to inline at run time.
export const LOOKUP_COLUMN_TYPES = ['text', 'number', 'boolean'] as const;

export const lookupCell = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type LookupCell = z.infer<typeof lookupCell>;

export const lookupColumnSchema = z.object({
  name: bindingName,
  type: z.enum(LOOKUP_COLUMN_TYPES),
});
export type LookupColumn = z.infer<typeof lookupColumnSchema>;

// The grid body shared by an inline lookup step and a saved rater_lookup_tables
// row: typed columns × cell rows, with structural checks (unique column names,
// uniform row width). Reused so both storage paths enforce the same shape.
export const lookupTableContentSchema = z
  .object({
    columns: z
      .array(lookupColumnSchema)
      .min(1)
      .max(RATER_LIMITS.maxLookupColumns),
    rows: z.array(z.array(lookupCell)).max(RATER_LIMITS.maxLookupRows),
  })
  .superRefine((table, ctx) => {
    const colNames = new Set(table.columns.map((c) => c.name));
    if (colNames.size !== table.columns.length) {
      ctx.addIssue({ code: 'custom', message: 'duplicate column names' });
    }
    for (const [i, row] of table.rows.entries()) {
      if (row.length !== table.columns.length) {
        ctx.addIssue({
          code: 'custom',
          message: `row ${i + 1} has ${row.length} cells, expected ${table.columns.length}`,
        });
      }
    }
  });

export type LookupTableContent = z.infer<typeof lookupTableContentSchema>;

export const lookupMatchSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('exact'),
    column: bindingName,
    value: expression, // compared case-insensitively for text columns
  }),
  z.object({
    mode: z.literal('range'),
    minColumn: bindingName, // null cell = open-ended (−∞)
    maxColumn: bindingName, // null cell = open-ended (+∞)
    value: expression,
    minInclusive: z.boolean().default(true),
    maxInclusive: z.boolean().default(false),
  }),
]);

export type LookupMatch = z.infer<typeof lookupMatchSchema>;

// Fields shared by both lookup variants: how a probe finds its row and what to
// do on a miss.
const lookupMatchFields = {
  match: z.array(lookupMatchSchema).min(1),
  onMiss: z.enum(['error', 'default']).default('error'),
  defaultRow: z.record(z.string(), lookupCell).optional(),
};

// A defaultRow is required when onMiss is 'default' (both variants).
const requireDefaultRow = (
  step: { id: string; onMiss: 'error' | 'default'; defaultRow?: unknown },
  ctx: z.RefinementCtx,
): void => {
  if (step.onMiss === 'default' && !step.defaultRow) {
    ctx.addIssue({
      code: 'custom',
      message: `lookup '${step.id}' has onMiss 'default' but no defaultRow`,
    });
  }
};

// Inline: the grid lives on the step. Match columns are validated against the
// step's own columns here (a ref step can't be — its columns are only known
// once the shared table is resolved server-side).
export const inlineLookupStepSchema = z
  .object({
    ...stepBase,
    type: z.literal('lookup'),
    // Optional (not defaulted) so every pre-existing saved definition — which
    // has no `source` field — still parses as inline. Absent ⇒ inline.
    source: z.literal('inline').optional(),
    columns: z
      .array(lookupColumnSchema)
      .min(1)
      .max(RATER_LIMITS.maxLookupColumns),
    rows: z.array(z.array(lookupCell)).max(RATER_LIMITS.maxLookupRows),
    ...lookupMatchFields,
  })
  .superRefine((step, ctx) => {
    const colNames = new Set(step.columns.map((c) => c.name));
    if (colNames.size !== step.columns.length) {
      ctx.addIssue({ code: 'custom', message: `lookup '${step.id}' has duplicate column names` });
    }
    for (const [i, row] of step.rows.entries()) {
      if (row.length !== step.columns.length) {
        ctx.addIssue({
          code: 'custom',
          message: `lookup '${step.id}' row ${i + 1} has ${row.length} cells, expected ${step.columns.length}`,
        });
      }
    }
    for (const m of step.match) {
      const refs = m.mode === 'exact' ? [m.column] : [m.minColumn, m.maxColumn];
      for (const name of refs) {
        if (!colNames.has(name)) {
          ctx.addIssue({
            code: 'custom',
            message: `lookup '${step.id}' match references unknown column '${name}'`,
          });
        }
      }
    }
    requireDefaultRow(step, ctx);
  });

export type InlineLookupStep = z.infer<typeof inlineLookupStepSchema>;

// Ref: the grid is a shared rater_lookup_tables row referenced by id. The
// run-rater edge function resolves it to an inline step (validating match
// columns against the resolved table) before execution.
export const refLookupStepSchema = z
  .object({
    ...stepBase,
    type: z.literal('lookup'),
    source: z.literal('ref'),
    tableId: z.string().uuid(),
    // Display-only cache of the referenced table's name, so the builder step
    // list and diagram can show a friendly label without a join. Never read by
    // the interpreter and dropped during materialization; refreshed when the
    // user re-picks the table (may go stale after a rename until then).
    tableName: z.string().optional(),
    ...lookupMatchFields,
  })
  .superRefine(requireDefaultRow);

export type RefLookupStep = z.infer<typeof refLookupStepSchema>;

// Order: inline (the common case, and the shape of every pre-source saved
// definition) first; a ref object fails inline's `source` literal + required
// `columns` and falls through to the ref schema.
export const lookupStepSchema = z.union([
  inlineLookupStepSchema,
  refLookupStepSchema,
]);

export type LookupStep = InlineLookupStep | RefLookupStep;

// Fetch (db): a declarative PostgREST query executed via the user-scoped
// client — RLS is the gate on what a rater can read. Filter values are
// expressions evaluated against the current scope.
export const DB_FILTER_OPS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'in',
  'is',
] as const;

export const dbFetchStepSchema = z.object({
  ...stepBase,
  type: z.literal('fetch'),
  source: z.literal('db'),
  table: z.string().min(1).max(64),
  select: z.array(z.string().min(1)).min(1).max(32),
  filters: z
    .array(
      z.object({
        column: z.string().min(1),
        op: z.enum(DB_FILTER_OPS),
        value: expression,
      }),
    )
    .max(8)
    .default([]),
  // single: exactly one row (error on 0 or >1) — binds the row object.
  // maybe: 0 or 1 rows — binds the row object or null.
  // list: binds the array of rows.
  mode: z.enum(['single', 'maybe', 'list']).default('maybe'),
  limit: z.number().int().min(1).max(1000).optional(),
  orderBy: z
    .object({ column: z.string().min(1), ascending: z.boolean().default(true) })
    .optional(),
  onEmpty: z.enum(['null', 'error']).default('null'), // for mode single/maybe
});

export type DbFetchStep = z.infer<typeof dbFetchStepSchema>;

// Fetch (http): server-only external API call. `{{expr}}` segments in the url
// are evaluated and URL-encoded; query values are expressions; headers are
// static in v1. The step binds { [extract.name]: value } from dot-paths into
// the JSON response.
export const httpFetchStepSchema = z.object({
  ...stepBase,
  type: z.literal('fetch'),
  source: z.literal('http'),
  method: z.enum(['GET', 'POST']).default('GET'),
  url: z.string().min(1).max(2000),
  query: z.record(z.string(), expression).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  extract: z
    .array(z.object({ name: bindingName, path: z.string().min(1).max(200) }))
    .min(1)
    .max(16),
  timeoutMs: z
    .number()
    .int()
    .min(100)
    .max(RATER_LIMITS.maxHttpTimeoutMs)
    .default(5000),
});

export type HttpFetchStep = z.infer<typeof httpFetchStepSchema>;

export type FetchStep = DbFetchStep | HttpFetchStep;

export const outputStepSchema = z.object({
  ...stepBase,
  type: z.literal('output'),
  label: z.string().min(1).max(120), // required on outputs — it names the result
  expr: expression,
  format: z.enum(['money', 'percent', 'number', 'text']).default('number'),
});

export type OutputStep = z.infer<typeof outputStepSchema>;

// Decision: a terminal step. When it fires it stops the run *successfully*
// with a named outcome (e.g. 'decline', 'refer') — distinct from an error
// halt. `when` gates it: absent = always fires (an unconditional terminal,
// e.g. a catch-all "refer"); present = fires only when truthy, otherwise
// execution falls through to the next step (the "knock-out rule" pattern:
// a flat list of decline conditions). `reason` is an optional expression
// shown to the user.
export const decisionStepSchema = z.object({
  ...stepBase,
  type: z.literal('decision'),
  outcome: z.string().min(1).max(64), // free-text: 'decline', 'refer', 'review', …
  when: expression.optional(),
  reason: expression.optional(),
});

export type DecisionStep = z.infer<typeof decisionStepSchema>;

// Branch: first case whose `when` is truthy runs its steps; `else` otherwise.
// The branch itself binds nothing; inner steps bind into the shared scope.
// Zod can't type recursive schemas cleanly without explicit types, so the
// step union + branch are declared with explicit TS types and z.lazy.

export interface BranchCase {
  label: string;
  when: string;
  steps: RaterStep[];
}

export interface BranchStep {
  id: string;
  label?: string;
  type: 'branch';
  cases: BranchCase[];
  else?: RaterStep[];
}

export type RaterStep =
  | CalcStep
  | LookupStep
  | DbFetchStep
  | HttpFetchStep
  | OutputStep
  | DecisionStep
  | BranchStep;

const branchStepSchema: z.ZodType<BranchStep> = z.lazy(() =>
  z.object({
    ...stepBase,
    type: z.literal('branch'),
    cases: z
      .array(
        z.object({
          label: z.string().min(1).max(120),
          when: expression,
          steps: z.array(raterStepSchema),
        }),
      )
      .min(1)
      .max(RATER_LIMITS.maxBranchCases),
    else: z.array(raterStepSchema).optional(),
  }),
) as z.ZodType<BranchStep>;

export const raterStepSchema: z.ZodType<RaterStep> = z.lazy(() =>
  z.union([
    calcStepSchema,
    lookupStepSchema,
    dbFetchStepSchema,
    httpFetchStepSchema,
    outputStepSchema,
    decisionStepSchema,
    branchStepSchema,
  ]),
) as z.ZodType<RaterStep>;

// --- definition ------------------------------------------------------------------

export interface RaterDefinition {
  schema_version: number;
  inputs: RaterInput[];
  steps: RaterStep[];
}

export const raterDefinitionSchema: z.ZodType<RaterDefinition> = z.object({
  schema_version: z.literal(RATER_SCHEMA_VERSION),
  inputs: z.array(raterInputSchema).max(RATER_LIMITS.maxInputs),
  steps: z.array(raterStepSchema),
});

// A single applicability condition: match one of the target table's columns
// against a literal value. `value` is a literal (not a scope expression) — it's
// compared against a concrete record row when deciding which raters apply,
// before any run scope exists. Coercion happens at match time (see
// src/lib/raterMatching.ts) based on the column's kind. The operator set is the
// same as db-fetch filters.
export const matchConditionSchema = z.object({
  column: z.string().min(1).max(64),
  op: z.enum(DB_FILTER_OPS),
  value: z.string().max(RATER_LIMITS.maxExprLength),
});

export type MatchCondition = z.infer<typeof matchConditionSchema>;

// Record binding (raters.record_mapping): declares which table a rater applies
// to, optional match conditions that narrow applicability against the record's
// own columns, and optional pre-fill mappings from a source row. A binding with
// `table` set and no conditions applies to every row of that table; conditions
// AND together. `mappings` is optional so a rater can be applicable to a table
// without pre-filling any inputs.
export const recordMappingSchema = z.object({
  table: z.string().min(1).max(64),
  conditions: z.array(matchConditionSchema).optional(),
  mappings: z
    .array(z.object({ input: bindingName, column: z.string().min(1) }))
    .optional(),
});

export type RecordMapping = z.infer<typeof recordMappingSchema>;

// --- run results -----------------------------------------------------------------

export type OutputFormat = 'money' | 'percent' | 'number' | 'text';

export interface RaterOutputValue {
  label: string;
  value: unknown;
  format: OutputFormat;
}

export type TraceStatus = 'ok' | 'error' | 'skipped';

export interface TraceStep {
  id: string;
  type: RaterStep['type'];
  label?: string;
  status: TraceStatus;
  value?: unknown;
  ms?: number;
  detail?: Record<string, unknown>;
  error?: string;
}

// A terminal decision reached during a run (e.g. a decline). Successful — not
// an error; the run stops early with this instead of computing more outputs.
export interface RaterOutcome {
  decision: string; // the decision step's `outcome` string
  reason: string | null;
  stepId: string;
  label?: string;
}

export interface RaterRunResult {
  outputs: Record<string, RaterOutputValue>;
  outcome: RaterOutcome | null;
  trace: { steps: TraceStep[] };
  error: { stepId: string; message: string } | null;
}

// An empty definition for the builder's "new rater" state.
export const emptyRaterDefinition = (): RaterDefinition => ({
  schema_version: RATER_SCHEMA_VERSION,
  inputs: [],
  steps: [],
});
