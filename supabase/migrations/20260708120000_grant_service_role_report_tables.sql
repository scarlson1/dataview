-- The generate-report / run-report edge functions use the service-role admin
-- client (ctx.supabaseAdmin) for the spend ledger, run audit, and last_run_at.
-- 20260707100000_llm_reports.sql granted these tables to `authenticated` only,
-- so service_role was denied SELECT/INSERT/UPDATE. The daily-quota count then
-- failed with "permission denied", which the UI mislabeled as the 25/day limit.
grant select, insert on public.report_generation_log to service_role;
grant insert on public.report_runs to service_role;
grant update on public.reports to service_role;
