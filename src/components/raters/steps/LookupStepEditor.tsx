/**
 * Editor for lookup steps: an inline reference table (typed columns × rows)
 * plus the match config (how a probe value finds its row). A controlled MUI
 * Table rather than DataGrid editing — dynamic typed columns and row
 * reordering don't fit DataGrid's edit model.
 *
 * Number cells: blank = null (open-ended range bound). First matching row
 * wins, so row order matters for overlapping ranges.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MONO_FONT } from '#/theme/tokens';
import type { LookupMatch, LookupStep } from '#/types/raters';
import { ExpressionField } from '../ExpressionField';

type Cell = string | number | boolean | null;

interface LookupStepEditorProps {
  step: LookupStep;
  onChange: (step: LookupStep) => void;
  availableBindings: string[];
}

const parseCell = (raw: string, type: 'text' | 'number' | 'boolean'): Cell => {
  if (type === 'number') {
    const s = raw.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  if (type === 'boolean') return raw === 'true';
  return raw;
};

const cellToString = (cell: Cell): string =>
  cell === null || cell === undefined ? '' : String(cell);

// Editable text/number cell. Keeps its own draft string while focused so
// in-progress numeric input survives (typing "0.0008" — a bare "0." or a
// trailing zero would otherwise be stripped the instant the parsed number is
// reflected back). The parsed value is committed live via onCommitRaw; the
// draft resyncs to the canonical string when the value changes from outside.
interface CellInputProps {
  value: Cell;
  onCommitRaw: (raw: string) => void;
  placeholder?: string;
  variant?: 'standard' | 'outlined';
  label?: string;
  width?: number;
}

const CellInput = ({
  value,
  onCommitRaw,
  placeholder,
  variant = 'standard',
  label,
  width,
}: CellInputProps) => {
  const [draft, setDraft] = useState(() => cellToString(value));
  const focused = useRef(false);

  // Adopt external changes (row reorder, column retype, reset) only when the
  // user isn't mid-edit, so we never clobber what they're typing.
  useEffect(() => {
    if (!focused.current) setDraft(cellToString(value));
  }, [value]);

  return (
    <TextField
      label={label}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        onCommitRaw(e.target.value);
      }}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        setDraft(cellToString(value)); // normalize (e.g. "0." → "0", "1.50" → "1.5")
      }}
      size='small'
      variant={variant}
      placeholder={placeholder}
      sx={width ? { width } : undefined}
      slotProps={{ input: { sx: { fontFamily: MONO_FONT, fontSize: 12.5 } } }}
    />
  );
};

export const LookupStepEditor = ({
  step,
  onChange,
  availableBindings,
}: LookupStepEditorProps) => {
  const setColumns = (columns: LookupStep['columns'], rows: Cell[][]) =>
    onChange({ ...step, columns, rows });

  const renameColumn = (index: number, name: string) => {
    onChange({
      ...step,
      columns: step.columns.map((c, i) => (i === index ? { ...c, name } : c)),
      // match entries reference columns by name — keep them in sync
      match: step.match.map((m) => {
        const old = step.columns[index].name;
        if (m.mode === 'exact') {
          return m.column === old ? { ...m, column: name } : m;
        }
        return {
          ...m,
          minColumn: m.minColumn === old ? name : m.minColumn,
          maxColumn: m.maxColumn === old ? name : m.maxColumn,
        };
      }),
    });
  };

  const retypeColumn = (index: number, type: 'text' | 'number' | 'boolean') => {
    setColumns(
      step.columns.map((c, i) => (i === index ? { ...c, type } : c)),
      step.rows.map((row) =>
        row.map((cell, i) =>
          i === index ? parseCell(cellToString(cell), type) : cell,
        ),
      ),
    );
  };

  const addColumn = () => {
    let n = step.columns.length + 1;
    while (step.columns.some((c) => c.name === `col_${n}`)) n += 1;
    setColumns(
      [...step.columns, { name: `col_${n}`, type: 'number' }],
      step.rows.map((row) => [...row, null]),
    );
  };

  const removeColumn = (index: number) => {
    setColumns(
      step.columns.filter((_, i) => i !== index),
      step.rows.map((row) => row.filter((_, i) => i !== index)),
    );
  };

  const setCell = (rowIndex: number, colIndex: number, raw: string) => {
    onChange({
      ...step,
      rows: step.rows.map((row, r) =>
        r === rowIndex
          ? row.map((cell, c) =>
              c === colIndex
                ? parseCell(raw, step.columns[colIndex].type)
                : cell,
            )
          : row,
      ),
    });
  };

  const addRow = () =>
    onChange({
      ...step,
      rows: [
        ...step.rows,
        step.columns.map((c) => (c.type === 'text' ? '' : null)),
      ],
    });

  const removeRow = (index: number) =>
    onChange({ ...step, rows: step.rows.filter((_, i) => i !== index) });

  const moveRow = (index: number, delta: -1 | 1) => {
    const to = index + delta;
    if (to < 0 || to >= step.rows.length) return;
    const rows = [...step.rows];
    const [row] = rows.splice(index, 1);
    rows.splice(to, 0, row);
    onChange({ ...step, rows });
  };

  const setMatch = (index: number, match: LookupMatch) =>
    onChange({
      ...step,
      match: step.match.map((m, i) => (i === index ? match : m)),
    });

  const numberColumns = step.columns.filter((c) => c.type === 'number');

  return (
    <Stack spacing={2}>
      {/* the reference table */}
      <Box sx={{ overflowX: 'auto' }}>
        <Table size='small' sx={{ '& td, & th': { px: 0.75, py: 0.5 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 76 }} />
              {step.columns.map((col, i) => (
                <TableCell
                  // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
                  key={`col-${i}-${step.columns.length}`}
                >
                  <Stack
                    direction='row'
                    spacing={0.5}
                    sx={{ alignItems: 'center' }}
                  >
                    <TextField
                      value={col.name}
                      onChange={(e) => renameColumn(i, e.target.value)}
                      size='small'
                      variant='standard'
                      slotProps={{
                        input: {
                          sx: { fontFamily: MONO_FONT, fontSize: 12.5 },
                        },
                      }}
                    />
                    <TextField
                      value={col.type}
                      onChange={(e) =>
                        retypeColumn(
                          i,
                          e.target.value as 'text' | 'number' | 'boolean',
                        )
                      }
                      size='small'
                      variant='standard'
                      select
                      sx={{ width: 66 }}
                      slotProps={{ input: { sx: { fontSize: 11.5 } } }}
                    >
                      <MenuItem value='text'>text</MenuItem>
                      <MenuItem value='number'>num</MenuItem>
                      <MenuItem value='boolean'>bool</MenuItem>
                    </TextField>
                    {step.columns.length > 1 && (
                      <IconButton size='small' onClick={() => removeColumn(i)}>
                        <X size={13} />
                      </IconButton>
                    )}
                  </Stack>
                </TableCell>
              ))}
              <TableCell sx={{ width: 40 }}>
                <IconButton size='small' onClick={addColumn} title='Add column'>
                  <Plus size={15} />
                </IconButton>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {step.rows.map((row, r) => (
              <TableRow
                // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                key={r}
              >
                <TableCell>
                  <Stack direction='row' spacing={0}>
                    <IconButton
                      size='small'
                      onClick={() => moveRow(r, -1)}
                      disabled={r === 0}
                    >
                      <ArrowUp size={13} />
                    </IconButton>
                    <IconButton
                      size='small'
                      onClick={() => moveRow(r, 1)}
                      disabled={r === step.rows.length - 1}
                    >
                      <ArrowDown size={13} />
                    </IconButton>
                  </Stack>
                </TableCell>
                {row.map((cell, c) => (
                  <TableCell
                    // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
                    key={`${r}-${c}`}
                  >
                    {step.columns[c]?.type === 'boolean' ? (
                      <Checkbox
                        checked={cell === true}
                        onChange={(e) =>
                          setCell(r, c, String(e.target.checked))
                        }
                        size='small'
                      />
                    ) : (
                      <CellInput
                        value={cell}
                        onCommitRaw={(raw) => setCell(r, c, raw)}
                        placeholder={
                          step.columns[c]?.type === 'number' ? '∞' : ''
                        }
                      />
                    )}
                  </TableCell>
                ))}
                <TableCell>
                  <IconButton size='small' onClick={() => removeRow(r)}>
                    <Trash2 size={13} />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Box>
        <Button size='small' startIcon={<Plus size={14} />} onClick={addRow}>
          Add row
        </Button>
        <Typography
          component='span'
          sx={{ fontSize: 11.5, color: 'text.secondary', ml: 1.5 }}
        >
          First matching row wins — order matters. Blank number cell =
          open-ended.
        </Typography>
      </Box>

      {/* match config */}
      <Stack spacing={1.5}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>
          Row matching
        </Typography>
        {step.match.map((m, i) => (
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
                      ? { mode, column: step.columns[0].name, value: m.value }
                      : {
                          mode,
                          minColumn:
                            numberColumns[0]?.name ?? step.columns[0].name,
                          maxColumn:
                            numberColumns[1]?.name ??
                            numberColumns[0]?.name ??
                            step.columns[0].name,
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
                  {step.columns.map((c) => (
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
                    {step.columns.map((c) => (
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
                    {step.columns.map((c) => (
                      <MenuItem key={c.name} value={c.name}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </>
              )}
              {step.match.length > 1 && (
                <IconButton
                  size='small'
                  onClick={() =>
                    onChange({
                      ...step,
                      match: step.match.filter((_, mi) => mi !== i),
                    })
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
            onClick={() =>
              onChange({
                ...step,
                match: [
                  ...step.match,
                  { mode: 'exact', column: step.columns[0].name, value: '' },
                ],
              })
            }
          >
            Add match condition
          </Button>
        </Box>
      </Stack>

      {/* miss behavior */}
      <TextField
        value={step.onMiss}
        onChange={(e) => {
          const onMiss = e.target.value as 'error' | 'default';
          onChange({
            ...step,
            onMiss,
            defaultRow:
              onMiss === 'default'
                ? (step.defaultRow ??
                  Object.fromEntries(
                    step.columns.map((c) => [
                      c.name,
                      c.type === 'text' ? '' : null,
                    ]),
                  ))
                : step.defaultRow,
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
      {step.onMiss === 'default' && step.defaultRow && (
        <Stack direction='row' spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {step.columns.map((c) => (
            <CellInput
              key={c.name}
              label={`default ${c.name}`}
              variant='outlined'
              width={150}
              value={(step.defaultRow?.[c.name] ?? null) as Cell}
              onCommitRaw={(raw) =>
                onChange({
                  ...step,
                  defaultRow: {
                    ...step.defaultRow,
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
