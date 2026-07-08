import { assertEquals } from 'jsr:@std/assert@1';
import {
  coerceParamValues,
  compileNamedPlaceholders,
  crossCheckParams,
  extractPlaceholderNames,
  type ReportParam,
} from './reportParams.ts';

Deno.test('compile: basic replacement in first-appearance order', () => {
  const { sql, order } = compileNamedPlaceholders(
    'select * from t where a >= {{start_date}}::date and b = {{carrier_id}}::bigint',
  );
  assertEquals(
    sql,
    'select * from t where a >= $1::date and b = $2::bigint',
  );
  assertEquals(order, ['start_date', 'carrier_id']);
});

Deno.test('compile: repeated placeholder reuses the same index', () => {
  const { sql, order } = compileNamedPlaceholders(
    'select * from t where ({{carrier_id}}::bigint is null or c = {{carrier_id}}::bigint) and d = {{status}}',
  );
  assertEquals(
    sql,
    'select * from t where ($1::bigint is null or c = $1::bigint) and d = $2',
  );
  assertEquals(order, ['carrier_id', 'status']);
});

Deno.test('compile: placeholders inside literals and comments are untouched', () => {
  const input = [
    "select '{{not_a_param}}' as lit,",
    '  "{{quoted_ident}}" as col, -- {{line_comment}}',
    '  /* {{block}} /* {{nested}} */ */',
    '  $tag$ {{dollar}} $tag$ as dq,',
    "  'it''s {{escaped}}' as esc,",
    '  {{real_param}}::int as p',
    'from t',
  ].join('\n');
  const { sql, order } = compileNamedPlaceholders(input);
  assertEquals(order, ['real_param']);
  assertEquals(sql, input.replace('{{real_param}}', '$1'));
});

Deno.test('compile: malformed placeholders pass through unchanged', () => {
  const input = 'select {{ spaced }}, {{UpperCase}}, {single} from t';
  const { sql, order } = compileNamedPlaceholders(input);
  assertEquals(sql, input);
  assertEquals(order, []);
});

Deno.test('compile: existing positional params are not mistaken for dollar quotes', () => {
  const input = 'select $1::int, {{p}}::int from t';
  const { sql, order } = compileNamedPlaceholders(input);
  assertEquals(sql, 'select $1::int, $1::int from t');
  assertEquals(order, ['p']);
});

const params: ReportParam[] = [
  {
    name: 'start_date',
    label: 'Start Date',
    type: 'date',
    required: true,
    default: null,
  },
  {
    name: 'carrier_id',
    label: 'Carrier',
    type: 'entity',
    required: false,
    default: null,
    entity: { table: 'carriers' },
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    required: false,
    default: 'open',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ],
  },
];

Deno.test('coerce: valid values, defaults, and optional NULL', () => {
  const res = coerceParamValues(params, {
    start_date: '2026-01-01',
    carrier_id: '',
  });
  assertEquals(res, {
    ok: true,
    values: { start_date: '2026-01-01', carrier_id: null, status: 'open' },
  });
});

Deno.test('coerce: missing required param', () => {
  const res = coerceParamValues(params, {});
  assertEquals(res.ok, false);
  if (!res.ok) assertEquals(res.code, 'missing_param');
});

Deno.test('coerce: bad date, bad entity id, unknown select value', () => {
  for (const provided of [
    { start_date: '01/01/2026' },
    { start_date: '2026-01-01', carrier_id: 'abc' },
    { start_date: '2026-01-01', status: 'nope' },
  ]) {
    const res = coerceParamValues(params, provided);
    assertEquals(res.ok, false);
    if (!res.ok) assertEquals(res.code, 'invalid_param');
  }
});

Deno.test('coerce: numeric strings for entity/number', () => {
  const res = coerceParamValues(params, {
    start_date: '2026-01-01',
    carrier_id: '42',
  });
  assertEquals(res.ok, true);
  if (res.ok) assertEquals(res.values.carrier_id, 42);
});

Deno.test('crossCheck: consistent SQL and params', () => {
  const sql =
    'select * from t where d >= {{start_date}}::date and ({{carrier_id}}::bigint is null or c = {{carrier_id}}) and s = {{status}}';
  assertEquals(crossCheckParams(sql, params), null);
});

Deno.test('crossCheck: undeclared placeholder and unused param', () => {
  assertEquals(
    crossCheckParams('select {{mystery}} from t', params) !== null,
    true,
  );
  assertEquals(
    crossCheckParams('select 1 from t', [params[0]]) !== null,
    true,
  );
});

Deno.test('extractPlaceholderNames skips literals', () => {
  assertEquals(
    extractPlaceholderNames("select '{{a}}', {{b}} from t"),
    ['b'],
  );
});
