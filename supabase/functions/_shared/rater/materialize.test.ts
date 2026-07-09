import { assertEquals } from 'jsr:@std/assert@1';
import {
  type LookupTableResolver,
  materializeLookupTables,
} from './materialize.ts';
import { executeRater, type RaterAdapters } from './interpreter.ts';
import type { LookupTableContent, RaterDefinition } from './schema.ts';

const noDb: RaterAdapters = {
  dbFetch: () => Promise.reject(new Error('no db in this test')),
};

const TABLE_ID = '11111111-1111-1111-1111-111111111111';

const baseRateTable: LookupTableContent = {
  columns: [
    { name: 'custody_type', type: 'text' },
    { name: 'rate', type: 'number' },
  ],
  rows: [
    ['cold', 0.0008],
    ['warm', 0.0015],
  ],
};

// A rater whose only lookup references a shared table by id.
const refRater = (tableId: string): RaterDefinition => ({
  schema_version: 1,
  inputs: [
    {
      name: 'custody_type',
      label: 'Custody type',
      type: 'text',
      required: true,
    },
  ],
  steps: [
    {
      id: 'base_rate',
      type: 'lookup',
      source: 'ref',
      tableId,
      match: [{ mode: 'exact', column: 'custody_type', value: 'inputs.custody_type' }],
      onMiss: 'error',
    },
    {
      id: 'premium',
      type: 'output',
      label: 'Rate',
      expr: 'base_rate.rate',
      format: 'number',
    },
  ],
});

const resolverFor = (
  tables: Record<string, LookupTableContent>,
): LookupTableResolver => {
  return (id) => Promise.resolve(tables[id] ?? null);
};

Deno.test('materialize: ref lookup becomes an inline grid and runs', async () => {
  const { definition, errors } = await materializeLookupTables(
    refRater(TABLE_ID),
    resolverFor({ [TABLE_ID]: baseRateTable }),
  );
  assertEquals(errors, []);

  const lookup = definition.steps[0];
  assertEquals(lookup.type === 'lookup' && lookup.source, 'inline');
  assertEquals(
    lookup.type === 'lookup' && lookup.source === 'inline' ? lookup.rows.length : -1,
    2,
  );

  const result = await executeRater(definition, { custody_type: 'warm' }, noDb);
  assertEquals(result.error, null);
  assertEquals(result.outputs.premium.value, 0.0015);
});

Deno.test('materialize: missing/inaccessible table is an error', async () => {
  const { errors } = await materializeLookupTables(
    refRater(TABLE_ID),
    resolverFor({}), // resolver finds nothing
  );
  assertEquals(errors.length, 1);
  assertEquals(errors[0].stepId, 'base_rate');
});

Deno.test('materialize: match column absent from the resolved table errors', async () => {
  const table: LookupTableContent = {
    columns: [{ name: 'other', type: 'text' }],
    rows: [['x']],
  };
  const { errors } = await materializeLookupTables(
    refRater(TABLE_ID),
    resolverFor({ [TABLE_ID]: table }),
  );
  assertEquals(errors.length, 1);
  assertEquals(errors[0].stepId, 'base_rate');
});

Deno.test('materialize: definitions without refs pass through untouched', async () => {
  const inlineRater: RaterDefinition = {
    schema_version: 1,
    inputs: [],
    steps: [
      { id: 'x', type: 'calc', expr: '1 + 1' },
      { id: 'out', type: 'output', label: 'X', expr: 'x', format: 'number' },
    ],
  };
  const { definition, errors } = await materializeLookupTables(
    inlineRater,
    resolverFor({}),
  );
  assertEquals(errors, []);
  assertEquals(definition, inlineRater); // same reference — no walk needed
});

Deno.test('materialize: ref lookup nested inside a branch is resolved', async () => {
  const def: RaterDefinition = {
    schema_version: 1,
    inputs: [
      { name: 'custody_type', label: 'Custody type', type: 'text', required: true },
    ],
    steps: [
      {
        id: 'br',
        type: 'branch',
        cases: [
          {
            label: 'always',
            when: 'true',
            steps: [
              {
                id: 'base_rate',
                type: 'lookup',
                source: 'ref',
                tableId: TABLE_ID,
                match: [
                  { mode: 'exact', column: 'custody_type', value: 'inputs.custody_type' },
                ],
                onMiss: 'error',
              },
              { id: 'out', type: 'output', label: 'Rate', expr: 'base_rate.rate', format: 'number' },
            ],
          },
        ],
      },
    ],
  };

  const { definition, errors } = await materializeLookupTables(
    def,
    resolverFor({ [TABLE_ID]: baseRateTable }),
  );
  assertEquals(errors, []);
  const result = await executeRater(definition, { custody_type: 'cold' }, noDb);
  assertEquals(result.outputs.out.value, 0.0008);
});
