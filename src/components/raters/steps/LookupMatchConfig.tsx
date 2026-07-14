/**
 * Row-matching + miss-behavior editor for a lookup step, shared by inline and
 * shared-table (ref) modes. Parameterized by `columns` so it works whether the
 * grid lives on the step (inline) or is resolved from a shared table (ref).
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { X } from 'lucide-react';
import type { LookupCell, LookupColumn, LookupMatch } from '#/types/raters';
import { ExpressionField } from '../ExpressionField';
import { type Cell, CellInput, parseCell } from './LookupTableGrid';

// The lookup fields this editor owns.
export interface LookupMatchState {
  match: LookupMatch[];
  onMiss: 'error' | 'default';
  defaultRow?: Record<string, LookupCell>;
  outputColumn?: string;
}

// Sentinel select value for "bind the whole row object" (outputColumn unset).
const WHOLE_ROW = '__row__';

interface LookupMatchConfigProps {
  columns: LookupColumn[];
  state: LookupMatchState;
  onChange: (patch: Partial<LookupMatchState>) => void;
  availableBindings: string[];
}

export const LookupMatchConfig = ({
  columns,
  state,
  onChange,
  availableBindings,
}: LookupMatchConfigProps) => {
  const { match, onMiss, defaultRow, outputColumn } = state;
  const numberColumns = columns.filter((c) => c.type === 'number');
  const firstColumn = columns[0]?.name ?? '';

  const setMatch = (index: number, m: LookupMatch) =>
    onChange({ match: match.map((cur, i) => (i === index ? m : cur)) });

  return (
    <Stack spacing={2}>
      <Stack spacing={1.5}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>
          Row matching
        </Typography>
        {match.map((m, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: matches are positional
          <Stack key={i} spacing={1}>
            <Stack
              direction='row'
              spacing={1}
              sx={{ alignItems: 'flex-start' }}
            >
              <TextField
                value={m.mode}
                onChange={(e) => {
                  const mode = e.target.value as 'exact' | 'range';
                  if (mode === m.mode) return;
                  setMatch(
                    i,
                    mode === 'exact'
                      ? { mode, column: firstColumn, value: m.value }
                      : {
                          mode,
                          minColumn: numberColumns[0]?.name ?? firstColumn,
                          maxColumn:
                            numberColumns[1]?.name ??
                            numberColumns[0]?.name ??
                            firstColumn,
                          value: m.value,
                          minInclusive: true,
                          maxInclusive: false,
                        },
                  );
                }}
                size='small'
                select
                sx={{ width: 110 }}
                label='Mode'
              >
                <MenuItem value='exact'>Exact</MenuItem>
                <MenuItem value='range'>Range band</MenuItem>
              </TextField>

              {m.mode === 'exact' ? (
                <TextField
                  value={m.column}
                  onChange={(e) =>
                    setMatch(i, { ...m, column: e.target.value })
                  }
                  size='small'
                  select
                  sx={{ width: 150 }}
                  label='Column'
                >
                  {columns.map((c) => (
                    <MenuItem key={c.name} value={c.name}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <>
                  <TextField
                    value={m.minColumn}
                    onChange={(e) =>
                      setMatch(i, { ...m, minColumn: e.target.value })
                    }
                    size='small'
                    select
                    sx={{ width: 130 }}
                    label='Min column'
                  >
                    {columns.map((c) => (
                      <MenuItem key={c.name} value={c.name}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    value={m.maxColumn}
                    onChange={(e) =>
                      setMatch(i, { ...m, maxColumn: e.target.value })
                    }
                    size='small'
                    select
                    sx={{ width: 130 }}
                    label='Max column'
                  >
                    {columns.map((c) => (
                      <MenuItem key={c.name} value={c.name}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </>
              )}
              {match.length > 1 && (
                <IconButton
                  size='small'
                  onClick={() =>
                    onChange({ match: match.filter((_, mi) => mi !== i) })
                  }
                  sx={{ mt: 0.5 }}
                >
                  <X size={14} />
                </IconButton>
              )}
            </Stack>
            <ExpressionField
              label='Match value'
              value={m.value}
              onChange={(value) => setMatch(i, { ...m, value })}
              availableBindings={availableBindings}
              placeholder='inputs.custody_type'
              required
            />
            {m.mode === 'range' && (
              <Stack direction='row' spacing={2}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={m.minInclusive}
                      onChange={(e) =>
                        setMatch(i, { ...m, minInclusive: e.target.checked })
                      }
                      size='small'
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: 12.5 }}>
                      Min inclusive
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={m.maxInclusive}
                      onChange={(e) =>
                        setMatch(i, { ...m, maxInclusive: e.target.checked })
                      }
                      size='small'
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: 12.5 }}>
                      Max inclusive
                    </Typography>
                  }
                />
              </Stack>
            )}
          </Stack>
        ))}
        <Box>
          <Button
            size='small'
            disabled={!firstColumn}
            onClick={() =>
              onChange({
                match: [
                  ...match,
                  { mode: 'exact', column: firstColumn, value: '' },
                ],
              })
            }
          >
            Add match condition
          </Button>
        </Box>
      </Stack>

      {/* what the step binds: the whole matched row, or one column's value */}
      <TextField
        value={outputColumn ?? WHOLE_ROW}
        onChange={(e) => {
          const next = e.target.value;
          onChange({
            outputColumn: next === WHOLE_ROW ? undefined : next,
          });
        }}
        size='small'
        select
        sx={{ width: 260 }}
        label='Return'
        helperText={
          outputColumn
            ? `Binds ${outputColumn} (a single value)`
            : 'Binds the whole matched row as an object'
        }
      >
        <MenuItem value={WHOLE_ROW}>Whole row (object)</MenuItem>
        {columns.map((c) => (
          <MenuItem key={c.name} value={c.name}>
            {c.name}
          </MenuItem>
        ))}
      </TextField>

      {/* miss behavior */}
      <TextField
        value={onMiss}
        onChange={(e) => {
          const next = e.target.value as 'error' | 'default';
          onChange({
            onMiss: next,
            defaultRow:
              next === 'default'
                ? (defaultRow ??
                  Object.fromEntries(
                    columns.map((c) => [c.name, c.type === 'text' ? '' : null]),
                  ))
                : defaultRow,
          });
        }}
        size='small'
        select
        sx={{ width: 260 }}
        label='When no row matches'
      >
        <MenuItem value='error'>Fail the run</MenuItem>
        <MenuItem value='default'>Use a default row</MenuItem>
      </TextField>
      {onMiss === 'default' && defaultRow && (
        <Stack direction='row' spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {columns.map((c) => (
            <CellInput
              key={c.name}
              label={`default ${c.name}`}
              variant='outlined'
              width={150}
              value={(defaultRow[c.name] ?? null) as Cell}
              onCommitRaw={(raw) =>
                onChange({
                  defaultRow: {
                    ...defaultRow,
                    [c.name]: parseCell(raw, c.type),
                  },
                })
              }
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
};
