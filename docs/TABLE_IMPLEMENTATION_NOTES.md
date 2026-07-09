# Table Implementation Notes

Decisions, deviations, and open items for each table created as a Supabase
migration. Read this before applying migrations or changing schema — several
spec fields do not translate literally to Postgres.

## Conventions applied to all tables

- **`id` is `bigint generated always as identity`** (auto-increment), replacing
  the `*-YYYY-NNN` string ID formats in the specs. Related FKs are `bigint`.
- **`id_str text generated always as (id::text) stored`** on every table with a
  `bigint` `id` PK. supabase-js can't cast a column in a query (`select('id::text')`)
  and can't `ilike` an integer, so this stored column exposes the id as text for
  string reads/search. Writes still use the `bigint` `id`/FKs (coerce form string →
  number at the boundary). Not on the two natural-key tables (`lob_defaults`,
  `surplus_lines_state_rules`), which have no `id`.
- **`TIMESTAMP` → `timestamptz`** for all audit columns.
- **`updated_at ON UPDATE NOW()`** → a `before update` trigger, since Postgres
  has no `ON UPDATE` clause. Shared function: `public.set_updated_at()`
  (defined in the agencies migration; reused by later tables).
- **Non-immutable "Computed" columns cannot be stored generated columns.**
  Anything depending on the current date, another table, or an aggregate is
  derived in a `security_invoker` **view**, not stored on the table.
- **RLS is enabled on every table, with policies commented out** → only the
  `service_role` key can access until policies are added. Example
  `authenticated` read/write policies are staged in each migration.

---

## agencies — `20260701025459_create_agencies.sql`

- `agent_id` → `id` (identity), per request; `agent-YYYY-NNN` format dropped.
- `parent_id` — self-referencing FK (`NULL` = top-level agency).
- **`billing_id`** — stored generated column: `Parent` → `parent_id`, else `id`.
  Also carries an FK to `id`. Plain FK on a generated column works in PG 17.
- **`display_name`** — stored generated column (entity name, or `last, first`).
- **`do_status`** — NOT stored (depends on current date). Provided by the
  `agencies_with_status` view (`security_invoker = true`).
- Not added (optional): `id`/agency-code format CHECK, conditional
  entity-vs-individual name requirement.

## carriers — `20260701030955_create_carriers.sql`

- `id` made identity, `CAR-YYYY-NNN` format dropped (same as agencies).
  **Confirm** if the string ID scheme was actually wanted here.
- `carrier_name` unique in DB; the "must match QBO vendor name" rule is
  app-side, not enforced by the DB.
- `naic_number char(5) unique` but nullable — Postgres allows multiple NULLs,
  so carriers without a NAIC # don't collide.
- `carrier_type` CHECK includes escaped `Lloyd''s ...` values.
- Reuses `public.set_updated_at()` from the agencies migration.

## binder_section — `20260701100700_create_binder_section.sql`

- Named `binder_section` (the `binder_part` spec called this `binder_SECTION`;
  the FK reference in `binder_part.sql` was updated to `binder_section`).
- `sect_id` → `id` (identity); `binder_id` → `bigint` (to match `binder.id`).
- **`participation_amt`** = `section_limit × participation_pct` is **same-row**,
  so it IS a stored generated column here (unlike in `binder_part`).
- Spec has `created_at` but **no `updated_at`** → no update trigger.
- Timestamp deliberately placed **before** `binder_part` so the latter's FK and
  view can be live rather than deferred.
- **DEPENDS ON `binder` (binder), which does not exist yet.** The FK
  `binder_section.binder_id → binder.id` is staged as commented SQL at the bottom,
  to run once `binder` exists. `binder_id` is `NOT NULL`.

## binder_part — `20260701100755_create_binder_part.sql`

- `part_id` → `id` (identity); `sect_id` → `bigint` FK to `binder_section.id`
  (now **live**, since `binder_section` runs first).
- Spec has `created_at` but **no `updated_at`** → no update trigger.
- The two computed fields are provided by the **`binder_part_computed` view**
  (`security_invoker = true`), now live:
  - `participation_amt` = `section_limit × participation_pct` (join to section).
  - `section_total_pct` = `SUM(participation_pct)` per section (window agg).
- `sect_id` is `NOT NULL`, so rows can't be inserted until the referenced
  `binder_section` rows exist.

## policies (POL) — `20260701101355_create_policies.sql`

- `policy_id` → `id` (identity). Placed **before** all six POL-referencing tables
  (NBS/renewals/claims/payments/invoices/AR) so their `policy_id`/`new_policy_id` FKs
  are now **live** (were deferred).
- **Live FKs:** `parent_policy_id → policies.id` (self, NULL = New Business),
  `client_id → clients`, `agent_id → agencies`, `carrier_id → carriers`,
  `sl_licensee_override_agent_id → agencies`, `assigned_to_uw_id → underwriters`.
- **`binder_id → binder.id`** is now **live**. **Deferred FK:**
  `subscription_id → subscription` (a still-missing table — SUBSCRIPTION).
- **Spec bug fixed:** `placement_type` default was `'single_carrier'` (underscore)
  but its CHECK listed `'single carrier'` (space) — normalized both to
  `'single_carrier'`.
- **`accounting_date` IS a stored generated column** = `GREATEST(txn_date,
txn_eff_date)` (verified GREATEST works in a generated column on PG 17), so it
  stays indexed on the base table per spec.
- **All other computed fields → `policies_computed` view, still DEFERRED but no
  longer blocked by a missing table** (binder now exists). Generated columns
  can't reference other generated columns, so the cascade (`term_premium →
total_term_premium → total_term_prem_fees`, commission rates/amounts) must be a
  view regardless. It's now gated only on confirming the flagged business
  ASSUMPTIONS before it's trusted for revenue/commission numbers. Full view SQL
  is staged (commented) at the bottom of the migration:
  - `term_days` = transaction term (`txn_exp/eff`) falling back to policy term.
  - "chain" for `current_policy_exp_date` = `COALESCE(parent_policy_id, id)`.
  - SL resolution (`sl_licensee_name`, `sl_eligible_licensees`) — **corrected in
    `20260706120000_fix_sl_licensee_resolution.sql`** to match the workbook's
    `POL!AE`/`POL!AF`: matches on the billing group (`agencies.billing_id`, the
    one-hop "Billing AGT-ID" roll-up), filters `license_type='Surplus Lines'`,
    and returns the override agency's name directly when the override is set.
    The prior version matched the raw producing `agent_id` (missing licenses held
    by a billing parent). The entity/individual `SL_STATE_RULES` flags are
    advisory only and deliberately not applied. Verified by
    `supabase/tests/sl_licensee_test.sql`.

## binder (binder) — `20260701100600_create_binder.sql`

- `binder_id` → `id` (identity). No computed columns. `updated_at` trigger added.
- **Live FK:** `carrier_id → carriers.id` (NOT NULL). `binder_number` NOT NULL UNIQUE.
- Placed **before** `binder_section`/`new_business_submissions`/`policies` so all
  three `binder_id` FKs are now **live** (were deferred).
- `gross_com_pct` here is the source of truth consumed by the `policies_computed`
  view's commission cascade.

## underwriters — `20260701101350_create_underwriters.sql`

- Named `underwriters`; the deferred `assigned_to` FKs in NBS/RNW referenced
  `public.uw` — updated to `public.underwriters`.
- `uw_id` → `id` (identity). `display_name` = `last_name || ', ' || first_name`
  is a **stored generated column** (same-row, both names NOT NULL).
- Timestamp placed **before** `new_business_submissions` so its and `renewals`'
  `assigned_to → underwriters.id` FKs are now **live** (were deferred).
- `status` CHECK (`active/inactive/on_leave`); `updated_at` trigger added.

## surplus_lines_state_rules — `20260701101223_create_surplus_lines_state_rules.sql`

- **`state char(2)` is the natural primary key** — no surrogate `id` identity
  column here (deliberate deviation from the `id` convention; one row per state).
- No `created_at`/`updated_at` in the spec, so none added.
- Created before `license` so the latter's computed view can join it.

## license — `20260701101224_create_license.sql`

- `lic_id` → `id` (identity); `agent_id` → `bigint` FK to `agencies.id` (live).
- Spec has `created_at` but **no `updated_at`** → no update trigger.
- Three computed fields are derived in the **`license_computed` view**
  (`security_invoker = true`), not stored:
  - `status` = active/expired vs current date (non-immutable).
  - `days_to_expiration` = `exp_date - current_date` (non-immutable).
  - `entity_license_accepted` = from `surplus_lines_state_rules` for the
    license's state (cross-table; `left join` so states without a rules row
    still return the license).
- **`default_sl_licensee` uniqueness:** spec says "one TRUE per agency chain +
  State." "Agency chain" is not a stored column, so the partial unique index
  `license_one_default_sl_per_agent_state` enforces **per (agent_id, state)**
  instead. True chain-level enforcement needs a chain/root column or app logic.
  Residual caveat: SL resolution now matches on the **billing group**
  (`billing_id`), but this index is per `agent_id`, so two agents in the same
  billing group could each hold a state default; resolution takes `LIMIT 1`. The
  workbook's `Dup Check` guards this per billing group at data-entry time.
- `license.state` is NOT a FK to `surplus_lines_state_rules` (spec doesn't ask;
  adding one would require all referenced states to be seeded first). Optional.

## new_business_submissions — `20260701101359_create_new_business_submissions.sql`

- `nbs_id` → `id` (identity). `NBS-YYYY-NNN` format dropped.
- **`submission_number`** kept as a separate `varchar(20) not null unique` —
  it's a real external business reference (SUB-YYYY-NNN, for ACORD/carrier
  correspondence), distinct from the surrogate `id`. The app must generate it;
  the DB only enforces uniqueness/format is not enforced.
- **Live FKs:** `client_id → clients.id`, `agent_id → agencies.id`,
  `carrier_id → carriers.id` (all exist). `clients` was pre-existing in the DB
  (dashboard scaffolding; `id bigint`, RLS on, enum columns).
- **`assigned_to → underwriters.id`** and **`policy_id → policies.id`** are now
  **live**. `assigned_to` spec was `VARCHAR(100)`; made `bigint` to match the PK.
- **`binder_id → binder.id`** is now **live**.
- **`sl_licensee_override_agent_id`** — spec marks it `—` (not a FK); made
  `bigint` as a soft reference to an agency, no constraint enforced.
- `stage` and `priority` have CHECK constraints; `updated_at` trigger added.

## renewals — `20260701101807_create_renewals.sql`

- `rnw_id` → `id` (identity). `RNW-YYYY-NNN` format dropped.
- **Live FK:** `sl_licensee_override_agent_id → agencies.id` — note this column IS
  a FK here (spec marks FK → agent), unlike the same-named column in
  `new_business_submissions`, where it was not a FK.
- **`assigned_to → underwriters.id`**, **`policy_id → policies.id`** (NOT NULL),
  and **`new_policy_id → policies.id`** are now all **live**.
- The computed view is still deferred — `policies` now exists, but it also needs
  an LOB-default source and a prior-year-adjustments source (both undefined):
  `current_renewal_date`, `days_to_renewal`, `term_premium`,
  `annualized_premium`, `renew_prob_pct`, `ev_rnw_gwp`. Only the stored input
  `renew_prob_pct_override` is on the table. `annualized_premium`'s "prior-year
  adjustments" and `renew_prob_pct`'s LOB default both need a defined source.
- `current_renewal_date` is marked Indexed in the spec but is a view column —
  can't index directly; needs a materialized view or indexing the base source.
- `renewal_status` / `txn_type` CHECKs applied; `updated_at` trigger added;
  `inspection_fee` / `other_fees` default `0.00`.

## claims — `20260701101904_create_claims.sql`

- `clm_id` → `id` (identity). No computed columns.
- **Live FKs:** `client_id → clients.id`, `carrier_id → carriers.id`,
  `policy_id → policies.id` (all NOT NULL).
- `status` CHECK applied; `reserve_amt` / `paid_amt` default `0.00`;
  `updated_at` trigger added.

## payments — `20260701103300_create_payments.sql`

- `pmt_id` → `id` (identity).
- **`balance`** = `amount_due - amount_paid` is same-row → a **stored generated
  column** (not a view).
- **Live FKs:** `client_id → clients.id`, `policy_id → policies.id` (both NOT NULL).
- `invoice_number` is a plain cross-reference to INV (not a FK per spec).
- `payment_method` / `status` CHECKs applied; `amount_paid` defaults `0.00`.
- Spec has `created_at` only → **no `updated_at`**, no trigger.

## invoices — `20260701103401_create_invoices.sql`

- `inv_id` → `id` (identity). All snapshot fields are **stored** (point-in-time),
  per spec — no computed columns/view.
- **Live FKs:** `agent_id → agencies.id`, `policy_id → policies.id` (both NOT NULL).
- **Deferred FK:** `ar_id → ar.id` (NOT NULL).
- **`ar_id` relaxed to NULLABLE** (was spec'd NOT NULL) and made a normal FK
  added in the AR migration — see the circular-FK decision under
  `accounts_receivable`. Still `unique` (one invoice per AR).
- `invoice_status` CHECK applied; `updated_at` trigger added.
- `payments.invoice_number` is a plain varchar cross-ref, NOT a FK to this table.

## accounts_receivable — `20260701104052_create_accounts_receivable.sql`

- `ar_id` → `id` (identity).
- **Live FKs:** `inv_id → invoices.id` (NOT NULL, UNIQUE — one AR per invoice),
  `client_id → clients.id`, `agent_id → agencies.id`, `policy_id → policies.id` (NOT NULL).
- **Circular FK resolution (invoices ⇄ AR):** both specs marked the mutual FK
  `NOT NULL`, which is unsatisfiable with identity PKs (neither row's id exists
  first). Resolution: `accounts_receivable.inv_id` stays NOT NULL; **`invoices.ar_id`
  was made nullable** and its FK is added here (after AR exists). Insert flow:
  create invoice → create AR (`inv_id`) → set `invoices.ar_id`. No deferrable
  constraints needed because the back-ref column is nullable.

### Payment storage decision (pmt1..pmt4 → child table)

- The spec's 4 denormalized payment slots were **replaced with a child table
  `accounts_receivable_payments`** (per the user's follow-up spec): `ar_id` FK
  `on delete cascade`, `payment_date`, `payment_amount` (CHECK `> 0`),
  `payment_method` CHECK, `reference_number` (indexed), `notes`, `created_at`,
  `created_by`. Indexed: `ar_id`, `payment_date`, `reference_number`.
- JSONB array was considered and rejected (aggregation/indexing/integrity); the
  child table matches the relational style and the spec's normalization note.
- The computed balances live in the **`accounts_receivable_computed` view**
  (`security_invoker`): `total_paid`, `last_payment_date` (aggregates of the
  child table), `balance_due` (`invoice_total - total_paid - write_off_amt`),
  `days_outstanding` (`current_date - due_date`).
- **Overlap flag:** there are now two payment concepts — the top-level
  `payments` table (policy payment schedule, keyed to POL/CLT) and
  `accounts_receivable_payments` (receipts against an AR/invoice). Different grain,
  but worth confirming this is intentional and not a duplication.

## capacity (CAP) — `20260701110440_create_capacity.sql`

- `cap_id` → `id` (identity). **All five FKs are live** (`inv_id → invoices`,
  `ar_id → accounts_receivable`, `policy_id → policies`, `carrier_id → carriers`,
  `client_id → clients`, all NOT NULL) — no deferred FKs.
- **Snapshot group (point-in-time, from POL/INV):** `term_premium` and
  `commission_pct` are **stored** (app populates at creation);
  `gross_commission_amt` (`term_premium × commission_pct`) and
  `net_premium_due_carrier` (`term_premium − term_premium × commission_pct`) are
  **stored generated columns** off them.
- **Remittances → child table `capacity_remittance`** (`cap_id` FK
  `on delete cascade`, `remit_date`, `remit_amount`), replacing the remit1..4
  slots. This is the "structured array, not remit 1, etc." the spec asked for,
  in normalized form and consistent with `accounts_receivable_payments`. **If a
  JSONB array column was intended instead, easy to switch** — rewrite the view
  with `jsonb_array_elements`.
- **Live funding math → `capacity_computed` view** (`security_invoker`, LIVE —
  all inputs exist): `ar_total_collected`, `ar_balance_still_due`,
  `previously_paid_carrier`/`total_remitted`, `available_for_payment`,
  `balance_owing`, `funding_pct`, `funding_status`.
  - `carrier_net_pct` derived locally as `1 - commission_pct` from the CAP
    snapshot (avoids depending on the `policies_computed` view).
  - **`funding_status` CASE logic is an ASSUMPTION** ("balance_owing vs
    available_for_payment" was underspecified): Paid when `balance_owing ≤ 0`,
    else Partially Funded when `available_for_payment > 0`, else Awaiting
    Collection. Confirm thresholds.
  - `funding_pct` guards divide-by-zero (`net_premium_due_carrier` null/0 → null).
- `funding_status` marked Indexed in spec but is a view column — not directly
  indexable (materialized view if needed).
- `ap_status` CHECK (`Outstanding/Partial/Paid`); `updated_at` trigger added.

## net_com_uep (report) — `20260701111828_create_net_com_uep_view.sql`

- Derived report, no stored data. Implemented as **function
  `net_com_uep_asof(report_date date default current_date)`** (holds the logic;
  a plain view can't take the `report_date` parameter) **+ view `net_com_uep`**
  wrapping it at `current_date`. Use `net_com_uep_asof('YYYY-MM-DD')` for as-of
  reporting.
- Function is `STABLE` + **SECURITY INVOKER** (default) so caller RLS applies;
  view is `security_invoker = true`.
- **Sourcing decisions (assumptions to confirm):**
  - `total_term_premium` and `mga_net_com_amt` read from the **INV snapshot**
    (`invoices`), not recomputed from POL — invoices froze them and
    `policies_computed` is still deferred.
  - `status_as_of_rpt_date` derived: pending if `report_date < policy_eff_date`,
    expired if `> policy_exp_date`, else `policies.status`.
  - `client_name` = `clients.company_name` or `first_name || ' ' || last_name`.
  - **Grain:** one row per policy transaction; assumes ≤ 1 invoice per policy
    row (multiple invoices per pol would multiply rows).
- UEP math follows the spec (term_days, days_elapsed clamp, pro-rata/MEP UEP,
  received NEP %, selected %, funded amount); percent columns guard divide-by-
  zero (`term_days > 0`, `mga_net_com_amt <> 0`).

---

## Open cross-cutting items

- Migrations are **not applied yet**; the Supabase CLI is not installed.
- Live local DB has **dashboard-made changes not captured in any migration** —
  reconcile (`supabase db diff`) before `db reset`.
- Define **`subscription` (SUBSCRIPTION)** to unblock `policies.subscription_id`
  (the last deferred FK).
- **Enable `policies_computed`** — no longer blocked by a missing table; needs
  sign-off on the flagged business assumptions (term_days, chain, SL resolution).
- `renewals` computed view also needs an **LOB-default source** (for
  `renew_prob_pct`) and a **prior-year-adjustments source** (for
  `annualized_premium`) — both still undefined.
- (Done: binder/`binder`, POL/`policies`, UW/`underwriters`, AR — all `binder_id`/
  `policy_id`/`new_policy_id`/`assigned_to`/`ar_id` FKs are now live.)

---

## Policy-cycle logic implementation (workbook v3) — June 2026

Implemented on top of the existing schema; migrations edited **in place** (not yet
deployed) and validated with `supabase db reset --local`.

### Human-readable reference IDs

Every top-level entity now has a stored generated `*_ref` column
(`AGT-`, `CAR-`, `CLT-`, `BDR-`, `SECT-`, `PART-`, `LIC-`, `UW-`, `POL-`, `NBS-`,
`RNW-`, `CLM-`, `PMT-`, `INV-`, `AR-`, `ARPM-`, `CAP-`, `CPRM-`), e.g.
`POL-2026-00001`, with an inline `unique`. Format is `PREFIX-<ref_year>-<id padded 5>`:

- **Pad width is 5** (`lpad(id::text, 5, '0')`). `lpad` truncates from the right
  when the string exceeds the width, so a width of 4 would silently map id `10000`
  → `1000` and collide with id `1000`'s ref — and since `*_ref` is `unique`, the
  10,000th insert in a year would fail. Width 5 caps at 99,999 per year per table;
  raise the number (or switch to `lpad(id::text, greatest(5, length(id::text)), '0')`
  to never truncate) if a table can exceed that.

- `ref_year smallint` is stamped at insert (`extract(year from now())`); the
  workbook's per-year `NNN` reset is **not** reproduced — we zero-pad the global
  `id` instead, which is unique and stable.
- `to_char(timestamptz, …)` is **not IMMUTABLE**, so the year comes from the
  stored `ref_year` column (not `created_at`) to keep the generated expression valid.

### Activated computed views

- **`policies_computed`** (was staged/commented in `create_policies.sql`) is now
  live — resolves `gross_com_pct = COALESCE(override, binder rate)`, pro-rata
  `term_premium`, `total_term_premium`, `total_term_prem_fees`, `mga_net_com_*`,
  `carrier_net_*`, chain `current_policy_exp_date`, and SL licensee resolution.
  Fixed a latent bug: the `sl_eligible_licensees` subquery referenced
  `license.status` (which doesn't exist — status lives in `license_computed`);
  replaced with an inline `exp_date >= current_date` "active" check.
  **Assumptions still to confirm:** term_days = transaction term (fallback policy
  term); chain = `COALESCE(parent_policy_id, id)`. **SL resolution was corrected**
  in `20260706120000_fix_sl_licensee_resolution.sql` to match on `billing_id`
  (one-hop billing group), filter `license_type='Surplus Lines'`, and honor the
  override as a direct name — see the `license` section above.
- **`lob_defaults`** reference table (`line_of_business` PK,
  `default_renew_prob_pct`) seeded per LOB — supplies the previously-missing
  renewal-probability source.
- **`renewals_computed`** now live — sources `current_renewal_date`/`term_premium`
  from `policies_computed`, `renew_prob_pct` from `lob_defaults`, and derives
  `days_to_renewal`, `annualized_premium` (prior-year adjustments treated as 0),
  `ev_rnw_gwp`.

### Lifecycle functions — `20260701180000_lifecycle_functions.sql`

`security definer`, `search_path = public`, `execute` granted to `authenticated`:

- `bind_new_business(nbs_id)` → POL (mirror fields), sets `nbs.policy_id`/`stage='bound'`.
- `bind_renewal(renewal_id)` → renewal POL (parent = expiring), sets
  `renewals.new_policy_id`/`bound`, expires the prior policy. Guards non-renewal
  and already-bound.
- `seed_renewals(days_ahead)` → pending RNW rows for active head policies expiring
  in-window without one.
- `generate_invoice(policy_id)` → INV snapshot (from `policies_computed`) → AR →
  back-fill `invoices.ar_id` → CAP (only when `carrier_id` is set; subscription
  placements have no single-carrier payable). One invoice per policy.
- `record_ar_payment(...)` / `record_cap_remittance(...)` → validated child inserts;
  the latter is bounded by live `capacity_computed.available_for_payment`; both
  refresh the parent status column.

### RLS

`grant_authenticated_read_access.sql` extended from read-only to permissive
read **+ write** (`select, insert, update, delete` + `for all` policy) for
`authenticated` across base tables (incl. `lob_defaults`), since the app now writes.
Single-tenant internal tool; per-underwriter/agency scoping is a future refinement.

### Schema tab shows view columns enriched with base-table key/def/references

When a base table points `source` at a companion `_computed`/`_with_status` view
(see `tableMeta.ts`), the dashboard queries and displays the **view's** columns.
Postgres views carry no primary/foreign keys, unique constraints, or column
defaults, so the Schema tab's **Key** and **Default** columns rendered `—` for
all 10 view-backed tables (policies, clients, agencies, renewals,
accounts_receivable, license, capacity, binder_part, subscription_participant,
air_exposure). `buildTable()` in `src/data/tables.ts` now merges `key`, `def`,
and `references` from the matching **base** column (by `field`) into each view
column, preserving the view's column order. View-only computed columns have no
base match and pass through untouched; when `source === base.name` the merge is
a no-op identity. `schema.generated.ts` stays untouched — the enrichment happens
only in the registry the UI reads.

### information_schema hides FKs referencing tables the role doesn't own

`information_schema.constraint_column_usage` only exposes referenced tables the
current role **owns**, so the report agent's `get_table_schema` introspection
silently omitted every FK pointing at `auth.users` (owned by
`supabase_auth_admin`): `reports.created_by`, `report_runs.user_id`,
`report_generation_log.user_id`, `user_roles.user_id`. The `foreign_keys` CTE
in `supabase/functions/_shared/schemaTools.ts` is now built on `pg_constraint`
(which has no ownership filter) with `unnest(conkey, confkey) WITH ORDINALITY`
so composite FKs pair columns positionally instead of cartesian-producting.
Non-public referenced tables are schema-qualified (`auth.users`) so the model
doesn't look for them in `public`. Synthetic not-null CHECK rows
(`<oid>_<attnum>_not_null`) are filtered out of the `checks` output by name
pattern.

### raters / rater_runs: JSONB definition as single source of truth

The rater builder (migration `20260708150000_raters.sql`) stores the entire
logic DSL — `schema_version`, typed `inputs`, and the step tree — in one
`raters.definition` jsonb column, and every execution snapshots it into
`rater_runs.definition_snapshot`. This is deliberate: v1 has one mutable
definition per rater, but runs stay auditable after edits, and a later
draft→published `rater_versions` table can be added by lifting the column
(backfill `insert … select id, 1, definition from raters`) without touching
the DSL. The canonical Zod schema + expression evaluator + interpreter live in
`supabase/functions/_shared/rater/` and are imported by the frontend via the
`#rater-shared/*` subpath alias (package.json `imports` + tsconfig `paths`) —
no reports-style manual type mirroring. Two RBAC departures from the reports
tables: `raters` write is admin/underwriter only (accounting can run but not
edit), and `rater_runs` is readable by **all four roles** (runs history is a
user-facing feature on the rater detail page, unlike admin-only
`report_runs`). Service-role grants (`insert` on rater_runs, `select, update`
on raters) are in the migration itself — see the
`20260708120000_grant_service_role_report_tables.sql` lesson. Raters get
dedicated `/raters` routes; the tables are intentionally NOT in
`tableMeta.ts`/the generic `/$table` browser.
