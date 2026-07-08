// Run-time parameters for LLM-generated reports.
//
// A parameterized report stores SQL with `{{snake_case}}` placeholders plus a
// `params` config (reports.params jsonb) describing each input. At execution,
// compileNamedPlaceholders rewrites the placeholders to positional $1..$n and
// the values travel to Postgres as bind parameters — parameter values are
// NEVER string-interpolated into SQL.
//
// Both edge functions share this module: generate-report validates the model's
// declared params at submit time, run-report validates caller-provided values
// against the saved config.

import { z } from 'zod';

export const PARAM_TYPES = [
  'date',
  'text',
  'number',
  'select',
  'entity',
  'boolean',
] as const;

export type ReportParamType = (typeof PARAM_TYPES)[number];

// Tables an `entity` param may reference (value = row id). The client keeps a
// mirrored map (src/lib/reportParams.ts) with label/search columns for the
// picker UI — this server-side list is the authoritative gate, and RLS still
// applies to whatever the picker queries.
export const ENTITY_TABLES = [
  'carriers',
  'agencies',
  'clients',
  'policies',
] as const;

export type EntityTable = (typeof ENTITY_TABLES)[number];

const PARAM_NAME_RE = /^[a-z][a-z0-9_]*$/;

export const reportParamSchema = z
  .object({
    name: z
      .string()
      .max(64)
      .regex(PARAM_NAME_RE, 'param names are snake_case: [a-z][a-z0-9_]*'),
    label: z.string().min(1),
    type: z.enum(PARAM_TYPES),
    required: z.boolean(),
    // Literal default only (no relative-date DSL); pre-fills the run form.
    default: z.union([z.string(), z.number(), z.boolean()]).nullish(),
    // Static choices for `select` params (snapshot of CHECK-constraint /
    // sampled values at generation time).
    options: z
      .array(z.object({ value: z.string(), label: z.string() }))
      .min(1)
      .optional(),
    entity: z.object({ table: z.enum(ENTITY_TABLES) }).optional(),
  })
  .superRefine((p, ctx) => {
    if (p.type === 'select' && !p.options?.length) {
      ctx.addIssue({
        code: 'custom',
        message: `select param '${p.name}' needs a non-empty options list`,
      });
    }
    if (p.type === 'entity' && !p.entity) {
      ctx.addIssue({
        code: 'custom',
        message: `entity param '${p.name}' needs entity.table (one of: ${ENTITY_TABLES.join(', ')})`,
      });
    }
  });

export type ReportParam = z.infer<typeof reportParamSchema>;

export const reportParamsSchema = z
  .array(reportParamSchema)
  .max(12)
  .superRefine((params, ctx) => {
    const seen = new Set<string>();
    for (const p of params) {
      if (seen.has(p.name)) {
        ctx.addIssue({ code: 'custom', message: `duplicate param '${p.name}'` });
      }
      seen.add(p.name);
    }
  });

// --- placeholder compiler ----------------------------------------------------

export interface CompiledSql {
  sql: string; // placeholders rewritten to $1..$n
  order: string[]; // order[i] is the param name bound to $(i+1)
}

const PLACEHOLDER_RE = /^\{\{([a-z][a-z0-9_]*)\}\}/;

/**
 * Rewrite `{{name}}` placeholders to positional $1..$n, skipping quoted
 * strings, identifiers, comments, and dollar-quoted strings so a literal
 * `'{{not_a_param}}'` is left untouched. A repeated placeholder reuses its
 * first-appearance index. A character-walking scanner (not a bare regex)
 * because `{{...}}` inside SQL literals must not be rewritten.
 */
export const compileNamedPlaceholders = (sql: string): CompiledSql => {
  const indexByName = new Map<string, number>();
  let out = '';
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    // Single-quoted string ('' escapes a quote).
    if (ch === "'") {
      const end = scanQuoted(sql, i, "'");
      out += sql.slice(i, end);
      i = end;
      continue;
    }
    // Double-quoted identifier ("" escapes a quote).
    if (ch === '"') {
      const end = scanQuoted(sql, i, '"');
      out += sql.slice(i, end);
      i = end;
      continue;
    }
    // Line comment.
    if (ch === '-' && next === '-') {
      const nl = sql.indexOf('\n', i);
      const end = nl === -1 ? sql.length : nl;
      out += sql.slice(i, end);
      i = end;
      continue;
    }
    // Block comment (Postgres allows nesting).
    if (ch === '/' && next === '*') {
      const end = scanBlockComment(sql, i);
      out += sql.slice(i, end);
      i = end;
      continue;
    }
    // Dollar-quoted string ($$...$$ or $tag$...$tag$).
    if (ch === '$') {
      const tagMatch = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i));
      if (tagMatch) {
        const tag = tagMatch[0];
        const close = sql.indexOf(tag, i + tag.length);
        const end = close === -1 ? sql.length : close + tag.length;
        out += sql.slice(i, end);
        i = end;
        continue;
      }
    }
    // Placeholder.
    if (ch === '{' && next === '{') {
      const m = PLACEHOLDER_RE.exec(sql.slice(i));
      if (m) {
        const name = m[1];
        let idx = indexByName.get(name);
        if (idx === undefined) {
          idx = indexByName.size + 1;
          indexByName.set(name, idx);
        }
        out += `$${idx}`;
        i += m[0].length;
        continue;
      }
    }

    out += ch;
    i += 1;
  }

  return { sql: out, order: [...indexByName.keys()] };
};

/** Distinct placeholder names in first-appearance order (comments/literals skipped). */
export const extractPlaceholderNames = (sql: string): string[] =>
  compileNamedPlaceholders(sql).order;

// From an opening quote at `start`, return the index just past the closing
// quote, treating a doubled quote as an escape. Unterminated → end of string
// (the server will reject the SQL anyway).
const scanQuoted = (sql: string, start: number, quote: string): number => {
  let i = start + 1;
  while (i < sql.length) {
    if (sql[i] === quote) {
      if (sql[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i += 1;
  }
  return sql.length;
};

const scanBlockComment = (sql: string, start: number): number => {
  let depth = 0;
  let i = start;
  while (i < sql.length) {
    if (sql[i] === '/' && sql[i + 1] === '*') {
      depth += 1;
      i += 2;
    } else if (sql[i] === '*' && sql[i + 1] === '/') {
      depth -= 1;
      i += 2;
      if (depth === 0) return i;
    } else {
      i += 1;
    }
  }
  return sql.length;
};

// --- value coercion ------------------------------------------------------------

export type ParamScalar = string | number | boolean | null;

export interface CoerceSuccess {
  ok: true;
  values: Record<string, ParamScalar>;
}

export interface CoerceFailure {
  ok: false;
  code: 'missing_param' | 'invalid_param';
  message: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const coerceOne = (param: ReportParam, raw: unknown): ParamScalar | Error => {
  switch (param.type) {
    case 'date': {
      if (typeof raw === 'string' && DATE_RE.test(raw)) return raw;
      return new Error(`'${param.name}' must be a YYYY-MM-DD date`);
    }
    case 'number': {
      const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
      if (typeof n === 'number' && Number.isFinite(n)) return n;
      return new Error(`'${param.name}' must be a number`);
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return new Error(`'${param.name}' must be a boolean`);
    }
    case 'select': {
      const value = String(raw);
      if (param.options?.some((o) => o.value === value)) return value;
      return new Error(
        `'${param.name}' must be one of: ${param.options?.map((o) => o.value).join(', ')}`,
      );
    }
    case 'entity': {
      const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
      if (typeof n === 'number' && Number.isInteger(n) && n > 0) return n;
      return new Error(`'${param.name}' must be a row id (positive integer)`);
    }
    case 'text': {
      if (typeof raw === 'string') return raw;
      return new Error(`'${param.name}' must be a string`);
    }
  }
};

/**
 * Validate + coerce caller-provided values against a report's param config.
 * Absent value (undefined/null/'') → literal default when set, NULL when the
 * param is optional, `missing_param` failure when required.
 */
export const coerceParamValues = (
  config: ReportParam[],
  provided: Record<string, unknown>,
): CoerceSuccess | CoerceFailure => {
  const values: Record<string, ParamScalar> = {};

  for (const param of config) {
    let raw: unknown = provided[param.name];
    if (raw === undefined || raw === null || raw === '') {
      raw = param.default ?? null;
    }
    if (raw === null) {
      if (param.required) {
        return {
          ok: false,
          code: 'missing_param',
          message: `Missing required parameter '${param.name}' (${param.label})`,
        };
      }
      values[param.name] = null;
      continue;
    }

    const coerced = coerceOne(param, raw);
    if (coerced instanceof Error) {
      return { ok: false, code: 'invalid_param', message: coerced.message };
    }
    values[param.name] = coerced;
  }

  return { ok: true, values };
};

/**
 * Submit-time consistency check between SQL placeholders and declared params.
 * Returns a model-readable error message, or null when consistent.
 */
export const crossCheckParams = (
  sql: string,
  params: ReportParam[],
): string | null => {
  const placeholders = new Set(extractPlaceholderNames(sql));
  const declared = new Set(params.map((p) => p.name));

  const undeclared = [...placeholders].filter((n) => !declared.has(n));
  if (undeclared.length) {
    return `SQL uses placeholders with no matching param declaration: ${undeclared.map((n) => `{{${n}}}`).join(', ')}. Declare each in \`params\` or remove it from the SQL.`;
  }
  const unused = [...declared].filter((n) => !placeholders.has(n));
  if (unused.length) {
    return `Declared params never appear in the SQL: ${unused.join(', ')}. Remove them or reference them as {{name}} placeholders.`;
  }
  return null;
};
