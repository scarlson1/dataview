# Layout / DataGrid refactor — in-progress handoff

Converting the dashboard from a Claude-design mock (hardcoded rows in
`data/tables.ts`) to a **schema-driven** setup: MUI X DataGrid in server mode,
one dynamic `$table` route, columns derived from the live Supabase schema.

## Decisions (already agreed with user)
- Use `@mui/x-data-grid` (already a dep) in **server mode** (pagination/sort/
  filter run in Postgres). Critical because tables like `events` are huge.
- **Single dynamic route** `_dashboard.$table.tsx` serves every table from a
  registry — NOT one file per table. Bespoke screens (e.g. `policies.new.tsx`)
  stay as explicit routes.
- Columns derived from schema via a **generator** + hand overlay, not runtime
  introspection.

## Environment facts
- Local Supabase is running (API `127.0.0.1:54321`, DB `:54322`).
- Only `agencies`, `clients` (tables) + `agencies_with_status` (view) are
  applied. The 13 new migration files are untracked & NOT applied.
- `gen types` needs the postgres-meta docker image; `--local` failed to pull it
  but `--db-url ...54322` worked (image now cached). Use `pnpm gen:types`.
- **RLS is ON with 0 policies** on agencies/clients → anon key gets 0 rows.
  Each table has 1 row. For browser verification we must add temp dev SELECT
  policies (local only, reversible) — see task #6.

## Done
- `scripts/gen-schema.mjs` + `pnpm gen:schema` → writes `src/data/schema.generated.ts`
  (SCHEMA manifest: columns, type label, nullable, PK/FK/UNIQUE, `kind`).
  Chips detected via CHECK constraints + name heuristic. Ran successfully.
- `src/data/database.types.ts` — generated Supabase Row types.
- `src/data/tableMeta.ts` — overlay (icon, description, `source` view, hidden,
  PREFERRED_ORDER, COMPUTED_VIEW_SUFFIXES).
- `src/data/tables.ts` — REWRITTEN as registry builder (TABLES/TABLE_ORDER/
  TableDef/TableColumn/getTable/formatCount/capitalize). No more mock rows.
  `TableDef.source` = view to query; `TableDef.primaryKey` for grid row id.
- `src/data/columns.tsx` — `toGridColumns(table)`: kind → GridColDef
  (chip/mono/number/datetime/bool/json renderers).
- `src/hooks/useTableData.ts` — React Query hook, Supabase `.range/.order`,
  filter-item + quick-search translation, `count:'exact'`.
- `src/components/TableIcon.tsx` — expanded icon map (domain icons).
- `src/supabaseClient.ts` — FIXED env bug (was reading VITE_SUPABASE_ANON_KEY;
  `.env.local` has VITE_SUPABASE_PUBLISHABLE_KEY). Now typed with `Database`.
- `src/components/dashboard/DataTab.tsx` — REWRITTEN to `<DataGrid>` server mode
  (owns pagination/sort/filter state; `showToolbar`).

## Remaining (TODO) — ALL DONE, see below
1. ~~**TableViewer.tsx**~~ DONE — now owns its own `tab` state locally
   (`useState<ViewerTab>('data')`); `search`/`onSearch`/`onTabChange` props
   removed. Props are just `{ table, onRefresh }`.
2. ~~**Routes**~~ DONE:
   - `src/routes/_dashboard.tsx` — layout: Sidebar + TopBar + `<Outlet/>`.
     Holds `collapsed` state; reads active table via `useParams({strict:false})`.
   - `src/routes/_dashboard.index.tsx` — `beforeLoad` redirect to
     `/$table` with `TABLE_ORDER[0]`.
   - `src/routes/_dashboard.$table.tsx` — `getTable(params.table)`; renders
     `<TableViewer key={table.name} .../>`; refresh invalidates
     `['table-data', table.source]`; renders a 404 message if unknown table.
   - Old `src/routes/index.tsx` deleted.
   - `routes/policies.new.tsx` and `routes/login.tsx` left top-level (outside
     layout), untouched — still WIP (pre-existing TS errors there are unrelated
     to this refactor, left as-is).
3. ~~**Sidebar.tsx**~~ DONE — count Typography + `formatCount` import removed
   (also deleted the now-unused `formatCount` export from `tables.ts`).
   Navigates via `onSelectTable` → `navigate({ to: '/$table', params })`.
4. ~~`pnpm generate-routes` + typecheck~~ DONE. `npx tsc --noEmit` is clean
   except pre-existing `routes/policies.new.tsx` stub errors (unrelated WIP).
   Also had to fix `useTableData.ts`: `table.source` is a dynamic string but
   the generated `Database` type only knows the currently-applied tables
   (`agencies`/`clients`/`agencies_with_status`), so `.from()` needed a
   `as never` cast + `as unknown as PostgrestFilter`, and the returned rows
   needed a cast to `Record<string, unknown>[]`. This is inherent to the
   schema-driven design (real relation names aren't statically known) and will
   need the same treatment for every future migration until/unless the whole
   query path moves off the generated `Database` type.
5. **Verified (task #6) — DONE.** Local Supabase was already running.
   Found `anon`/`authenticated` had **no SELECT grant at all** on
   `agencies`/`clients`/`agencies_with_status` (not just missing RLS
   policies) — `permission denied for view agencies_with_status` surfaced in
   the DataTab's error `Alert` until fixed. Ran, **local only, NOT migrations**:
   ```sql
   create policy dev_read on agencies for select using (true);
   create policy dev_read on clients for select using (true);
   grant select on public.agencies, public.clients, public.agencies_with_status
     to anon, authenticated;
   ```
   Confirmed via preview tools: `/agencies` and `/clients` render real rows in
   the DataGrid, Schema tab renders live columns, unknown-table route shows the
   404 message, `/` redirects to `/agencies`. No console errors.

   **Teardown SQL (run before committing/sharing, or once real Supabase auth
   policies are designed):**
   ```sql
   drop policy dev_read on agencies;
   drop policy dev_read on clients;
   revoke select on public.agencies, public.clients, public.agencies_with_status
     from anon, authenticated;
   ```

## Watch out
- DataGrid v9: `showToolbar` boolean prop provides the toolbar w/ quick filter.
  Quick filter → `filterModel.quickFilterValues` (handled in useTableData).
- `getRowId` uses `table.primaryKey` (e.g. surplus_lines_state_rules PK=state).
- Switching tables must reset grid state → `key={table.name}` on the viewer.
- `_dashboard.$table` (`/policies`) must not clash with `policies.new`
  (`/policies/new`) — different segment depth, OK.
