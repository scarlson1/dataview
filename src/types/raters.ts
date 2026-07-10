/**
 * Client-side types for the rater builder. The DSL itself (definition,
 * steps, run results) is canonical in the shared module used by the
 * run-rater edge function — re-exported here so app code has one import
 * path and there is no reports-style manual type mirroring.
 */

export type {
  BranchCase,
  BranchStep,
  CalcStep,
  DbFetchStep,
  DecisionStep,
  FetchStep,
  HttpFetchStep,
  InlineLookupStep,
  LookupCell,
  LookupColumn,
  LookupMatch,
  LookupStep,
  LookupTableContent,
  MatchCondition,
  OutputFormat,
  OutputStep,
  RaterDefinition,
  RaterInput,
  RaterInputType,
  RaterOutcome,
  RaterOutputValue,
  RaterRunResult,
  RaterStep,
  RecordMapping,
  RefLookupStep,
  TraceStatus,
  TraceStep,
} from '#rater-shared/schema.ts';

export {
  DB_FILTER_OPS,
  emptyRaterDefinition,
  LOOKUP_COLUMN_TYPES,
  lookupTableContentSchema,
  matchConditionSchema,
  RATER_ENTITY_TABLES,
  RATER_INPUT_TYPES,
  RATER_LIMITS,
  raterDefinitionSchema,
  recordMappingSchema,
} from '#rater-shared/schema.ts';

export type {
  ValidationIssue,
  ValidationResult,
} from '#rater-shared/validate.ts';
export { validateRaterDefinition } from '#rater-shared/validate.ts';

import type {
  LookupColumn,
  RaterOutcome,
  RaterOutputValue,
  RaterRunResult,
  TraceStep,
} from '#rater-shared/schema.ts';

/** A row of the shared lookup-tables list page / picker. */
export interface LookupTableListRow {
  id: string;
  name: string;
  description: string | null;
  columns: LookupColumn[];
  updated_at: string;
  created_at: string;
}

/** A row of the saved-raters list page. */
export interface RaterListRow {
  id: string;
  name: string;
  description: string | null;
  last_run_at: string | null;
  updated_at: string;
  created_at: string;
}

/** Structured error from the run-rater edge function. */
export interface RaterError {
  code: string;
  message: string;
  stepId?: string;
}

export interface RunRaterRequest {
  raterId?: string;
  definition?: unknown;
  inputs: Record<string, unknown>;
  sourceRecord?: { table: string; id: number };
  dryRun?: boolean;
}

export interface RunRaterSuccess {
  outputs: Record<string, RaterOutputValue>;
  outcome: RaterOutcome | null;
  trace: RaterRunResult['trace'];
  durationMs: number;
}

/** Failed step runs still carry the partial trace for the trace panel. */
export interface RunRaterFailure {
  error: RaterError;
  outputs?: Record<string, RaterOutputValue>;
  trace?: { steps: TraceStep[] };
  durationMs?: number;
}
