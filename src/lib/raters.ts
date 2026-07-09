/**
 * Client helper for the run-rater edge function. Raw fetch rather than
 * supabase.functions.invoke for the same reason as lib/reports.ts: the
 * backend returns structured { error: { code, message, stepId } } payloads
 * (with a partial trace on step errors) that invoke would swallow.
 */

import { functionUrl, reportAuthHeaders } from '#/lib/reports';
import type {
  RaterError,
  RunRaterFailure,
  RunRaterRequest,
  RunRaterSuccess,
} from '#/types/raters';

/** Thrown by `runRater`; carries the structured backend error + partial trace. */
export class RunRaterError extends Error {
  readonly code?: string;
  readonly stepId?: string;
  readonly trace?: RunRaterFailure['trace'];

  constructor(error: RaterError, trace?: RunRaterFailure['trace']) {
    super(error.message);
    this.name = 'RunRaterError';
    this.code = error.code;
    this.stepId = error.stepId;
    this.trace = trace;
  }
}

export const runRater = async (
  body: RunRaterRequest,
): Promise<RunRaterSuccess> => {
  const headers = await reportAuthHeaders();
  const res = await fetch(functionUrl('run-rater'), {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as
    | RunRaterSuccess
    | RunRaterFailure
    | null;

  if (!res.ok || !json || 'error' in json) {
    const failure = json && 'error' in json ? json : null;
    throw new RunRaterError(
      failure?.error ?? {
        code: 'unknown',
        message: `Request failed (${res.status}).`,
      },
      failure?.trace,
    );
  }
  return json;
};
