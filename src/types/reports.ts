/**
 * Client-side mirrors of the `generate-report` / `run-report` edge-function
 * contracts. These types cannot be imported from `supabase/functions/` (that
 * tree isn't part of the app's tsconfig), so they're duplicated here and MUST
 * stay in sync with the frozen backend contracts.
 */

import type { UIDataTypes } from 'ai';
import type { ColumnKind } from '#/data/schema.generated';

export type ReportMode = 'create' | 'refine' | 'repair';

/** Column meta stored on `reports.columns` and used for grid + CSV rendering. */
export interface ReportColumn {
  field: string;
  label: string;
  kind: ColumnKind;
}

// --- run-time parameters (mirror of supabase/functions/_shared/reportParams.ts)

export type ReportParamType =
  | 'date'
  | 'text'
  | 'number'
  | 'select'
  | 'entity'
  | 'boolean';

/** Tables an `entity` param may reference (server-side allowlist). */
export type ReportEntityTable =
  | 'carriers'
  | 'agencies'
  | 'clients'
  | 'policies';

/**
 * One run-time input stored on `reports.params`. The SQL carries a matching
 * `{{name}}` placeholder; run-report validates the value and binds it as a
 * positional bind parameter.
 */
export interface ReportParam {
  name: string;
  label: string;
  type: ReportParamType;
  required: boolean;
  default?: string | number | boolean | null;
  /** Static choices for `select` params. */
  options?: { value: string; label: string }[];
  /** FK target for `entity` params (value = row id). */
  entity?: { table: ReportEntityTable };
}

// --- generate-report request --------------------------------------------------
// The builder is a conversational thread: each turn POSTs the full UI-message
// history (plus the mode envelope). The server converts it back to model
// messages and continues the same conversation. `data-step` is streamed
// transiently and is NOT part of the persisted history.

export interface GenerateReportRequest {
  mode: ReportMode;
  /** The full AI-SDK UI-message thread (>= 1 user turn). */
  messages?: unknown[];
  reportId?: string;
  runtimeError?: string;
  /** Deprecated create-mode fallback for a `prompt`-only client. */
  prompt?: string;
}

// --- generate-report UI-message-stream custom data parts ---------------------
// Each arrives as a `data-<name>` part on the assistant message (and via the
// useChat `onData` callback). The `data` payloads below match those parts.
// `data-step` is emitted as a transient part (live progress only).

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
  params: ReportParam[];
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
// export interface ReportDataParts {
//   step: StepData;
//   sql: SqlData;
//   preview: PreviewData;
//   report: ReportData;
//   failure: FailureData;
// }
export interface ReportDataParts extends UIDataTypes {
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
  /** Values for a parameterized report's `{{placeholder}}`s, keyed by name. */
  params?: Record<string, unknown>;
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
