# Database Testing Plan

Testing strategy for the Evertas Postgres/Supabase database, following
[Supabase's database testing guide](https://supabase.com/docs/guides/database/testing).

Tests run with **pgTAP** via the Supabase CLI:

```bash
supabase test db          # run every test in supabase/tests/database/
supabase test db --debug  # verbose TAP output when a test fails
```

Each test file is a single transaction that ends in `rollback`, so tests never
mutate the local dev database and can run in any order.

---

## 1. Why this database needs tests

The schema is not just tables — most of the business value lives in logic that
plain migrations can't guarantee stays correct:

- **6 lifecycle functions** (`security definer`) that perform atomic multi-table
  writes: `bind_new_business`, `bind_renewal`, `seed_renewals`,
  `generate_invoice`, `record_ar_payment`, `record_cap_remittance`.
- **Computed views** carrying the financial math: `policies_computed`,
  `capacity_computed`, `accounts_receivable_computed`, `net_com_uep`,
  `renewals_computed`, plus the AIR/exposure and reporting/export views.
- **RLS + grants**: a permissive `authenticated read`/`authenticated write`
  policy set applied across ~20 base tables, with `security_invoker` views on top.

These are exactly the things that break silently during a refactor. The plan
below prioritizes them over trivial "does the column exist" checks.

---

## 2. Setup (one-time)

1. **Enable pgTAP.** Add a migration so the extension exists on every reset:

   ```sql
   -- supabase/migrations/<ts>_enable_pgtap.sql
   create extension if not exists pgtap with schema extensions;
   ```

   (pgTAP is only needed locally/CI, but installing via migration keeps
   `supabase db reset` self-contained. It can live behind a guard if we don't
   want it in production.)

2. **Install test helpers (recommended).** Basejump's
   [`supabase_test_helpers`](https://github.com/usebasejump/supabase-test-helpers)
   provides `tests.create_supabase_user()`, `tests.authenticate_as()`, and
   `tests.clear_authentication()` — which make RLS tests readable. Load it as a
   local-only helper (not shipped to prod).

3. **Create the test directory:** `supabase/tests/database/`.

4. **Rely on `supabase/seed.sql`.** Reset loads the seed, so read-only view/RLS
   tests can assert against known seed rows. Function tests should insert their
   own fixtures inside the test transaction instead, so they don't depend on
   seed data that changes.

---

## 3. Test file structure

Standard pgTAP skeleton used by every file:

```sql
begin;
select plan(4);                       -- exact number of assertions

-- ...arrange fixtures, act, assert...
select is( actual, expected, 'description' );

select * from finish();
rollback;
```

Proposed layout under `supabase/tests/database/`:

| File | Covers |
|------|--------|
| `00_schema.test.sql` | structural smoke checks (tables/views/columns/PK/FK exist) |
| `01_rls_grants.test.sql` | RLS enabled + `authenticated` can read/write, `anon` cannot |
| `10_bind_new_business.test.sql` | NBS → POL transition + guard clauses |
| `11_bind_renewal.test.sql` | RNW → POL, parent link, expiring policy → `expired` |
| `12_seed_renewals.test.sql` | window filter + "no duplicate renewal" logic |
| `20_generate_invoice.test.sql` | POL → INV → AR → CAP fan-out + one-invoice guard |
| `21_record_ar_payment.test.sql` | payment insert + `ar_status` recompute |
| `22_record_cap_remittance.test.sql` | remittance bound by `available_for_payment` |
| `30_computed_views.test.sql` | financial math in `policies_computed` / `net_com_uep` |

Number-prefix ordering just makes the TAP output readable; files are independent.

---

## 4. What to test, by priority

### Tier 1 — Lifecycle functions (highest value)

These do atomic multi-table writes and have explicit guard clauses. Test both
the happy path (rows land in every target table with correct values) and each
`raise exception` branch.

**`bind_new_business(nbs_id)`**
- Happy path: given a bound-ready NBS, a `policies` row is created with the
  mirrored fields (client, carrier, premiums, dates), and the NBS is updated to
  `stage = 'bound'` with `policy_id` back-filled.
- `throws_ok` when the NBS id doesn't exist.
- `throws_ok` when the NBS is already bound (`policy_id is not null`).
- `throws_ok` when required fields (`line_of_business`, `policy_eff_date`,
  `policy_exp_date`) are null.

**`bind_renewal(renewal_id)`**
- Happy path: new POL created from expiring policy + overrides;
  `parent_policy_id` links to the expiring policy; `coalesce` overrides win where
  provided and fall back to the expiring policy otherwise.
- The expiring policy transitions `active → expired`.
- The renewal row is updated to `renewal_status = 'bound'`.
- `throws_ok` for: renewal not found, already bound, `txn_type = 'non-renewal'`,
  expiring policy not found.

**`seed_renewals(days_ahead)`**
- Inserts a `pending` renewal for an active policy expiring inside the window.
- Does **not** insert for policies outside the window, already-renewed policies
  (child exists via `parent_policy_id`), or policies that already have a renewal
  row. Assert the returned row count.

**`generate_invoice(policy_id)`**
- Happy path fan-out: one `invoices` row, one `accounts_receivable` row,
  `invoices.ar_id` back-filled, and — only for single-carrier placements
  (`carrier_id is not null`) — one `capacity` row.
- Assert no `capacity` row is created when `carrier_id is null`.
- `throws_ok` when the policy doesn't exist and when an invoice already exists
  for the policy (the one-invoice-per-policy guard `net_com_uep` relies on).

**`record_ar_payment(...)`**
- Inserts an `accounts_receivable_payments` row.
- `ar_status` recompute: `outstanding` → `partial` (partial pay) → `paid` when
  cumulative payments ≥ `invoice_total - write_off_amt`. Test each boundary.
- `throws_ok` on non-positive amount and unknown AR id.

**`record_cap_remittance(...)`**
- Inserts a `capacity_remittance` row and recomputes `ap_status`
  (`outstanding`/`partial`/`paid`) vs `net_premium_due_carrier`.
- `throws_ok` when amount exceeds `available_for_payment` (respect the 0.005
  tolerance — one test just under, one just over).
- `throws_ok` on non-positive amount and unknown CAP id.

### Tier 2 — Computed views (financial correctness)

Insert a controlled policy, then assert the derived columns equal hand-computed
expected values. High-value targets:

- `policies_computed`: `term_premium`, `total_term_premium`,
  `total_term_prem_fees`, `mga_net_com_pct`/`mga_net_com_amt`, `gross_com_pct`.
- `net_com_uep`: `term_days`, `days_elapsed`, `pro_rata_elapsed_pct` /
  `pro_rata_uep_pct`, `mep_max_uep_pct = 1 - min_earned_prem_pct`, and
  `selected_net_com_uep_pct = least(uep_pct_required, received_nep_pct)`.
- `accounts_receivable_computed` / `capacity_computed`: balances, aging buckets,
  `available_for_payment`, `net_premium_due_carrier`.

Use fixed `report_date` inputs so pro-rata math is deterministic (don't let
`current_date` leak in). Assert with `is(...)` on rounded numerics, or
`results_eq` for multi-row expectations.

### Tier 3 — RLS & grants (access correctness)

Following the [RLS testing guide](https://supabase.com/docs/guides/database/postgres/row-level-security#testing-policies):

- `anon` role gets **zero rows** / permission denied on base tables and views.
- `authenticated` role can `select`, `insert`, `update`, `delete` on the granted
  base tables (per `20260701174102_grant_authenticated_read_access.sql`).
- `security_invoker` views (`*_computed`, `net_com_uep`, `agencies_with_status`)
  return rows for `authenticated` and nothing for `anon`.
- Regression guard: assert every table in the grant loop actually has RLS
  enabled and both the `authenticated read` and `authenticated write` policies.

Pattern (with basejump helpers):

```sql
select tests.clear_authentication();
set local role anon;
select is_empty('select * from public.policies', 'anon sees no policies');

select tests.authenticate_as('test-user');
select isnt_empty('select * from public.policies', 'authenticated sees policies');
```

### Tier 4 — Structural smoke tests (cheap regression net)

Fast `has_table` / `has_column` / `has_view` / `col_is_pk` / `fk_ok` checks so a
dropped column or broken FK fails loudly. Keep these minimal — they catch
migration mistakes but don't prove behavior. Good candidates: the FK chain
POL → INV → AR → CAP, and the presence of each computed view.

---

## 5. Useful pgTAP assertions

| Function | Use |
|----------|-----|
| `has_table` / `has_view` / `has_column` | structure exists |
| `col_is_pk` / `col_is_fk` / `fk_ok` | keys and relationships |
| `is(a, b, desc)` / `isnt` | scalar value equality (financial math) |
| `results_eq(sql, sql/array)` | full result-set comparison |
| `is_empty` / `isnt_empty` | RLS visibility checks |
| `throws_ok(sql, errmsg)` | guard-clause / exception branches |
| `lives_ok(sql)` | happy-path shouldn't error |
| `function_returns` / `has_function` | function signatures intact |
| `results_ne`, `bag_eq`, `set_eq` | order-independent set comparisons |

---

## 6. CI integration

Add a GitHub Actions job that spins up the CLI, applies migrations + seed, and
runs the suite on every PR touching `supabase/`:

```yaml
- uses: supabase/setup-cli@v1
- run: supabase db start
- run: supabase test db
```

This makes migrations gate on green tests, which is the whole point — a schema
change that breaks `generate_invoice` or the UEP math fails the PR instead of
production.

---

## 7. Suggested rollout order

1. pgTAP migration + `supabase/tests/database/` + one trivial passing test →
   confirm `supabase test db` runs green in CI.
2. Tier 1 function tests (bind → invoice → payment → remittance) — the atomic
   writes are the riskiest surface.
3. Tier 2 computed-view value tests.
4. Tier 3 RLS/grant tests.
5. Tier 4 structural smoke tests backfilled as regressions appear.
