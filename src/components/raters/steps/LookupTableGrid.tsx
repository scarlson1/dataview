/**
 * Reusable editor for a lookup grid: typed columns × cell rows. Used by the
 * inline mode of {@link LookupStepEditor} and by the shared-table editor on the
 * lookup-tables management page. Purely about the grid body — match config and
 * miss behavior live with the consumer.
 *
 * A controlled MUI Table rather than DataGrid: dynamic typed columns and row
 * reordering don't fit DataGrid's edit model. Number cells: blank = null
 * (open-ended range bound). First matching row wins, so row order matters.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
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
import type { LookupColumn } from '#/types/raters';

export type Cell = string | number | boolean | null;
export type ColumnType = LookupColumn['type'];

export const parseCell = (raw: string, type: ColumnType): Cell => {
  if (type === 'number') {
    const s = raw.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  if (type === 'boolean') return raw.trim().toLowerCase() === 'true';
  return raw;
};

export const cellToString = (cell: Cell): string =>
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

export const CellInput = ({
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

interface LookupTableGridProps {
  columns: LookupColumn[];
  rows: Cell[][];
  onChange: (columns: LookupColumn[], rows: Cell[][]) => void;
  // Called before a column rename is committed so a consumer can keep external
  // references (e.g. a step's match config) in sync.
  onRenameColumn?: (index: number, from: string, to: string) => void;
}

export const LookupTableGrid = ({
  columns,
  rows,
  onChange,
  onRenameColumn,
}: LookupTableGridProps) => {
  const renameColumn = (index: number, name: string) => {
    onRenameColumn?.(index, columns[index].name, name);
    onChange(
      columns.map((c, i) => (i === index ? { ...c, name } : c)),
      rows,
    );
  };

  const retypeColumn = (index: number, type: ColumnType) => {
    onChange(
      columns.map((c, i) => (i === index ? { ...c, type } : c)),
      rows.map((row) =>
        row.map((cell, i) =>
          i === index ? parseCell(cellToString(cell), type) : cell,
        ),
      ),
    );
  };

  const addColumn = () => {
    let n = columns.length + 1;
    while (columns.some((c) => c.name === `col_${n}`)) n += 1;
    onChange(
      [...columns, { name: `col_${n}`, type: 'number' }],
      rows.map((row) => [...row, null]),
    );
  };

  const removeColumn = (index: number) => {
    onChange(
      columns.filter((_, i) => i !== index),
      rows.map((row) => row.filter((_, i) => i !== index)),
    );
  };

  const setCell = (rowIndex: number, colIndex: number, raw: string) => {
    onChange(
      columns,
      rows.map((row, r) =>
        r === rowIndex
          ? row.map((cell, c) =>
              c === colIndex ? parseCell(raw, columns[colIndex].type) : cell,
            )
          : row,
      ),
    );
  };

  const addRow = () =>
    onChange(columns, [
      ...rows,
      columns.map((c) => (c.type === 'text' ? '' : null)),
    ]);

  const removeRow = (index: number) =>
    onChange(
      columns,
      rows.filter((_, i) => i !== index),
    );

  const moveRow = (index: number, delta: -1 | 1) => {
    const to = index + delta;
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [row] = next.splice(index, 1);
    next.splice(to, 0, row);
    onChange(columns, next);
  };

  return (
    <Stack spacing={1}>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size='small' sx={{ '& td, & th': { px: 0.75, py: 0.5 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 76 }} />
              {columns.map((col, i) => (
                <TableCell
                  // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
                  key={`col-${i}-${columns.length}`}
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
                        retypeColumn(i, e.target.value as ColumnType)
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
                    {columns.length > 1 && (
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
            {rows.map((row, r) => (
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
                      disabled={r === rows.length - 1}
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
                    {columns[c]?.type === 'boolean' ? (
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
                        placeholder={columns[c]?.type === 'number' ? '∞' : ''}
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
    </Stack>
  );
};
