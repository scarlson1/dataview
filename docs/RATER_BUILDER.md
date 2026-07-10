# Rater Builder

Status: **shipped (v1).** Referenced from [ROADMAP.md](ROADMAP.md).

A **rater** is a saved, executable piece of rating logic: from a set of typed
inputs it computes one or more outputs (premiums, factors, rates) through a
sequence of steps — formulas, inline lookup tables, data fetches, and decision
branches. It's the web-native replacement for the pricing formulas that used to
live in the SingleSource workbook.

The whole rater is a single JSON document (the "definition"). The form-based
builder and the flow diagram are both just **views** of that document — the JSON
is the one source of truth. This keeps the door open for other authoring modes
later (a drag-and-connect canvas, or an LLM-assisted conversational builder like
the report generator) without changing the data model.

## Table of contents

- [Where things live](#where-things-live)
- [Concepts](#concepts)
- [The definition (JSON DSL)](#the-definition-json-dsl)
  - [Inputs](#inputs)
  - [Steps](#steps)
  - [Outputs — how they work](#outputs--how-they-work)
  - [Decisions — terminal outcomes](#decisions--terminal-outcomes-decline--refer-)
  - [The expression language](#the-expression-language)
- [Worked example](#worked-example)
- [How a rater is used (execution)](#how-a-rater-is-used-execution)
- [Data model](#data-model)
- [Permissions](#permissions)
- [Validation](#validation)
- [Record pre-fill](#record-pre-fill)
- [The diagram](#the-diagram)
- [Testing](#testing)
- [Configuration](#configuration)
- [Limits](#limits)

## Where things live

| Concern                                                    | Path                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| DSL schema, evaluator, interpreter, validation (canonical) | `supabase/functions/_shared/rater/{schema,expr,validate,interpreter,coerce}.ts` |
| Execution endpoint                                         | `supabase/functions/run-rater/index.ts`                                         |
| DB migration                                               | `supabase/migrations/20260708150000_raters.sql`                                 |
| Frontend types (re-export shared + client-only)            | `src/types/raters.ts`                                                           |
| Run client                                                 | `src/lib/raters.ts`                                                             |
| Builder UI                                                 | `src/components/raters/`                                                        |
| Diagram                                                    | `src/components/raters/diagram/`                                                |
| Routes                                                     | `src/routes/_dashboard.raters.*`                                                |

The shared code is imported into the frontend via the `#rater-shared/*` alias
(`package.json` `imports` + `tsconfig.json` `paths`), so there is exactly one
copy of the schema/interpreter — no manual type mirroring.

## Concepts

- **Definition** — the JSON document: `{ schema_version, inputs, steps }`.
- **Input** — a typed value the caller supplies at run time (e.g. `asset_value`).
- **Step** — one unit of logic. Each step has a unique `id` that doubles as its
  **binding name**: later steps reference an earlier step's result by its id.
- **Binding** — a named value in scope. Inputs are referenced as
  `inputs.<name>`; step results as `<step_id>` (and `<step_id>.<field>` when the
  step produced an object, e.g. a lookup row).
- **Output** — a special step whose result is surfaced as a named, formatted
  result of the run.
- **Trace** — the per-step record produced by a run (status, value, detail).
- **Run** — one execution of a rater against a set of inputs, audited in
  `rater_runs`.

## The definition (JSON DSL)

```jsonc
{
  "schema_version": 1,
  "inputs": [
    /* RaterInput[] */
  ],
  "steps": [
    /* RaterStep[] — executed top to bottom */
  ],
}
```

Execution is a **linear list with nested branches** (not a free graph). Steps
run in document order; a `branch` step nests sub-lists per case. Because every
binding is referenced by name and only earlier bindings are in scope, the steps
form an implicit DAG — which is what the diagram draws.

### Inputs

Same shape as report parameters, so the run-form UX and coercion are shared.

```jsonc
{
  "name": "asset_value", // snake_case; referenced as inputs.asset_value
  "label": "Assets under custody (USD)",
  "type": "number", // text | number | date | select | boolean | entity
  "required": true,
  "default": null, // optional literal that pre-fills the form
  "options": [
    /* {value,label} — for select */
  ],
  "entity": { "table": "policies" }, // for entity: a record picker (value = row id)
}
```

At run time, provided values are validated and coerced against these
declarations (`coerce.ts`): dates to `YYYY-MM-DD`, entity to a positive integer
id, absent values fall back to `default` or `null`, and a missing **required**
input fails the run with `missing_input`.

### Steps

All steps share `{ id, label? }`. `id` is the binding name (snake_case, unique
per execution path). Types:

| Type           | What it does                                                                                 | Binds                                 |
| -------------- | -------------------------------------------------------------------------------------------- | ------------------------------------- |
| `calc`         | Evaluates an expression                                                                      | the value                             |
| `lookup`       | Finds a row in an **inline** reference table (exact match and/or range bands)                | the matched row object → `id.column`  |
| `fetch` (db)   | Declarative PostgREST query against an app table, under the caller's RLS                     | the row / null / list                 |
| `fetch` (http) | External HTTPS API call (allowlisted, server-only); pulls values by JSON dot-path            | `{ [extract.name]: value }`           |
| `branch`       | Evaluates each case's `when`; first truthy case runs its nested steps, else the `else` block | nothing (inner steps bind into scope) |
| `decision`     | Terminal: ends the run with a named outcome (decline / refer / …) — see [Decisions](#decisions--terminal-outcomes-decline--refer-) | nothing (halts the run) |
| `output`       | Produces a named, formatted result of the run                                                | the value (and adds to `outputs`)     |

`lookup` is the "small reference table" primitive — e.g. base-rate-by-custody-
type, or a size-band factor grid. Rows are matched by one or more conditions
that AND together; the **first** matching row wins (row order matters), and a
missing match either errors or falls back to a default row.

### Outputs — how they work

An output is _not_ a generic "value + currency type" pair — it's a dedicated
step with three meaningful fields:

```jsonc
{
  "id": "annual_premium", // binding key; also the key in the outputs map
  "type": "output",
  "label": "Annual premium", // the human-readable NAME shown on the result card
  "expr": "premium", // formula → the VALUE (evaluated at run time)
  "format": "money", // money | percent | number | text — display only
}
```

Given `"Annual premium: $16,100"`:

- **`label`** (`"Annual premium"`) is where the name comes from. It's free text
  you type in the Output editor — required, purely a display label.
- **`expr`** (`"premium"`) is evaluated against the run scope to produce the raw
  value. Here it just reads an earlier `calc` step's binding (`16100`), but it
  can be any expression (`premium / inputs.asset_value`, etc.).
- **`format`** (`"money"`) controls _rendering only_. `formatOutput()` in
  [`OutputCards.tsx`](../src/components/raters/OutputCards.tsx) switches on it:
  - `money` → `money(value, 2)` (the app's USD formatter) → `"$16,100.00"`
  - `percent` → `pct(value)` → `"0.064%"`
  - `number` → the plain number
  - `text` → the value as-is (for string outputs)

A rater can declare **several** output steps. They're collected into a map keyed
by step id:

```jsonc
{
  "annual_premium": {
    "label": "Annual premium",
    "value": 16100,
    "format": "money",
  },
  "effective_rate": {
    "label": "Effective rate",
    "value": 0.000644,
    "format": "percent",
  },
}
```

Each entry renders as its own result card on the run page. **Important:** the
stored value (`rater_runs.outputs`) is the _raw_ number — `16100`, not
`"$16,100"`. `format` never touches the stored data, so any downstream consumer
(the planned submission integration, an export, an API) gets the number.

### Decisions — terminal outcomes (decline / refer / …)

A `decision` step ends the run **successfully** with a named outcome instead of
computing more outputs — the model for knock-out rules like "decline over $1B"
or "refer to an underwriter". It's distinct from an error (which is a 422): a
fired decision returns 200 with an `outcome`.

```jsonc
{
  "id": "decline_high_value",
  "type": "decision",
  "outcome": "decline",   // free-text: decline, refer, review, …
  "when": "inputs.asset_value > 1000000000", // optional — see below
  "reason": "'Asset value exceeds $1B capacity'" // optional expression (quote literal text)
}
```

- **`outcome`** — a free-text label. `decline`/`reject` render as a red banner,
  `refer`/`review` as amber, anything else as neutral.
- **`when`** — gates the step. **Absent → always fires** (an unconditional
  terminal, e.g. a catch-all `refer` at the end). **Present → fires only when
  truthy**, otherwise execution *falls through* to the next step. This is the
  knock-out pattern: a flat list of decline conditions at the top of the rater,
  each falling through to normal rating when it doesn't fire.
- **`reason`** — an optional expression (so quote literal text: `'Over capacity'`,
  or interpolate: `concat('Score ', string(inputs.score), ' below 600')`). Shown
  in the outcome banner and the run trace.

When a decision fires it halts everything after it (remaining steps are marked
`skipped` in the trace — including steps across an enclosing branch boundary),
sets the run's `outcome`, and skips the premium outputs. The run result and the
`rater_runs.outcome` jsonb column carry `{ decision, reason, stepId, label? }`,
so "how many declines this month" is a plain query.

**Every path must terminate** in either an output or an **unconditional**
decision — the validator errors otherwise. A conditional-only decision doesn't
count (execution continues when its `when` is false), and steps placed after an
unconditional decision warn as unreachable. In the diagram a fired decision
shows as a red terminal node badged with its outcome.

Two ways to author a decline, both valid:

- **Knock-out (recommended for gating):** a `decision` with a `when` near the
  top; falls through to the rest of the rater when the condition is false.
- **Branch + unconditional decision:** put the decline in a branch case as an
  unconditional `decision`, and the rating in the `else`. Useful when the decline
  condition is naturally part of a wider branch.

### The expression language

`calc`/`output` formulas, `lookup` match values, `fetch` filter values, `branch`
conditions, and `{{...}}` segments in http URLs are all written in a small,
safe expression language (`expr.ts`). It's a hand-written parser/evaluator — no
`eval`, no dependencies, identical in Deno and the browser.

- **Literals**: numbers, `'strings'`, `true`, `false`, `null`
- **References**: dot paths — `inputs.state`, `base_rate.rate`
- **Operators** (low→high precedence): `?:`, `or`, `and`, `not`,
  `== != < <= > >=`, `+ -`, `* / %`, unary `-`, parentheses
- **Functions**: `min max abs round(x,dp) floor ceil clamp coalesce if
concat upper lower len contains number string`
- **Semantics**: numbers are IEEE doubles (round money explicitly with
  `round(x, 2)`); string equality and lookup exact-match are **case-insensitive**;
  arithmetic or ordered comparison on `null`/non-numbers throws a structured
  error naming the operand (never a silent `NaN`); only `==`/`!=` accept null;
  `+` is numeric only — use `concat()` to join text.

## Worked example

A crypto-custody premium rater. Inputs: `asset_value` (number), `custody_type`
(select: cold/warm/hot), `state` (text). Steps:

1. `base_rate` **lookup** — exact match on custody type → cold `0.0008` / warm
   `0.0015` / hot `0.0030`.
2. `size_factor` **lookup** — range bands on `asset_value`:
   `[0,1M)→1.00`, `[1M,10M)→0.85`, `[10M,50M)→0.70`, `[50M,∞)→0.55`.
3. `sl_rule` **fetch (db)** — read `surplus_lines_state_rules` where
   `state = upper(inputs.state)`, mode `maybe`.
4. `state_adjustment` **branch** — NY → `state_factor = 1.15`; else if the state
   rule disallows entity licensing → `1.05`; otherwise `1.0`.
5. `raw_premium` **calc** —
   `inputs.asset_value * base_rate.rate * size_factor.factor * state_factor`.
6. `premium` **calc** — `max(round(raw_premium, 2), 2500)` (a $2,500 minimum).
7. `annual_premium` **output** (`premium`, money) and `effective_rate`
   **output** (`premium / inputs.asset_value`, percent).

Run with `{ asset_value: 25_000_000, custody_type: "cold", state: "NY" }`:
`0.0008 × 0.70 × 1.15 × 25M = $16,100`. This is exactly the case asserted in
`interpreter.test.ts`.

## How a rater is used (execution)

Today a rater is run **manually from its own detail page**
(`/raters/:id`). There is one execution path — the `run-rater` edge function —
used by both real runs and builder test runs.

```
Run page (or builder Test-run tab)
   │  runRater({ raterId | definition, inputs, sourceRecord?, dryRun? })
   ▼
run-rater edge function  (supabase/functions/run-rater/index.ts)
   1. Auth: withSupabase({ auth: ['user'] })
   2. Load definition under the CALLER's RLS (raterId), or accept an inline
      definition (builder test runs). 404 if not readable/archived.
   3. Re-validate the definition (zod + static checks) — fail closed.
   4. Coerce inputs against definition.inputs.
   5. executeRater(definition, inputs, adapters):
        - dbFetch adapter → ctx.supabase (RLS applies)
        - httpFetch adapter → guarded fetch (allowlist, https, timeout, size cap)
        - walks steps, evaluates expressions, records a trace
   6. Audit: unless dryRun, insert a rater_runs row (service role) and bump
      raters.last_run_at. Failed runs are audited too.
   ▼
Response: { outputs, trace, durationMs }   (step errors return 422 WITH the
                                            partial trace, so the UI can show
                                            where it stopped)
```

Request/response contract:

```
POST /functions/v1/run-rater
Request:  { raterId? | definition?  (exactly one);
            inputs: Record<string, unknown>;
            sourceRecord?: { table, id };   // provenance when pre-filled
            dryRun?: boolean }              // true → no audit row / last_run_at bump
Success:  { outputs, trace, durationMs }
Failure:  { error: { code, message, stepId? } }  (400 | 404 | 422)
          // step_error also includes { outputs, trace } captured so far
```

On the run page the response drives three things: **output cards** (formatted
per `format`), the **step trace** (status + value + detail per step), and the
**diagram** with the executed path highlighted. Each run is also appended to the
**Recent runs** list; opening one re-renders it against _that run's_ stored
`definition_snapshot`, so historical runs display correctly even after the rater
is edited.

> **Not yet wired in:** raters are invoked manually; they are not (yet) an
> automatic pricing step inside the submission/policy workflow. Record pre-fill
> (below) is the groundwork for that. See
> [Planned: submission integration](#planned-submission-integration).

## Data model

`20260708150000_raters.sql`:

**`raters`**
| Column | Notes |
|---|---|
| `id` | uuid pk |
| `name`, `description` | |
| `definition` | jsonb — the full DSL document (`schema_version`, `inputs`, `steps`) |
| `record_mapping` | jsonb — `{ table, mappings: [{input, column}] }` or null |
| `created_by`, `created_at`, `updated_at`, `last_run_at`, `archived_at` | audit |

**`rater_runs`** (append-only; written only by the edge function)
| Column | Notes |
|---|---|
| `id` | bigint identity |
| `rater_id`, `user_id` | |
| `inputs` | jsonb — coerced input values |
| `outputs` | jsonb — `{ id: { label, value, format } }` (raw values) |
| `outcome` | jsonb — `{ decision, reason, stepId, label? }` when a decision fired, else null (migration `20260709130000_rater_runs_outcome.sql`) |
| `definition_snapshot` | jsonb — the exact definition that executed |
| `trace` | jsonb — per-step results |
| `source_record` | jsonb — `{ table, id }` when pre-filled |
| `duration_ms`, `error`, `created_at` | |

**Versioning (v1 → future).** There is one mutable `definition` per rater, but
every run snapshots what it executed. That's the whole v1 versioning story. The
path to full draft→published versions is mechanical and non-breaking: add a
`rater_versions(rater_id, version, definition, published_at/by)` table, backfill
`insert … select id, 1, definition from raters`, and add
`draft_definition`/`current_version_id`. `run-rater` resolves "the definition to
execute" in one place, so version selection swaps in there.

## Permissions

RLS via the existing `authorize('<resource>','read'|'write')` helper and
`role_permissions` seeds:

- `raters`: **read** for all four roles; **write** for admin + underwriter
  (accounting and viewer can run but not create/edit).
- `rater_runs`: **read** for all four roles (runs history is a user-facing
  feature on the detail page — a deliberate departure from the admin-only
  `report_runs`); no client writes (the edge function writes as service role).

Service-role object grants (`insert` on `rater_runs`, `select, update` on
`raters`) are in the migration — see the lesson in
[TABLE_IMPLEMENTATION_NOTES.md](TABLE_IMPLEMENTATION_NOTES.md).

## Validation

Two layers, both run before save and again server-side before execution
(fail-closed):

1. **Zod** (`schema.ts`) — per-step shape, enums, and structural caps.
2. **Static analysis** (`validate.ts`) — cross-step checks Zod can't see:
   - every referenced binding exists and is declared **earlier** (no forward
     refs; unknown names are errors);
   - `inputs.<name>` refers to a declared input;
   - step ids are unique **per execution path** (sibling branch cases may reuse
     an id — the natural way to set `state_factor` differently per case);
   - a binding assigned on only _some_ branch paths is a **warning** (running a
     path that skips it fails at run time);
   - at least one **output** must run on every path;
   - reserved names (`inputs`, function names, keywords) are rejected.

The builder surfaces errors (blocking) and warnings (non-blocking) live, and
flags the offending step cards.

## Record pre-fill

A rater may declare a `record_mapping`: a source table plus per-input column
mappings. On the run page, a record picker lets the user choose a source row
(e.g. a `new_business_submissions` record); the mapped columns pre-fill the
matching inputs (values remain editable), and `sourceRecord` rides along in the
run payload for provenance. Source tables and their search/label columns are
configured client-side in `src/lib/raterPickers.ts`.

## The diagram

`definitionToFlow()` (`diagram/flowGraph.ts`) is a **pure** function that turns a
definition (and optionally a run trace) into React Flow nodes/edges; dagre lays
it out top-to-bottom. It's read-only. With a trace, the executed path is
full-color with value badges, untaken branch cases dim, and a failing step turns
red. Because it derives purely from the JSON, a future canvas editor or
conversational builder can reuse it unchanged.

## Testing

- **Interpreter / DSL** (Deno): `cd supabase/functions/_shared && deno test rater/`
  — parser precedence and errors, lookup exact/range/onMiss, branch selection,
  per-path duplicate-id rules, the worked example ($16,100), coercion, and static
  validation.
- **Diagram derivation** (vitest): `pnpm test` — `flowGraph.test.ts` covers node/
  edge derivation, branch fan-out, and trace highlighting/dimming.
- **Edge function** (local): `supabase functions serve run-rater --env-file
supabase/functions/.env`, then curl with a signed-in user's JWT (dry run,
  saved run + audit-row check, missing-input 422, invalid-definition 422,
  non-allowlisted host → step error).

Note: `vite.config.ts` excludes `supabase/**` from vitest — those are Deno tests.

## Configuration

- **External API fetch steps are disabled** until `RATER_HTTP_ALLOWLIST` is set
  as an edge-function secret: a comma-separated list of allowed host suffixes
  (e.g. `api.coingecko.com,api.example.com`). Fetches are https-only, block
  private/loopback hosts, time out (≤ 10s), and cap the response at 1 MB.
- The `run-rater` function needs a `[functions.run-rater]` entry in
  `supabase/config.toml` for deployment (mirrors `run-report`).

## Limits

Enforced by the schema to keep runs fast and bounded: ≤ 100 steps, ≤ 24 inputs,
≤ 500 lookup rows, ≤ 12 lookup columns, ≤ 10 fetch steps, expression length
≤ 2000, branch nesting depth ≤ 3, ≤ 12 branch cases, http timeout ≤ 10s.

---

## Record binding & applicability

A rater's `record_mapping` is a **record binding**: it declares which table the
rater *applies to*, optionally narrows that with **match conditions** on the
table's own columns, and optionally maps columns onto inputs for pre-fill. This
answers "which raters apply to this record?" — e.g. one rater for
`new_business_submissions` where `line_of_business ilike Cyber` and a different
one for `Property`, or a carrier-specific rater keyed on `carrier_id`.

- Shape (`supabase/functions/_shared/rater/schema.ts`): `{ table, conditions?,
  mappings? }`. `conditions` is `[{ column, op, value }]` reusing the db-fetch
  operator set (`DB_FILTER_OPS`); an empty/absent `conditions` means the rater
  applies to *every* row of `table`. `mappings` is optional so a rater can be
  applicable without pre-filling anything.
- Config: the **Applies to** section of the builder
  (`RecordMappingEditor.tsx`) — table select, a generic condition editor driven
  by that table's columns (from the `TABLES` registry), and the pre-fill map.
- Resolve: `src/lib/raterMatching.ts` — `fetchMatchingRaters(table, row)`
  filters on `record_mapping->>table` server-side, then evaluates conditions
  client-side against the row, returning **all** matches (the consumer decides
  how to present several). Matching value coercion is driven by each column's
  kind.
- Consuming surface: the **Rate** action (`RateActionButton`) on the
  `new_business_submissions` rows of the workflow view loads the full record,
  lists the matching raters in a menu, and opens the chosen one in a drawer
  (`RaterRunDrawer` → `EntityDrawer`: side sheet on desktop, bottom on mobile).
  The run UI itself is `RaterRunPanel`, shared with the rater detail page; it
  pre-fills from the record via `record_mapping` and tags the run's
  `sourceRecord` for audit.

## Planned: submission integration

Raters today are standalone. The natural next step is to make a rater an
**automatic pricing step** in the underwriting workflow — e.g. a "Rate this
submission" action on a `new_business_submissions` record that runs a designated
rater and writes the outputs back onto the record (annual premium, factors,
etc.). The record-mapping feature already supplies the inputs side of that; the
missing half is an **outputs → columns** mapping and a place to invoke it. A
short design for this lives alongside this doc — see the roadmap entry.

## Discuss

- add helpers
  - "use single quotes in output text" or general guidance on combining string text with variables (how does templating strings work?)
- ~~need more specificity for which rater is used for which types of records. For example, new_business_submission may use one rater for cyber line_of_business and a different one for property; or different raters depending on the carrier, etc.~~ → implemented; see **Record binding & applicability** above.
