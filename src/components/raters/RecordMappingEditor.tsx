/**
 * Record binding editor. Declares which table a rater applies to, optional
 * match conditions that narrow applicability against the record's own columns,
 * and optional pre-fill mappings from the source row (values stay editable on
 * the run page). Persisted to raters.record_mapping.
 *
 * A table with no conditions means "applies to every row of this table";
 * conditions AND together and are matched by src/lib/raterMatching.ts.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Plus, Trash2 } from 'lucide-react';
import { TABLES } from '#/data/tables';
import {
  RATER_ENTITY_PICKERS,
  type RaterEntityTable,
} from '#/lib/raterPickers';
import { MONO_FONT } from '#/theme/tokens';
import {
  DB_FILTER_OPS,
  type MatchCondition,
  type RaterInput,
  type RecordMapping,
} from '#/types/raters';

interface RecordMappingEditorProps {
  inputs: RaterInput[];
  mapping: RecordMapping | null;
  onChange: (mapping: RecordMapping | null) => void;
}

// Source tables the binding supports (needs picker config for the run page).
const SOURCE_TABLES = Object.keys(RATER_ENTITY_PICKERS) as RaterEntityTable[];

// Human labels for the condition operators (DB_FILTER_OPS).
const OP_LABELS: Record<(typeof DB_FILTER_OPS)[number], string> = {
  eq: '= equals',
  neq: '≠ not equals',
  gt: '> greater than',
  gte: '≥ at least',
  lt: '< less than',
  lte: '≤ at most',
  like: 'matches (case-sensitive)',
  ilike: 'matches (any case)',
  in: 'in (comma list)',
  is: 'is (null/true/false)',
};

// Column kinds that can sensibly seed an input type.
const COMPATIBLE: Record<RaterInput['type'], string[]> = {
  number: ['number'],
  text: ['text', 'chip', 'mono'],
  select: ['text', 'chip', 'mono'],
  boolean: ['bool'],
  date: ['datetime'],
  entity: ['number'],
};

export const RecordMappingEditor = ({
  inputs,
  mapping,
  onChange,
}: RecordMappingEditorProps) => {
  const table = mapping ? TABLES[mapping.table] : undefined;
  const columns = table?.columns ?? [];
  const conditions = mapping?.conditions ?? [];
  const mappings = mapping?.mappings ?? [];

  const setMapping = (input: string, column: string) => {
    if (!mapping) return;
    const rest = mappings.filter((m) => m.input !== input);
    onChange({
      ...mapping,
      mappings: column ? [...rest, { input, column }] : rest,
    });
  };

  const updateConditions = (next: MatchCondition[]) => {
    if (!mapping) return;
    onChange({ ...mapping, conditions: next });
  };

  const addCondition = () =>
    updateConditions([
      ...conditions,
      { column: columns[0]?.field ?? '', op: 'eq', value: '' },
    ]);

  const setCondition = (i: number, patch: Partial<MatchCondition>) =>
    updateConditions(
      conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    );

  const removeCondition = (i: number) =>
    updateConditions(conditions.filter((_, idx) => idx !== i));

  return (
    <Stack spacing={1.5}>
      <TextField
        label='Applies to table (optional)'
        value={mapping?.table ?? ''}
        onChange={(e) =>
          // Changing the table invalidates column-scoped conditions/mappings.
          onChange(e.target.value ? { table: e.target.value } : null)
        }
        size='small'
        select
        sx={{ width: 300 }}
      >
        <MenuItem value=''>— none —</MenuItem>
        {SOURCE_TABLES.map((name) => (
          <MenuItem key={name} value={name}>
            {name}
          </MenuItem>
        ))}
      </TextField>

      {mapping && (
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, mb: 0.75 }}>
            Match conditions
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
            All conditions must hold for a record to match. No conditions ⇒
            applies to every {mapping.table} row.
          </Typography>
          <Stack spacing={1}>
            {conditions.map((c, i) => (
              <Box
                // biome-ignore lint/suspicious/noArrayIndexKey: fields are controlled from state; no stable id
                key={i}
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <TextField
                  value={c.column}
                  onChange={(e) => setCondition(i, { column: e.target.value })}
                  size='small'
                  select
                  label='Column'
                  sx={{ width: 200 }}
                >
                  {columns.map((col) => (
                    <MenuItem key={col.field} value={col.field}>
                      {col.field}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  value={c.op}
                  onChange={(e) =>
                    setCondition(i, {
                      op: e.target.value as MatchCondition['op'],
                    })
                  }
                  size='small'
                  select
                  label='Operator'
                  sx={{ width: 180 }}
                >
                  {DB_FILTER_OPS.map((op) => (
                    <MenuItem key={op} value={op}>
                      {OP_LABELS[op]}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  value={c.value}
                  onChange={(e) => setCondition(i, { value: e.target.value })}
                  size='small'
                  label='Value'
                  sx={{ flex: 1, minWidth: 120 }}
                />
                <IconButton
                  aria-label='Remove condition'
                  size='small'
                  onClick={() => removeCondition(i)}
                >
                  <Trash2 size={16} />
                </IconButton>
              </Box>
            ))}
            <Box>
              <Button
                size='small'
                startIcon={<Plus size={14} />}
                onClick={addCondition}
                disabled={columns.length === 0}
              >
                Add condition
              </Button>
            </Box>
          </Stack>
        </Box>
      )}

      {mapping && (
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, mb: 0.75 }}>
            Input pre-fill (optional)
          </Typography>
          {inputs.length === 0 ? (
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
              Declare inputs first, then map columns onto them.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {inputs.map((input) => {
                const current = mappings.find((m) => m.input === input.name);
                const compatible = new Set(COMPATIBLE[input.type]);
                return (
                  <Box
                    key={input.name}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
                  >
                    <Typography
                      sx={{ fontFamily: MONO_FONT, fontSize: 12.5, width: 180 }}
                    >
                      inputs.{input.name}
                    </Typography>
                    <TextField
                      value={current?.column ?? ''}
                      onChange={(e) => setMapping(input.name, e.target.value)}
                      size='small'
                      select
                      sx={{ width: 260 }}
                      label='Source column'
                    >
                      <MenuItem value=''>— not mapped —</MenuItem>
                      {columns.map((col) => (
                        <MenuItem key={col.field} value={col.field}>
                          <Box
                            component='span'
                            sx={{ opacity: compatible.has(col.kind) ? 1 : 0.45 }}
                          >
                            {col.field}
                          </Box>
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      )}
    </Stack>
  );
};
