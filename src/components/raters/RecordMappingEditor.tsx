/**
 * Optional record mapping: pick a source table and map its columns onto the
 * rater's inputs, so the run page can pre-fill from an existing record
 * (values stay editable). Persisted to raters.record_mapping.
 */

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { TABLES } from '#/data/tables';
import {
  RATER_ENTITY_PICKERS,
  type RaterEntityTable,
} from '#/lib/raterPickers';
import { MONO_FONT } from '#/theme/tokens';
import type { RaterInput, RecordMapping } from '#/types/raters';

interface RecordMappingEditorProps {
  inputs: RaterInput[];
  mapping: RecordMapping | null;
  onChange: (mapping: RecordMapping | null) => void;
}

// Source tables the pre-fill picker supports (needs picker config for search).
const SOURCE_TABLES = Object.keys(RATER_ENTITY_PICKERS) as RaterEntityTable[];

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

  const setMapping = (input: string, column: string) => {
    if (!mapping) return;
    const rest = mapping.mappings.filter((m) => m.input !== input);
    const mappings = column ? [...rest, { input, column }] : rest;
    onChange(
      mappings.length ? { ...mapping, mappings } : { ...mapping, mappings: [] },
    );
  };

  return (
    <Stack spacing={1.5}>
      <TextField
        label='Pre-fill from table (optional)'
        value={mapping?.table ?? ''}
        onChange={(e) =>
          onChange(
            e.target.value ? { table: e.target.value, mappings: [] } : null,
          )
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

      {mapping && inputs.length === 0 && (
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
          Declare inputs first, then map columns onto them.
        </Typography>
      )}

      {mapping &&
        inputs.map((input) => {
          const current = mapping.mappings.find((m) => m.input === input.name);
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
                {columns.map((c) => (
                  <MenuItem key={c.field} value={c.field}>
                    <Box
                      component='span'
                      sx={{ opacity: compatible.has(c.kind) ? 1 : 0.45 }}
                    >
                      {c.field}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          );
        })}
    </Stack>
  );
};
