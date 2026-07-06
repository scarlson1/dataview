-- ----------------------------------------------------------------------------
-- Schedule seed_renewals() to run daily via pg_cron.
--
-- seed_renewals() is a security-definer function owned by postgres, so the cron
-- job (which runs as postgres) can call it directly with no extra grants. It is
-- idempotent (skips policies that already have a renewal), so the nightly run
-- and the manual "Seed renewals" button in the Workflow page cannot create
-- duplicates.
--
-- Runs at 06:00 UTC daily. Adjust the cron expression below to change the time.
-- Job run history is available in cron.job_run_details.
-- ----------------------------------------------------------------------------

-- Enable pg_cron (idempotent; ships with the local Supabase Postgres image and
-- can be created on hosted projects). Installs into the `cron` schema.
create extension if not exists pg_cron;

-- Remove any previous copy of the job so this migration is re-runnable.
select cron.unschedule('seed-renewals-daily')
where exists (select 1 from cron.job where jobname = 'seed-renewals-daily');

-- Schedule daily at 06:00 UTC. Uses the function's default 120-day window.
select cron.schedule(
  'seed-renewals-daily',
  '0 6 * * *',
  $$select public.seed_renewals();$$
);
