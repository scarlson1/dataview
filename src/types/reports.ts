/**
 * Client-side mirrors of the `generate-report` / `run-report` edge-function
 * contracts. These types cannot be imported from `supabase/functions/` (that
 * tree isn't part of the app's tsconfig), so they're duplicated here and MUST
 * stay in sync with the frozen backend contracts.
 */

import type { ColumnKind } from '#/data/schema.generated';

export type ReportMode = 'create' | 'refine' | 'repair';

/** Column meta stored on `reports.columns` and used for grid + CSV rendering. */
export interface ReportColumn {
  field: string;
  label: string;
  kind: ColumnKind;
}

// --- generate-report UI-message-stream custom data parts ---------------------
// Each arrives as a `data-<name>` part on the assistant message (and via the
// useChat `onData` callback). The `data` payloads below match those parts.

export interface StepData {
  label: string;
}

export interface SqlData {
  sql: string;
}

export interface PreviewData {
  rows: Record<string, unknown>[];
  fields: string[];
  rowCount: number;
  truncated: boolean;
}

export interface ReportData {
  name: string;
  description: string;
  sql: string;
  columns: ReportColumn[];
}

export interface FailureData {
  message: string;
  lastError?: string;
  candidateSql?: string;
}

/**
 * Data-part name → payload map. Consumed as the `useChat` message-data generic
 * so `onData` / `message.parts` are typed (`{ type: 'data-step'; data: StepData }`
 * etc.).
 */
export interface ReportDataParts {
  step: StepData;
  sql: SqlData;
  preview: PreviewData;
  report: ReportData;
  failure: FailureData;
}

// --- run-report contract -----------------------------------------------------

export type RunCap = 'preview' | 'export';

export interface RunReportRequest {
  reportId?: string;
  sql?: string;
  cap?: RunCap;
}

export interface RunReportSuccess {
  rows: Record<string, unknown>[];
  fields: string[];
  rowCount: number;
  truncated: boolean;
  durationMs: number;
  sql: string;
}

export interface ReportError {
  code: string;
  message: string;
  hint?: string;
  position?: number;
}

export interface RunReportFailure {
  error: ReportError;
}
