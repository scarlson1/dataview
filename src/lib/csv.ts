/**
 * Minimal client-side CSV export. Turns an array of row objects into a CSV
 * string and triggers a browser download.
 *
 * Pass explicit `columns` to control which fields are exported, their order,
 * and the header labels (e.g. to mirror the visible grid columns). Omit them to
 * fall back to the union of row keys as both field and header.
 */

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
