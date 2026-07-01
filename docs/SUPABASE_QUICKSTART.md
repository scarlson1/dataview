# Supabase Development Workflow

All commands assume the Supabase CLI is a dev dependency (`pnpm add -D supabase`),
so they're run via `pnpm supabase …`. Requires Docker running locally.

## Local stack

```bash
pnpm supabase start      # start local Postgres/Auth/Studio (prints URL + anon key)
pnpm supabase status     # show local URLs/keys
pnpm supabase stop       # stop the stack
```

Studio UI: http://localhost:54323

## Migrations

Schema changes live in `supabase/migrations/` as timestamped SQL files.

```bash
pnpm supabase migration new <name>   # create an empty migration to hand-write SQL
pnpm supabase migration up           # apply pending migrations to local db
pnpm supabase db reset               # wipe local db, re-run ALL migrations + seed
pnpm supabase db diff -f <name>      # generate a migration from changes made in Studio
```

Prefer hand-written migrations for anything reviewed; use `db diff` to capture
quick Studio edits into a file.

## Create a table

Add to a new migration (`pnpm supabase migration new create_widgets`):

```sql
create table public.widgets (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- reachable by logged-in users
grant select, insert, update, delete on public.widgets to authenticated;

-- auto-RLS enables RLS; add the policy so authed users can actually see rows
create policy "authed full access" on public.widgets
  for all to authenticated using (true) with check (true);
```

Then `pnpm supabase db reset` (local) to apply.

> Gotcha: with automatic RLS on, a new table returns an **empty array (no error)**
> until a policy exists. Empty results = missing policy.

## Update a table

New migration with the change:

```sql
alter table public.widgets add column status text not null default 'active';
```

Apply with `pnpm supabase migration up` (or `db reset` to rebuild from scratch).

## RLS quick reference (this project = all authed see everything)

```sql
alter table public.<t> enable row level security;   -- auto-RLS already does this

create policy "authed full access" on public.<t>
  for all to authenticated using (true) with check (true);
```

- `to authenticated` → logged-out users get nothing.
- `using (true)` → any logged-in user sees all rows.
- `with check (true)` → any logged-in user can write.

## Generate TypeScript types

Run after any schema change:

```bash
pnpm supabase gen types typescript --local > src/types/database.types.ts
```

(Suggested script: `"gen:types"` in `package.json`.)

## Edge functions (webhooks / cron / service_role only)

```bash
pnpm supabase functions new <name>
pnpm supabase functions serve          # run locally
pnpm supabase functions deploy <name>  # deploy to hosted project
```

## Push to the hosted project

```bash
pnpm supabase link --project-ref <ref>   # one-time link
pnpm supabase db push                    # apply local migrations to remote
```

## Seed data

SQL in `supabase/seed.sql` runs automatically on every `pnpm supabase db reset`.
