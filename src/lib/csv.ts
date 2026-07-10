/**
 * Minimal client-side CSV export. Turns an array of row objects into a CSV
 * string and triggers a browser download.
 *
 * Pass explicit `columns` to control which fields are exported, their order,
 * and the header labels (e.g. to mirror the visible grid columns). Omit them to
 * fall back to the union of row keys as both field and header.
 */

import Papa from 'papaparse';
import {
  type Cell,
  parseCell,
} from '#/components/raters/steps/LookupTableGrid';
import type { LookupColumn } from '#/types/raters';
import { RATER_LIMITS } from '#/types/raters';

export interface CsvColumn {
  field: string;
  label: string;
}

const escapeCell = (v: unknown): string => {
  if (v == null) return '';
  // Objects/arrays (e.g. jsonb columns) would stringify to "[object Object]".
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const columnsFromRows = (rows: Record<string, unknown>[]): CsvColumn[] =>
  Array.from(
    rows.reduce((set, r) => {
      for (const k of Object.keys(r)) set.add(k);
      return set;
    }, new Set<string>()),
  ).map((field) => ({ field, label: field }));

export const toCsv = (
  rows: Record<string, unknown>[],
  columns?: CsvColumn[],
): string => {
  const cols = columns ?? columnsFromRows(rows);
  if (cols.length === 0) return '';
  const lines = [cols.map((c) => escapeCell(c.label)).join(',')];
  for (const r of rows) {
    lines.push(cols.map((c) => escapeCell(r[c.field])).join(','));
  }
  return lines.join('\n');
};

export const downloadCsv = (
  filename: string,
  rows: Record<string, unknown>[],
  columns?: CsvColumn[],
): void => {
  const csv = toCsv(rows, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// --- CSV import (→ lookup table) --------------------------------------------
//
// Parse a CSV file into the { columns, rows } shape the lookup-table editor
// holds. The editor still runs lookupTableContentSchema live, so this is a
// best-effort transform: it guarantees valid, unique snake_case column names,
// infers a column type, and coerces cells the same way manual entry does. It
// hard-caps oversized input so a giant paste can't lock up the grid.

type LookupColumnType = LookupColumn['type'];

/**
 * Turn a raw CSV header into a valid, unique `bindingName` (snake_case,
 * `[a-z][a-z0-9_]*`). Collisions are disambiguated with a numeric suffix. The
 * running `taken` set is mutated so the caller can slug headers in sequence.
 */
export const slugifyColumnName = (
  header: string,
  taken: Set<string>,
): string => {
  let base = header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!base) base = 'col';
  if (/^[0-9]/.test(base)) base = `col_${base}`;
  base = base.slice(0, 64);

  let name = base;
  let n = 2;
  while (taken.has(name)) {
    name = `${base}_${n}`.slice(0, 64);
    n += 1;
  }
  taken.add(name);
  return name;
};

/**
 * Infer a column type from its raw string cells: all non-empty values numeric
 * → `number`, all `true`/`false` (case-insensitive) → `boolean`, else `text`.
 * An all-empty column falls back to `text`.
 */
export const inferColumnType = (values: string[]): LookupColumnType => {
  const nonEmpty = values.map((v) => v.trim()).filter((v) => v !== '');
  if (nonEmpty.length === 0) return 'text';
  if (nonEmpty.every((v) => Number.isFinite(Number(v)))) return 'number';
  if (nonEmpty.every((v) => /^(true|false)$/i.test(v))) return 'boolean';
  return 'text';
};

/**
 * Parse CSV text into the lookup-table editor's { columns, rows }. Throws a
 * user-facing Error on unparseable input or when the file exceeds the engine
 * caps (columns / rows). Ragged rows are normalized to the header width.
 */
export const csvToLookupTable = (
  text: string,
): { columns: LookupColumn[]; rows: Cell[][] } => {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
  // Only malformed quoting is fatal. The "Delimiter" auto-detect warning fires
  // for legitimate single-column files, and "FieldMismatch" (ragged rows) is
  // normalized below — neither should block the import.
  const fatal = result.errors.find((e) => e.type === 'Quotes');
  if (fatal) throw new Error(`Could not parse CSV: ${fatal.message}`);

  const grid = result.data.filter((r) => r.some((c) => c.trim() !== ''));
  if (grid.length === 0) throw new Error('CSV is empty');

  const [headerRow, ...dataRows] = grid;
  if (headerRow.length > RATER_LIMITS.maxLookupColumns) {
    throw new Error(
      `CSV has ${headerRow.length} columns; the max is ${RATER_LIMITS.maxLookupColumns}`,
    );
  }
  if (dataRows.length > RATER_LIMITS.maxLookupRows) {
    throw new Error(
      `CSV has ${dataRows.length} rows; the max is ${RATER_LIMITS.maxLookupRows}`,
    );
  }

  const taken = new Set<string>();
  const width = headerRow.length;
  const names = headerRow.map((h) => slugifyColumnName(h, taken));

  // Normalize each data row to header width (pad short, drop extra).
  const cellGrid = dataRows.map((row) =>
    Array.from({ length: width }, (_, i) => row[i] ?? ''),
  );

  const columns: LookupColumn[] = names.map((name, i) => ({
    name,
    type: inferColumnType(cellGrid.map((row) => row[i])),
  }));

  const rows: Cell[][] = cellGrid.map((row) =>
    row.map((raw, i) => parseCell(raw, columns[i].type)),
  );

  return { columns, rows };
};
