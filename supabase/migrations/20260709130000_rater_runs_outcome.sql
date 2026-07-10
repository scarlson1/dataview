-- Rater terminal decisions. A `decision` step (e.g. a decline or refer) stops a
-- run successfully with a named outcome — distinct from computing premium
-- outputs. Persist it on the audit row so "how many declines this month" is a
-- plain query, and so the run-detail dialog can show the outcome after the fact.
alter table public.rater_runs
  add column outcome jsonb; -- { decision, reason, label?, stepId } | null

comment on column public.rater_runs.outcome is
  'Terminal decision reached (decline/refer/…): { decision, reason, stepId }. Null when the run produced normal outputs.';
