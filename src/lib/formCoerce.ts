/**
 * Shared coercion helpers for turning form field values (strings / Dayjs) into
 * the numeric / date / nullable shapes the Supabase columns expect.
 *
 * Extracted from NewBusinessForm so every entity form coerces identically:
 * empty strings become NULL rather than '' for nullable columns.
 */
import dayjs, { type ConfigType } from 'dayjs';

/** '' | '  ' | non-numeric -> null; otherwise the parsed number. */
export const toNumber = (v: string | null | undefined): number | null => {
  const trimmed = v?.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isNaN(n) ? null : n;
};

/** Dayjs / date-like -> 'YYYY-MM-DD' (Postgres date), or null when empty/invalid. */
export const toDateStr = (v: ConfigType): string | null =>
  v && dayjs(v).isValid() ? dayjs(v).format('YYYY-MM-DD') : null;

/** Trim a string; empty becomes null so we don't write '' into nullable text. */
export const emptyToNull = (v: string | null | undefined): string | null =>
  v?.trim() || null;

/**
 * Percent entered as a human number (e.g. "32.5" for 32.5%) -> stored decimal
 * (0.325). Pass-through null for empty. Used for commission / participation %.
 */
export const pctToDecimal = (v: string | null | undefined): number | null => {
  const n = toNumber(v);
  return n == null ? null : n / 100;
};

/** Inverse of pctToDecimal for pre-filling edit forms: 0.325 -> "32.5". */
export const decimalToPct = (v: number | null | undefined): string =>
  v == null ? '' : String(v * 100);
