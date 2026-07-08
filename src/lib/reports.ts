/**
 * Client helpers for the report edge functions. Both `generate-report` (SSE)
 * and `run-report` (JSON) are hit with a raw `fetch` rather than
 * `supabase.functions.invoke`: invoke throws on non-2xx and hides the response
 * body, but the backend returns structured `{ error: { code, message, hint } }`
 * payloads we must surface. A raw fetch also keeps the auth-header shape
 * identical to the streaming transport.
 */

import { supabase } from '#/supabaseClient';
import type {
  ReportError,
  RunReportRequest,
  RunReportSuccess,
} from '#/types/reports';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const functionUrl = (name: string): string =>
  `${SUPABASE_URL}/functions/v1/${name}`;

/**
 * Auth + apikey headers for a report function call. The edge functions verify
 * the incoming access token (`withSupabase({ auth: ['user'] })`), so the caller
 * must be signed in.
 */
export const reportAuthHeaders = async (): Promise<Record<string, string>> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('You must be signed in to run reports.');
  return {
    Authorization: `Bearer ${session.access_token}`,
    apikey: SUPABASE_KEY,
  };
};

/** Thrown by `runReport`; carries the structured backend error for the UI. */
export class RunReportError extends Error {
  readonly hint?: string;
  readonly code?: string;

  constructor(error: ReportError) {
    super(error.message);
    this.name = 'RunReportError';
    this.hint = error.hint;
    this.code = error.code;
  }
}

/**
 * Execute SQL (a saved report by id, or candidate SQL) through the guarded
 * executor. `cap: 'preview'` (default) returns up to 500 rows for grids;
 * `cap: 'export'` up to 50k for CSV.
 */
export const runReport = async (
  body: RunReportRequest,
): Promise<RunReportSuccess> => {
  const headers = await reportAuthHeaders();
  const res = await fetch(functionUrl('run-report'), {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as
    | RunReportSuccess
    | { error?: ReportError }
    | null;

  if (!res.ok || !json || 'error' in json) {
    const error = json && 'error' in json ? json.error : undefined;
    throw new RunReportError(
      error ?? { code: 'unknown', message: `Request failed (${res.status}).` },
    );
  }
  return json;
};
