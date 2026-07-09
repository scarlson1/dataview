/**
 * Editor for fetch steps. Two sources:
 *  - db: a declarative PostgREST query against an app table (RLS is the gate
 *    on what a rater can read); tables and columns come from the registry.
 *  - http: an external API call (server-only, host-allowlisted); values are
 *    pulled from the JSON response by dot-path.
 */

import { TABLE_ORDER, TABLES } from '#/data/tables';
import { MONO_FONT } from '#/theme/tokens';
import type { DbFetchStep, FetchStep, HttpFetchStep } from '#/types/raters';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { Plus, X } from 'lucide-react';
import { ExpressionField } from '../ExpressionField';

interface FetchStepEditorProps {
  step: FetchStep;
  onChange: (step: FetchStep) => void;
  availableBindings: string[];
}

const FILTER_OPS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'in',
  'is',
] as const;

const monoInput = { input: { sx: { fontFamily: MONO_FONT, fontSize: 13 } } };

export const FetchStepEditor = ({
  step,
  onChange,
  availableBindings,
}: FetchStepEditorProps) => {
  const switchSource = (source: 'db' | 'http') => {
    if (source === step.source) return;
    if (source === 'db') {
      onChange({
        id: step.id,
        label: step.label,
        type: 'fetch',
        source: 'db',
        table: '',
        select: [],
        filters: [],
        mode: 'maybe',
        onEmpty: 'null',
      });
    } else {
      onChange({
        id: step.id,
        label: step.label,
        type: 'fetch',
        source: 'http',
        method: 'GET',
        url: '',
        extract: [{ name: 'value', path: '' }],
        timeoutMs: 5000,
      });
    }
  };

  return (
    <Stack spacing={1.5}>
      <ToggleButtonGroup
        value={step.source}
        exclusive
        size='small'
        onChange={(_e, v) => v && switchSource(v as 'db' | 'http')}
      >
        <ToggleButton value='db'>Database</ToggleButton>
        <ToggleButton value='http'>External API</ToggleButton>
      </ToggleButtonGroup>

      {step.source === 'db' ? (
        <DbFetchFields
          step={step}
          onChange={onChange}
          availableBindings={availableBindings}
        />
      ) : (
        <HttpFetchFields
          step={step}
          onChange={onChange}
          availableBindings={availableBindings}
        />
      )}
    </Stack>
  );
};

// --- db ------------------------------------------------------------------------

const DbFetchFields = ({
  step,
  onChange,
  availableBindings,
}: {
  step: DbFetchStep;
  onChange: (step: FetchStep) => void;
  availableBindings: string[];
}) => {
  const table = TABLES[step.table];
  const columns = table?.columns.map((c) => c.field) ?? [];

  return (
    <Stack spacing={1.5}>
      <Stack direction='row' spacing={1.5}>
        <TextField
          label='Table'
          value={step.table}
          onChange={(e) =>
            onChange({
              ...step,
              table: e.target.value,
              select: [],
              filters: [],
            })
          }
          size='small'
          select
          required
          sx={{ width: 260 }}
        >
          {TABLE_ORDER.map((name) => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label='Result'
          value={step.mode}
          onChange={(e) =>
            onChange({ ...step, mode: e.target.value as DbFetchStep['mode'] })
          }
          size='small'
          select
          sx={{ width: 190 }}
        >
          <MenuItem value='maybe'>One row (or nothing)</MenuItem>
          <MenuItem value='single'>Exactly one row</MenuItem>
          <MenuItem value='list'>List of rows</MenuItem>
        </TextField>
        {step.mode === 'maybe' && (
          <TextField
            label='When empty'
            value={step.onEmpty}
            onChange={(e) =>
              onChange({
                ...step,
                onEmpty: e.target.value as DbFetchStep['onEmpty'],
              })
            }
            size='small'
            select
            sx={{ width: 160 }}
          >
            <MenuItem value='null'>Bind null</MenuItem>
            <MenuItem value='error'>Fail the run</MenuItem>
          </TextField>
        )}
      </Stack>

      <TextField
        label='Columns to read'
        value={step.select}
        onChange={(e) =>
          onChange({
            ...step,
            select:
              typeof e.target.value === 'string'
                ? e.target.value.split(',')
                : (e.target.value as unknown as string[]),
          })
        }
        size='small'
        select
        required
        disabled={!table}
        slotProps={{
          select: { multiple: true },
          input: monoInput.input,
        }}
        helperText={
          step.select.length
            ? `read as ${step.id}.${step.select[0]}${step.select.length > 1 ? ', …' : ''}`
            : 'pick at least one column'
        }
      >
        {columns.map((name) => (
          <MenuItem key={name} value={name}>
            {name}
          </MenuItem>
        ))}
      </TextField>

      <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>
        Filters (AND)
      </Typography>
      {step.filters.map((f, i) => (
        <Stack
          // biome-ignore lint/suspicious/noArrayIndexKey: filters are positional
          key={i}
          direction='row'
          spacing={1}
          sx={{ alignItems: 'flex-start' }}
        >
          <TextField
            value={f.column}
            onChange={(e) =>
              onChange({
                ...step,
                filters: step.filters.map((x, xi) =>
                  xi === i ? { ...x, column: e.target.value } : x,
                ),
              })
            }
            size='small'
            select
            label='Column'
            disabled={!table}
            sx={{ width: 190 }}
          >
            {columns.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            value={f.op}
            onChange={(e) =>
              onChange({
                ...step,
                filters: step.filters.map((x, xi) =>
                  xi === i
                    ? {
                        ...x,
                        op: e.target.value as (typeof FILTER_OPS)[number],
                      }
                    : x,
                ),
              })
            }
            size='small'
            select
            label='Op'
            sx={{ width: 90 }}
          >
            {FILTER_OPS.map((op) => (
              <MenuItem key={op} value={op}>
                {op}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ flex: 1 }}>
            <ExpressionField
              label='Value'
              value={f.value}
              onChange={(value) =>
                onChange({
                  ...step,
                  filters: step.filters.map((x, xi) =>
                    xi === i ? { ...x, value } : x,
                  ),
                })
              }
              availableBindings={availableBindings}
              placeholder='upper(inputs.state)'
              hideChips
            />
          </Box>
          <IconButton
            size='small'
            onClick={() =>
              onChange({
                ...step,
                filters: step.filters.filter((_x, xi) => xi !== i),
              })
            }
            sx={{ mt: 0.5 }}
          >
            <X size={14} />
          </IconButton>
        </Stack>
      ))}
      <Box>
        <Button
          size='small'
          startIcon={<Plus size={14} />}
          disabled={!table}
          onClick={() =>
            onChange({
              ...step,
              filters: [
                ...step.filters,
                { column: columns[0] ?? '', op: 'eq', value: '' },
              ],
            })
          }
        >
          Add filter
        </Button>
      </Box>

      {step.mode === 'list' && (
        <Stack direction='row' spacing={1.5}>
          <TextField
            label='Limit'
            value={step.limit ?? ''}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({
                ...step,
                limit:
                  e.target.value.trim() && Number.isInteger(n) && n > 0
                    ? n
                    : undefined,
              });
            }}
            size='small'
            type='number'
            sx={{ width: 120 }}
          />
          <TextField
            label='Order by'
            value={step.orderBy?.column ?? ''}
            onChange={(e) =>
              onChange({
                ...step,
                orderBy: e.target.value
                  ? {
                      column: e.target.value,
                      ascending: step.orderBy?.ascending ?? true,
                    }
                  : undefined,
              })
            }
            size='small'
            select
            disabled={!table}
            sx={{ width: 190 }}
          >
            <MenuItem value=''>—</MenuItem>
            {columns.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      )}
    </Stack>
  );
};

// --- http ----------------------------------------------------------------------

const HttpFetchFields = ({
  step,
  onChange,
  availableBindings,
}: {
  step: HttpFetchStep;
  onChange: (step: FetchStep) => void;
  availableBindings: string[];
}) => {
  const setKv = (field: 'query' | 'headers', entries: [string, string][]) =>
    onChange({
      ...step,
      [field]: entries.length ? Object.fromEntries(entries) : undefined,
    });

  const kvRows = (field: 'query' | 'headers') => {
    const record = step[field] ?? {};
    const entries = Object.entries(record);
    return (
      <Stack spacing={1}>
        {entries.map(([key, value], i) => (
          <Stack
            // biome-ignore lint/suspicious/noArrayIndexKey: entries are positional
            key={i}
            direction='row'
            spacing={1}
            sx={{ alignItems: 'center' }}
          >
            <TextField
              label='Name'
              value={key}
              onChange={(e) => {
                const next = [...entries] as [string, string][];
                next[i] = [e.target.value, value];
                setKv(field, next);
              }}
              size='small'
              sx={{ width: 180 }}
              slotProps={monoInput}
            />
            <TextField
              label={field === 'query' ? 'Value (expression)' : 'Value'}
              value={value}
              onChange={(e) => {
                const next = [...entries] as [string, string][];
                next[i] = [key, e.target.value];
                setKv(field, next);
              }}
              size='small'
              sx={{ flex: 1 }}
              slotProps={monoInput}
            />
            <IconButton
              size='small'
              onClick={() =>
                setKv(
                  field,
                  entries.filter((_x, xi) => xi !== i) as [string, string][],
                )
              }
            >
              <X size={14} />
            </IconButton>
          </Stack>
        ))}
        <Box>
          <Button
            size='small'
            startIcon={<Plus size={14} />}
            onClick={() =>
              setKv(field, [...entries, ['', '']] as [string, string][])
            }
          >
            Add {field === 'query' ? 'query param' : 'header'}
          </Button>
        </Box>
      </Stack>
    );
  };

  return (
    <Stack spacing={1.5}>
      <Stack direction='row' spacing={1.5}>
        <TextField
          label='Method'
          value={step.method}
          onChange={(e) =>
            onChange({ ...step, method: e.target.value as 'GET' | 'POST' })
          }
          size='small'
          select
          sx={{ width: 100 }}
        >
          <MenuItem value='GET'>GET</MenuItem>
          <MenuItem value='POST'>POST</MenuItem>
        </TextField>
        <TextField
          label='URL (https; {{expression}} segments allowed)'
          value={step.url}
          onChange={(e) => onChange({ ...step, url: e.target.value })}
          size='small'
          required
          sx={{ flex: 1 }}
          placeholder='https://api.example.com/v1/price/{{inputs.symbol}}'
          slotProps={monoInput}
        />
        <TextField
          label='Timeout (ms)'
          value={step.timeoutMs}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isInteger(n)) onChange({ ...step, timeoutMs: n });
          }}
          size='small'
          type='number'
          sx={{ width: 130 }}
        />
      </Stack>

      <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>
        Query params
      </Typography>
      {kvRows('query')}
      <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>
        Headers (static)
      </Typography>
      {kvRows('headers')}

      <Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>
        Extract from JSON response
      </Typography>
      {step.extract.map((ex, i) => (
        <Stack
          // biome-ignore lint/suspicious/noArrayIndexKey: extracts are positional
          key={i}
          direction='row'
          spacing={1}
          sx={{ alignItems: 'center' }}
        >
          <TextField
            label='Name'
            value={ex.name}
            onChange={(e) =>
              onChange({
                ...step,
                extract: step.extract.map((x, xi) =>
                  xi === i ? { ...x, name: e.target.value } : x,
                ),
              })
            }
            size='small'
            sx={{ width: 180 }}
            slotProps={monoInput}
            helperText={ex.name ? `read as ${step.id}.${ex.name}` : undefined}
          />
          <TextField
            label='Path (dot notation)'
            value={ex.path}
            onChange={(e) =>
              onChange({
                ...step,
                extract: step.extract.map((x, xi) =>
                  xi === i ? { ...x, path: e.target.value } : x,
                ),
              })
            }
            size='small'
            sx={{ flex: 1 }}
            placeholder='data.rates.USD'
            slotProps={monoInput}
            helperText={ex.name ? '' : undefined}
          />
          {step.extract.length > 1 && (
            <IconButton
              size='small'
              onClick={() =>
                onChange({
                  ...step,
                  extract: step.extract.filter((_x, xi) => xi !== i),
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
            onChange({
              ...step,
              extract: [...step.extract, { name: '', path: '' }],
            })
          }
        >
          Add extract
        </Button>
      </Box>
      <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
        External calls run server-side only, https-only, against allowlisted
        hosts. Query values are expressions (
        {availableBindings.length
          ? availableBindings.slice(0, 3).join(', ')
          : 'inputs.…'}
        , or quoted literals like 'USD').
      </Typography>
    </Stack>
  );
};
