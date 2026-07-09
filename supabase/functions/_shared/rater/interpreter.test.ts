import { assertEquals, assertExists } from 'jsr:@std/assert@1';
import { coerceInputValues } from './coerce.ts';
import { executeRater, type RaterAdapters } from './interpreter.ts';
import {
  type RaterDefinition,
  raterDefinitionSchema,
} from './schema.ts';
import { validateRaterDefinition } from './validate.ts';

const noDb: RaterAdapters = {
  dbFetch: () => Promise.reject(new Error('no db in this test')),
};

// The worked example from the plan: crypto-custody premium rater.
const custodyRater: RaterDefinition = {
  schema_version: 1,
  inputs: [
    { name: 'asset_value', label: 'Assets under custody (USD)', type: 'number', required: true },
    {
      name: 'custody_type',
      label: 'Custody type',
      type: 'select',
      required: true,
      options: [
        { value: 'cold', label: 'Cold storage' },
        { value: 'warm', label: 'Warm wallet' },
        { value: 'hot', label: 'Hot wallet' },
      ],
    },
    { name: 'state', label: 'Home state', type: 'text', required: true },
  ],
  steps: [
    {
      id: 'base_rate',
      type: 'lookup',
      label: 'Base rate by custody type',
      columns: [
        { name: 'custody_type', type: 'text' },
        { name: 'rate', type: 'number' },
      ],
      rows: [
        ['cold', 0.0008],
        ['warm', 0.0015],
        ['hot', 0.003],
      ],
      match: [{ mode: 'exact', column: 'custody_type', value: 'inputs.custody_type' }],
      onMiss: 'error',
    },
    {
      id: 'size_factor',
      type: 'lookup',
      label: 'Size factor (range bands)',
      columns: [
        { name: 'min_value', type: 'number' },
        { name: 'max_value', type: 'number' },
        { name: 'factor', type: 'number' },
      ],
      rows: [
        [0, 1000000, 1.0],
        [1000000, 10000000, 0.85],
        [10000000, 50000000, 0.7],
        [50000000, null, 0.55],
      ],
      match: [
        {
          mode: 'range',
          minColumn: 'min_value',
          maxColumn: 'max_value',
          value: 'inputs.asset_value',
          minInclusive: true,
          maxInclusive: false,
        },
      ],
      onMiss: 'error',
    },
    {
      id: 'sl_rule',
      type: 'fetch',
      source: 'db',
      label: 'Surplus-lines state rule',
      table: 'surplus_lines_state_rules',
      select: ['entity_license_accepted'],
      filters: [{ column: 'state', op: 'eq', value: 'upper(inputs.state)' }],
      mode: 'maybe',
      onEmpty: 'null',
    },
    {
      id: 'state_adjustment',
      type: 'branch',
      label: 'State surcharge',
      cases: [
        {
          label: 'NY surcharge',
          when: "upper(inputs.state) == 'NY'",
          steps: [{ id: 'state_factor', type: 'calc', expr: '1.15' }],
        },
        {
          label: 'No entity license accepted',
          when: 'sl_rule != null and sl_rule.entity_license_accepted == false',
          steps: [{ id: 'state_factor', type: 'calc', expr: '1.05' }],
        },
      ],
      else: [{ id: 'state_factor', type: 'calc', expr: '1.0' }],
    },
    {
      id: 'raw_premium',
      type: 'calc',
      label: 'Raw premium',
      expr: 'inputs.asset_value * base_rate.rate * size_factor.factor * state_factor',
    },
    {
      id: 'premium',
      type: 'calc',
      label: 'Apply $2,500 minimum',
      expr: 'max(round(raw_premium, 2), 2500)',
    },
    {
      id: 'annual_premium',
      type: 'output',
      label: 'Annual premium',
      expr: 'premium',
      format: 'money',
    },
    {
      id: 'effective_rate',
      type: 'output',
      label: 'Effective rate',
      expr: 'premium / inputs.asset_value',
      format: 'percent',
    },
  ],
};

const custodyDb: RaterAdapters = {
  dbFetch: (q) => {
    assertEquals(q.table, 'surplus_lines_state_rules');
    const state = q.filters[0]?.value;
    if (state === 'NY' || state === 'CA') {
      return Promise.resolve([{ entity_license_accepted: state === 'NY' }]);
    }
    return Promise.resolve([]);
  },
};

Deno.test('worked example passes zod + static validation', () => {
  const parsed = raterDefinitionSchema.safeParse(custodyRater);
  assertEquals(parsed.success, true, JSON.stringify(parsed.error?.issues));
  const { errors, warnings } = validateRaterDefinition(custodyRater);
  assertEquals(errors, []);
  assertEquals(warnings, []);
});

Deno.test('worked example: NY cold 25M → $16,100', async () => {
  const coerced = coerceInputValues(custodyRater.inputs, {
    asset_value: 25000000,
    custody_type: 'cold',
    state: 'NY',
  });
  assertEquals(coerced.ok, true);
  if (!coerced.ok) return;

  const result = await executeRater(custodyRater, coerced.values, custodyDb);
  assertEquals(result.error, null);
  assertEquals(result.outputs.annual_premium.value, 16100);
  assertEquals(result.outputs.annual_premium.format, 'money');
  assertEquals(result.outputs.effective_rate.value, 16100 / 25000000);

  const byId = new Map(result.trace.steps.map((s) => [`${s.id}:${s.status}`, s]));
  assertExists(byId.get('base_rate:ok'));
  assertEquals(byId.get('base_rate:ok')?.detail?.matchedRowIndex, 0);
  assertEquals(byId.get('size_factor:ok')?.detail?.matchedRowIndex, 2);
  assertEquals(byId.get('state_adjustment:ok')?.detail?.caseTaken, 0);
  // the untaken case's inner step + else's inner step are recorded skipped
  const skipped = result.trace.steps.filter(
    (s) => s.id === 'state_factor' && s.status === 'skipped',
  );
  assertEquals(skipped.length, 2);
});

Deno.test('worked example: TX warm 500k → minimum premium, else path', async () => {
  const result = await executeRater(
    custodyRater,
    { asset_value: 500000, custody_type: 'warm', state: 'TX' },
    custodyDb,
  );
  assertEquals(result.error, null);
  // 500000 * 0.0015 * 1.0 * 1.0 = 750 → floored to 2500
  assertEquals(result.outputs.annual_premium.value, 2500);
  const branch = result.trace.steps.find((s) => s.id === 'state_adjustment');
  assertEquals(branch?.detail?.caseTaken, 'else');
});

Deno.test('worked example: CA falls through NY case into license case', async () => {
  const result = await executeRater(
    custodyRater,
    { asset_value: 25000000, custody_type: 'cold', state: 'ca' },
    custodyDb,
  );
  assertEquals(result.error, null);
  const branch = result.trace.steps.find((s) => s.id === 'state_adjustment');
  assertEquals(branch?.detail?.caseTaken, 1);
  // 25M * 0.0008 * 0.7 * 1.05 = 14700
  assertEquals(result.outputs.annual_premium.value, 14700);
});

Deno.test('lookup: onMiss error names the probes; onMiss default uses defaultRow', async () => {
  const miss: RaterDefinition = {
    schema_version: 1,
    inputs: [],
    steps: [
      {
        id: 'factor',
        type: 'lookup',
        columns: [
          { name: 'key', type: 'text' },
          { name: 'value', type: 'number' },
        ],
        rows: [['a', 1]],
        match: [{ mode: 'exact', column: 'key', value: "'zzz'" }],
        onMiss: 'error',
      },
      { id: 'out', type: 'output', label: 'Out', expr: 'factor.value', format: 'number' },
    ],
  };
  const failed = await executeRater(miss, {}, noDb);
  assertEquals(failed.error?.stepId, 'factor');
  assertEquals(failed.trace.steps.map((s) => s.status), ['error', 'skipped']);

  const missLookup = miss.steps[0] as Extract<RaterDefinition['steps'][number], { type: 'lookup' }>;
  const withDefault: RaterDefinition = {
    ...miss,
    steps: [
      { ...missLookup, onMiss: 'default', defaultRow: { value: 9 } },
      miss.steps[1],
    ],
  };
  const ok = await executeRater(withDefault, {}, noDb);
  assertEquals(ok.error, null);
  assertEquals(ok.outputs.out.value, 9);
  assertEquals(ok.trace.steps[0].detail?.usedDefault, true);
});

Deno.test('lookup: range bands respect inclusivity and open ends', async () => {
  const banded = (value: number): RaterDefinition => ({
    schema_version: 1,
    inputs: [],
    steps: [
      { id: 'v', type: 'calc', expr: String(value) },
      {
        id: 'band',
        type: 'lookup',
        columns: [
          { name: 'lo', type: 'number' },
          { name: 'hi', type: 'number' },
          { name: 'f', type: 'number' },
        ],
        rows: [
          [null, 100, 1],
          [100, 200, 2],
          [200, null, 3],
        ],
        match: [
          {
            mode: 'range',
            minColumn: 'lo',
            maxColumn: 'hi',
            value: 'v',
            minInclusive: true,
            maxInclusive: false,
          },
        ],
        onMiss: 'error',
      },
      { id: 'out', type: 'output', label: 'Out', expr: 'band.f', format: 'number' },
    ],
  });
  assertEquals((await executeRater(banded(-50), {}, noDb)).outputs.out.value, 1);
  assertEquals((await executeRater(banded(100), {}, noDb)).outputs.out.value, 2); // min inclusive
  assertEquals((await executeRater(banded(199.99), {}, noDb)).outputs.out.value, 2); // max exclusive
  assertEquals((await executeRater(banded(200), {}, noDb)).outputs.out.value, 3);
  assertEquals((await executeRater(banded(99999), {}, noDb)).outputs.out.value, 3); // open end
});

Deno.test('db fetch: single mode errors on 0 and >1 rows', async () => {
  const def = (mode: 'single' | 'maybe'): RaterDefinition => ({
    schema_version: 1,
    inputs: [],
    steps: [
      {
        id: 'row',
        type: 'fetch',
        source: 'db',
        table: 't',
        select: ['a'],
        filters: [],
        mode,
        onEmpty: 'null',
      } as never,
      { id: 'out', type: 'output', label: 'Out', expr: 'row == null ? -1 : row.a', format: 'number' },
    ],
  });

  const rows = (n: number): RaterAdapters => ({
    dbFetch: () => Promise.resolve(Array.from({ length: n }, (_, i) => ({ a: i }))),
  });

  assertEquals((await executeRater(def('single'), {}, rows(0))).error?.stepId, 'row');
  assertEquals((await executeRater(def('single'), {}, rows(2))).error?.stepId, 'row');
  assertEquals((await executeRater(def('single'), {}, rows(1))).outputs.out.value, 0);
  assertEquals((await executeRater(def('maybe'), {}, rows(0))).outputs.out.value, -1);
});

Deno.test('http fetch: extracts dot paths; missing adapter fails cleanly', async () => {
  const def: RaterDefinition = {
    schema_version: 1,
    inputs: [{ name: 'symbol', label: 'Symbol', type: 'text', required: true }],
    steps: [
      {
        id: 'price',
        type: 'fetch',
        source: 'http',
        method: 'GET',
        url: 'https://api.example.com/v1/price/{{inputs.symbol}}',
        query: { currency: "'USD'" },
        extract: [{ name: 'usd', path: 'data.rates.USD' }],
        timeoutMs: 5000,
      } as never,
      { id: 'out', type: 'output', label: 'Out', expr: 'price.usd * 2', format: 'number' },
    ],
  };

  let requestedUrl = '';
  const http: RaterAdapters = {
    dbFetch: () => Promise.reject(new Error('unused')),
    httpFetch: (r) => {
      requestedUrl = r.url;
      return Promise.resolve({ data: { rates: { USD: 21.5 } } });
    },
  };

  const ok = await executeRater(def, { symbol: 'BTC/X' }, http);
  assertEquals(ok.error, null);
  assertEquals(requestedUrl, 'https://api.example.com/v1/price/BTC%2FX?currency=USD');
  assertEquals(ok.outputs.out.value, 43);

  const serverless = await executeRater(def, { symbol: 'BTC' }, noDb);
  assertEquals(serverless.error?.stepId, 'price');
  assertEquals(
    serverless.error?.message.includes('only run on the server'),
    true,
  );
});

Deno.test('error halts the run: later steps skipped, error names the step', async () => {
  const def: RaterDefinition = {
    schema_version: 1,
    inputs: [],
    steps: [
      { id: 'a', type: 'calc', expr: '1' },
      { id: 'b', type: 'calc', expr: 'a / 0' },
      { id: 'c', type: 'calc', expr: '3' },
      { id: 'out', type: 'output', label: 'Out', expr: 'c', format: 'number' },
    ],
  };
  const result = await executeRater(def, {}, noDb);
  assertEquals(result.error?.stepId, 'b');
  assertEquals(
    result.trace.steps.map((s) => `${s.id}:${s.status}`),
    ['a:ok', 'b:error', 'c:skipped', 'out:skipped'],
  );
});

Deno.test('coerceInputValues: defaults, required, type coercion', () => {
  const inputs: RaterDefinition['inputs'] = [
    { name: 'n', label: 'N', type: 'number', required: true },
    { name: 's', label: 'S', type: 'text', required: false, default: 'dflt' },
    { name: 'b', label: 'B', type: 'boolean', required: false },
  ];
  const ok = coerceInputValues(inputs, { n: '42', b: 'true' });
  assertEquals(ok, { ok: true, values: { n: 42, s: 'dflt', b: true } });

  const missing = coerceInputValues(inputs, {});
  assertEquals(missing.ok, false);
  if (!missing.ok) assertEquals(missing.code, 'missing_input');

  const invalid = coerceInputValues(inputs, { n: 'abc' });
  assertEquals(invalid.ok, false);
  if (!invalid.ok) assertEquals(invalid.code, 'invalid_input');
});

// --- static validation ---------------------------------------------------------

Deno.test('validate: forward references and unknown names are errors', () => {
  const def: RaterDefinition = {
    schema_version: 1,
    inputs: [],
    steps: [
      { id: 'a', type: 'calc', expr: 'b + 1' },
      { id: 'b', type: 'calc', expr: '2' },
      { id: 'out', type: 'output', label: 'Out', expr: 'b', format: 'number' },
    ],
  };
  const { errors } = validateRaterDefinition(def);
  assertEquals(errors.length, 1);
  assertEquals(errors[0].stepId, 'a');
  assertEquals(errors[0].message.includes("unknown name 'b'"), true);
});

Deno.test('validate: unknown input reference is an error', () => {
  const def: RaterDefinition = {
    schema_version: 1,
    inputs: [{ name: 'x', label: 'X', type: 'number', required: true }],
    steps: [{ id: 'out', type: 'output', label: 'Out', expr: 'inputs.y', format: 'number' }],
  };
  const { errors } = validateRaterDefinition(def);
  assertEquals(errors[0].message.includes("unknown input 'y'"), true);
});

Deno.test('validate: duplicate id on one path errors; across sibling cases is fine', () => {
  const acrossCases: RaterDefinition = {
    schema_version: 1,
    inputs: [{ name: 'x', label: 'X', type: 'number', required: true }],
    steps: [
      {
        id: 'br',
        type: 'branch',
        cases: [
          { label: 'a', when: 'inputs.x > 0', steps: [{ id: 'f', type: 'calc', expr: '1' }] },
          { label: 'b', when: 'inputs.x < 0', steps: [{ id: 'f', type: 'calc', expr: '2' }] },
        ],
        else: [{ id: 'f', type: 'calc', expr: '0' }],
      },
      { id: 'out', type: 'output', label: 'Out', expr: 'f', format: 'number' },
    ],
  };
  assertEquals(validateRaterDefinition(acrossCases).errors, []);
  assertEquals(validateRaterDefinition(acrossCases).warnings, []);

  const samePath: RaterDefinition = {
    schema_version: 1,
    inputs: [],
    steps: [
      { id: 'f', type: 'calc', expr: '1' },
      { id: 'f', type: 'calc', expr: '2' },
      { id: 'out', type: 'output', label: 'Out', expr: 'f', format: 'number' },
    ],
  };
  const { errors } = validateRaterDefinition(samePath);
  assertEquals(errors.some((e) => e.message.includes('duplicate step id')), true);
});

Deno.test('validate: binding set on only some paths warns', () => {
  const def: RaterDefinition = {
    schema_version: 1,
    inputs: [{ name: 'x', label: 'X', type: 'number', required: true }],
    steps: [
      {
        id: 'br',
        type: 'branch',
        cases: [
          { label: 'pos', when: 'inputs.x > 0', steps: [{ id: 'f', type: 'calc', expr: '1' }] },
        ],
        // no else assigning f
      },
      { id: 'out', type: 'output', label: 'Out', expr: 'f', format: 'number' },
    ],
  };
  const { errors, warnings } = validateRaterDefinition(def);
  assertEquals(errors, []);
  assertEquals(warnings.length, 1);
  assertEquals(warnings[0].message.includes('only set on some branch paths'), true);
});

Deno.test('validate: output required on every path', () => {
  const onlyInBranch: RaterDefinition = {
    schema_version: 1,
    inputs: [{ name: 'x', label: 'X', type: 'number', required: true }],
    steps: [
      {
        id: 'br',
        type: 'branch',
        cases: [
          {
            label: 'pos',
            when: 'inputs.x > 0',
            steps: [{ id: 'out', type: 'output', label: 'Out', expr: '1', format: 'number' }],
          },
        ],
      },
    ],
  };
  const { errors } = validateRaterDefinition(onlyInBranch);
  assertEquals(
    errors.some((e) => e.message.includes('every path must end in an output')),
    true,
  );
});

Deno.test('validate: reserved names rejected', () => {
  const def: RaterDefinition = {
    schema_version: 1,
    inputs: [],
    steps: [
      { id: 'round', type: 'calc', expr: '1' },
      { id: 'out', type: 'output', label: 'Out', expr: 'round', format: 'number' },
    ],
  };
  const { errors } = validateRaterDefinition(def);
  assertEquals(errors.some((e) => e.message.includes('reserved name')), true);
});

// --- decision (terminal) steps -------------------------------------------------

Deno.test('decision: conditional knock-out fires and halts with an outcome', async () => {
  const def: RaterDefinition = {
    schema_version: 1,
    inputs: [{ name: 'score', label: 'Score', type: 'number', required: true }],
    steps: [
      {
        id: 'decline_low_score',
        type: 'decision',
        outcome: 'decline',
        label: 'Score too low',
        when: 'inputs.score < 600',
        reason: "concat('Score ', string(inputs.score), ' below 600')",
      },
      { id: 'premium', type: 'calc', expr: 'inputs.score * 10' },
      { id: 'out', type: 'output', label: 'Premium', expr: 'premium', format: 'money' },
    ],
  };

  assertEquals(validateRaterDefinition(def).errors, []);

  const declined = await executeRater(def, { score: 500 }, noDb);
  assertEquals(declined.error, null);
  assertEquals(declined.outcome?.decision, 'decline');
  assertEquals(declined.outcome?.reason, 'Score 500 below 600');
  assertEquals(declined.outcome?.stepId, 'decline_low_score');
  assertEquals(Object.keys(declined.outputs), []); // premium never computed
  assertEquals(
    declined.trace.steps.map((s) => `${s.id}:${s.status}`),
    ['decline_low_score:ok', 'premium:skipped', 'out:skipped'],
  );

  // above the threshold, the decision falls through to normal rating
  const quoted = await executeRater(def, { score: 720 }, noDb);
  assertEquals(quoted.outcome, null);
  assertEquals(quoted.outputs.out.value, 7200);
  const gate = quoted.trace.steps.find((s) => s.id === 'decline_low_score');
  assertEquals(gate?.detail?.fired, false);
});

Deno.test('decision: unconditional decision is a terminal (no output needed)', () => {
  const def: RaterDefinition = {
    schema_version: 1,
    inputs: [],
    steps: [{ id: 'refer', type: 'decision', outcome: 'refer', label: 'Manual review' }],
  };
  // Validates without any output step — the decision terminates every path.
  assertEquals(validateRaterDefinition(def).errors, []);
});

Deno.test('decision: unconditional decision inside a branch case halts the whole run', async () => {
  const def: RaterDefinition = {
    schema_version: 1,
    inputs: [{ name: 'state', label: 'State', type: 'text', required: true }],
    steps: [
      {
        id: 'gate',
        type: 'branch',
        cases: [
          {
            label: 'Excluded state',
            when: "upper(inputs.state) == 'FL'",
            steps: [
              { id: 'decline', type: 'decision', outcome: 'decline', reason: "'State not written'" },
            ],
          },
        ],
        else: [{ id: 'base', type: 'calc', expr: '100' }],
      },
      { id: 'premium', type: 'calc', expr: 'base * 2' },
      { id: 'out', type: 'output', label: 'Premium', expr: 'premium', format: 'money' },
    ],
  };

  // 'base' is only set on the else path → referencing it after the branch warns,
  // but doesn't block (the FL path halts before reaching it).
  assertEquals(validateRaterDefinition(def).errors, []);

  const declined = await executeRater(def, { state: 'FL' }, noDb);
  assertEquals(declined.outcome?.decision, 'decline');
  assertEquals(declined.error, null);
  // steps after the fired decision — across the branch boundary — are skipped
  assertEquals(
    declined.trace.steps
      .filter((s) => ['premium', 'out'].includes(s.id))
      .map((s) => s.status),
    ['skipped', 'skipped'],
  );

  const quoted = await executeRater(def, { state: 'TX' }, noDb);
  assertEquals(quoted.outcome, null);
  assertEquals(quoted.outputs.out.value, 200);
});

Deno.test('validate: a conditional-only decision does not guarantee a result', () => {
  const def: RaterDefinition = {
    schema_version: 1,
    inputs: [{ name: 'x', label: 'X', type: 'number', required: true }],
    steps: [
      { id: 'maybe_decline', type: 'decision', outcome: 'decline', when: 'inputs.x < 0' },
      // no output and no unconditional terminal → invalid
    ],
  };
  const { errors } = validateRaterDefinition(def);
  assertEquals(
    errors.some((e) => e.message.includes('every path must end in an output')),
    true,
  );
});

Deno.test('validate: steps after an unconditional decision warn as unreachable', () => {
  const def: RaterDefinition = {
    schema_version: 1,
    inputs: [],
    steps: [
      { id: 'decline', type: 'decision', outcome: 'decline' },
      { id: 'dead', type: 'calc', expr: '1' },
    ],
  };
  const { errors, warnings } = validateRaterDefinition(def);
  assertEquals(errors, []);
  assertEquals(warnings.some((w) => w.message.includes('unreachable')), true);
});
