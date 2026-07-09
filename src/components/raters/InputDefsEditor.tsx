/**
 * Editor for a rater's declared inputs (same shape as report params).
 * Expressions reference these as `inputs.<name>`.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Plus, Trash2, X } from 'lucide-react';
import {
  RATER_ENTITY_PICKERS,
  type RaterEntityTable,
} from '#/lib/raterPickers';
import { MONO_FONT } from '#/theme/tokens';
import type { RaterInput, RaterInputType } from '#/types/raters';

interface InputDefsEditorProps {
  inputs: RaterInput[];
  onChange: (inputs: RaterInput[]) => void;
}

const INPUT_TYPES: { value: RaterInputType; label: string }[] = [
  { value: 'number', label: 'Number' },
  { value: 'text', label: 'Text' },
  { value: 'select', label: 'Select' },
  { value: 'boolean', label: 'Yes / no' },
  { value: 'date', label: 'Date' },
  { value: 'entity', label: 'Record picker' },
];

const NAME_RE = /^[a-z][a-z0-9_]*$/;

export const InputDefsEditor = ({ inputs, onChange }: InputDefsEditorProps) => {
  const setInput = (index: number, patch: Partial<RaterInput>) =>
    onChange(
      inputs.map((inp, i) => (i === index ? { ...inp, ...patch } : inp)),
    );

  const addInput = () => {
    let n = inputs.length + 1;
    while (inputs.some((i) => i.name === `input_${n}`)) n += 1;
    onChange([
      ...inputs,
      {
        name: `input_${n}`,
        label: `Input ${n}`,
        type: 'number',
        required: true,
      },
    ]);
  };

  return (
    <Stack spacing={1}>
      {inputs.map((input, i) => {
        const badName = !NAME_RE.test(input.name);
        const duplicate = inputs.some(
          (x, xi) => xi !== i && x.name === input.name,
        );
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: inputs are positional
          <Paper key={i} variant='outlined' sx={{ borderRadius: 1.5, p: 1.5 }}>
            <Stack spacing={1.5}>
              <Stack
                direction='row'
                spacing={1.5}
                sx={{ alignItems: 'flex-start' }}
              >
                <TextField
                  label='Name'
                  value={input.name}
                  onChange={(e) => setInput(i, { name: e.target.value })}
                  size='small'
                  error={badName || duplicate}
                  helperText={
                    badName
                      ? 'snake_case: letters, digits, _'
                      : duplicate
                        ? 'duplicate name'
                        : `inputs.${input.name}`
                  }
                  slotProps={{
                    input: { sx: { fontFamily: MONO_FONT, fontSize: 13 } },
                  }}
                  sx={{ width: 180 }}
                />
                <TextField
                  label='Label'
                  value={input.label}
                  onChange={(e) => setInput(i, { label: e.target.value })}
                  size='small'
                  sx={{ flex: 1 }}
                />
                <TextField
                  label='Type'
                  value={input.type}
                  onChange={(e) => {
                    const type = e.target.value as RaterInputType;
                    setInput(i, {
                      type,
                      options:
                        type === 'select'
                          ? (input.options ?? [{ value: '', label: '' }])
                          : undefined,
                      entity:
                        type === 'entity'
                          ? (input.entity ?? {
                              table: 'new_business_submissions',
                            })
                          : undefined,
                      default: undefined,
                    });
                  }}
                  size='small'
                  select
                  sx={{ width: 150 }}
                >
                  {INPUT_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </TextField>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={input.required}
                      onChange={(e) =>
                        setInput(i, { required: e.target.checked })
                      }
                      size='small'
                    />
                  }
                  label={
                    <Typography sx={{ fontSize: 12.5 }}>Required</Typography>
                  }
                  sx={{ mt: 0.25 }}
                />
                <IconButton
                  size='small'
                  onClick={() => onChange(inputs.filter((_x, xi) => xi !== i))}
                  sx={{ mt: 0.5 }}
                >
                  <Trash2 size={14} />
                </IconButton>
              </Stack>

              {input.type === 'select' && (
                <Stack spacing={1}>
                  {(input.options ?? []).map((opt, oi) => (
                    <Stack
                      // biome-ignore lint/suspicious/noArrayIndexKey: options are positional
                      key={oi}
                      direction='row'
                      spacing={1}
                      sx={{ alignItems: 'center' }}
                    >
                      <TextField
                        label='Value'
                        value={opt.value}
                        onChange={(e) =>
                          setInput(i, {
                            options: input.options?.map((o, x) =>
                              x === oi ? { ...o, value: e.target.value } : o,
                            ),
                          })
                        }
                        size='small'
                        sx={{ width: 180 }}
                        slotProps={{
                          input: {
                            sx: { fontFamily: MONO_FONT, fontSize: 13 },
                          },
                        }}
                      />
                      <TextField
                        label='Label'
                        value={opt.label}
                        onChange={(e) =>
                          setInput(i, {
                            options: input.options?.map((o, x) =>
                              x === oi ? { ...o, label: e.target.value } : o,
                            ),
                          })
                        }
                        size='small'
                        sx={{ flex: 1 }}
                      />
                      {(input.options?.length ?? 0) > 1 && (
                        <IconButton
                          size='small'
                          onClick={() =>
                            setInput(i, {
                              options: input.options?.filter(
                                (_o, x) => x !== oi,
                              ),
                            })
                          }
                        >
                          <X size={14} />
                        </IconButton>
                      )}
                    </Stack>
                  ))}
                  <Box>
                    <Button
                      size='small'
                      startIcon={<Plus size={14} />}
                      onClick={() =>
                        setInput(i, {
                          options: [
                            ...(input.options ?? []),
                            { value: '', label: '' },
                          ],
                        })
                      }
                    >
                      Add option
                    </Button>
                  </Box>
                </Stack>
              )}

              {input.type === 'entity' && (
                <TextField
                  label='Record table'
                  value={input.entity?.table ?? ''}
                  onChange={(e) =>
                    setInput(i, {
                      entity: { table: e.target.value as RaterEntityTable },
                    })
                  }
                  size='small'
                  select
                  sx={{ width: 280 }}
                >
                  {Object.keys(RATER_ENTITY_PICKERS).map((table) => (
                    <MenuItem key={table} value={table}>
                      {table}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Stack>
          </Paper>
        );
      })}
      <Box>
        <Button startIcon={<Plus size={15} />} onClick={addInput}>
          Add input
        </Button>
      </Box>
    </Stack>
  );
};
