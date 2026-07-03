/**
 * Formatting helpers shared across the workflow board, detail pages, and reports.
 * Extracted from _dashboard.workflow.tsx.
 */

/** USD, no cents by default (matches the workbook's whole-dollar reporting). */
export const money = (
  n: number | null | undefined,
  maximumFractionDigits = 0,
): string =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits,
      });

/** snake_case / enum values -> Title Case for display. */
export const labelize = (s: string | null | undefined): string =>
  s == null || s === ''
    ? '—'
    : s.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

/** Decimal fraction (0.325) -> "32.500%". */
export const pct = (n: number | null | undefined, digits = 3): string =>
  n == null ? '—' : `${(n * 100).toFixed(digits)}%`;
