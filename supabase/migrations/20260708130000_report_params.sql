-- Parameterized reports: run-time variable definitions for LLM-generated
-- reports. The SQL in `reports.sql` may carry {{snake_case}} placeholders;
-- `params` describes each one so the UI can render inputs and run-report can
-- validate + bind values. See supabase/functions/_shared/reportParams.ts for
-- the shape and the placeholder→bind-parameter compiler.

alter table public.reports
  add column params jsonb;

comment on column public.reports.params is
  'Run-time parameter definitions [{name,label,type,required,default,options,entity}]; null = unparameterized report.';
