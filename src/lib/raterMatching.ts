/**
 * Rater applicability resolver: given a record (a row of some table), find the
 * raters whose record binding (`raters.record_mapping`) declares they apply to
 * that table AND whose match conditions all hold against the row.
 *
 * A binding with `table` set and no conditions applies to every row of that
 * table; conditions AND together. Matching is done client-side against the
 * concrete row (RLS gates which raters the query can read), so `value` is a
 * literal coerced by the column's kind — not a scope expression. Returns ALL
 * matches (the consumer decides how to present several applicable raters).
 */

import type { ColumnKind } from '#/data/tables';
import { TABLES } from '#/data/tables';
import { supabase } from '#/supabaseClient';
import type {
  MatchCondition,
  RaterListRow,
  RecordMapping,
} from '#/types/raters';

type Row = Record<string, unknown>;

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isNaN(n) ? null : n;
};

// Translate a SQL LIKE pattern (`%`/`_` wildcards) to an anchored RegExp,
// escaping regex metacharacters in the literal segments.
const likeToRegExp = (pattern: string, caseInsensitive: boolean): RegExp => {
  let out = '';
  for (const ch of pattern) {
    if (ch === '%') out += '.*';
    else if (ch === '_') out += '.';
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`, caseInsensitive ? 'i' : undefined);
};

/**
 * Evaluate one condition against a record row. `kind` (the column's display
 * kind from the TABLES registry) drives numeric vs. text coercion; omit it to
 * treat the value as text.
 */
export const evaluateCondition = (
  cond: MatchCondition,
  row: Row,
  kind?: ColumnKind,
): boolean => {
  const raw = row[cond.column];
  const { op, value } = cond;
  const numeric = kind === 'number';

  switch (op) {
    case 'is': {
      const t = value.trim().toLowerCase();
      if (t === 'null') return raw === null || raw === undefined;
      if (t === 'true') return raw === true;
      if (t === 'false') return raw === false;
      return false;
    }
    case 'eq':
    case 'neq': {
      let equal: boolean;
      if (numeric) {
        const a = toNum(raw);
        const b = toNum(value);
        equal = a !== null && b !== null && a === b;
      } else if (kind === 'bool') {
        equal = String(raw) === value.trim().toLowerCase();
      } else {
        equal = raw !== null && raw !== undefined && String(raw) === value;
      }
      return op === 'eq' ? equal : !equal;
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      if (numeric) {
        const a = toNum(raw);
        const b = toNum(value);
        if (a === null || b === null) return false;
        return op === 'gt' ? a > b : op === 'gte' ? a >= b : op === 'lt' ? a < b : a <= b;
      }
      // Lexical compare for non-numeric columns (e.g. ISO date/datetime strings).
      if (raw === null || raw === undefined) return false;
      const s = String(raw);
      return op === 'gt' ? s > value : op === 'gte' ? s >= value : op === 'lt' ? s < value : s <= value;
    }
    case 'like':
    case 'ilike': {
      if (raw === null || raw === undefined) return false;
      return likeToRegExp(value, op === 'ilike').test(String(raw));
    }
    case 'in': {
      if (raw === null || raw === undefined) return false;
      const parts = value.split(',').map((s) => s.trim());
      if (numeric) {
        const a = toNum(raw);
        return a !== null && parts.some((p) => toNum(p) === a);
      }
      return parts.includes(String(raw));
    }
    default:
      return false;
  }
};

/**
 * Does `row` satisfy the binding? False for a null binding (not applicable to
 * anything). A binding with no conditions matches every row of its table.
 */
export const recordMatchesBinding = (
  mapping: RecordMapping | null | undefined,
  row: Row,
): boolean => {
  if (!mapping) return false;
  const conditions = mapping.conditions ?? [];
  if (conditions.length === 0) return true;
  const kindByField = new Map(
    (TABLES[mapping.table]?.columns ?? []).map((c) => [c.field, c.kind]),
  );
  return conditions.every((c) =>
    evaluateCondition(c, row, kindByField.get(c.column)),
  );
};

interface RaterBindingRow extends RaterListRow {
  record_mapping: RecordMapping | null;
}

/**
 * All non-archived raters that apply to `table` and match `row`. The jsonb
 * `->>table` filter narrows to bindings on this table server-side; conditions
 * are then applied client-side against the row.
 */
export const fetchMatchingRaters = async (
  table: string,
  row: Row,
): Promise<RaterListRow[]> => {
  const { data, error } = await supabase
    .from('raters')
    .select(
      'id, name, description, record_mapping, last_run_at, updated_at, created_at',
    )
    .eq('record_mapping->>table', table)
    .is('archived_at', null)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RaterBindingRow[])
    .filter((r) => recordMatchesBinding(r.record_mapping, row))
    .map(({ record_mapping: _rm, ...rest }) => rest);
};
