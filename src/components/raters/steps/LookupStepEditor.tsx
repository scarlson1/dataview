/**
 * Editor for lookup steps. A lookup finds a row in a reference grid by matching
 * probe values against its columns, then binds the matched row as an object
 * (e.g. `base_rate.rate`). The grid is either:
 *   - inline:  typed columns × rows carried on the step itself, or
 *   - saved:   a shared rater_lookup_tables row referenced by id, so one grid
 *              can be edited once and reused across many raters. The run-rater
 *              edge function resolves a saved reference into an inline grid at
 *              run time.
 *
 * Both modes share the same row-matching + miss-behavior config
 * ({@link LookupMatchConfig}); only where the columns/rows come from differs.
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '#/supabaseClient';
import { MONO_FONT } from '#/theme/tokens';
import type {
  InlineLookupStep,
  LookupColumn,
  LookupStep,
  LookupTableListRow,
  RefLookupStep,
} from '#/types/raters';
import { LookupMatchConfig } from './LookupMatchConfig';
import { type Cell, LookupTableGrid } from './LookupTableGrid';

interface LookupStepEditorProps {
  step: LookupStep;
  onChange: (step: LookupStep) => void;
  availableBindings: string[];
}

// Default columns when switching a step into inline mode without a shape to
// seed from.
const DEFAULT_COLUMNS: LookupColumn[] = [
  { name: 'key', type: 'text' },
  { name: 'value', type: 'number' },
];

export const useLookupTables = () =>
  useQuery({
    queryKey: ['rater_lookup_tables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rater_lookup_tables')
        .select('id, name, description, columns, updated_at, created_at')
        .is('archived_at', null)
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as LookupTableListRow[];
    },
  });

export const LookupStepEditor = ({
  step,
  onChange,
  availableBindings,
}: LookupStepEditorProps) => {
  const tables = useLookupTables();
  const isRef = step.source === 'ref';

  // Columns the match config works against: the step's own (inline) or the
  // referenced table's (ref).
  const refTable = isRef
    ? tables.data?.find((t) => t.id === step.tableId)
    : undefined;
  const columns: LookupColumn[] = isRef
    ? (refTable?.columns ?? [])
    : step.columns;

  const setMode = (_e: unknown, next: 'inline' | 'ref' | null) => {
    if (next === null || (next === 'ref') === isRef) return;
    if (next === 'ref') {
      const firstTable = tables.data?.[0];
      const refStep: RefLookupStep = {
        id: step.id,
        ...(step.label !== undefined ? { label: step.label } : {}),
        type: 'lookup',
        source: 'ref',
        tableId: firstTable?.id ?? '',
        ...(firstTable ? { tableName: firstTable.name } : {}),
        match: step.match,
        onMiss: step.onMiss,
        ...(step.defaultRow !== undefined
          ? { defaultRow: step.defaultRow }
          : {}),
      };
      onChange(refStep);
    } else {
      // ref → inline: seed columns from the referenced table (empty rows) if we
      // have them, else fall back to a starter grid.
      const seededCols = refTable?.columns ?? DEFAULT_COLUMNS;
      const inlineStep: InlineLookupStep = {
        id: step.id,
        ...(step.label !== undefined ? { label: step.label } : {}),
        type: 'lookup',
        source: 'inline',
        columns: seededCols,
        rows: [],
        match: step.match,
        onMiss: step.onMiss,
        ...(step.defaultRow !== undefined
          ? { defaultRow: step.defaultRow }
          : {}),
      };
      onChange(inlineStep);
    }
  };

  return (
    <Stack spacing={2}>
      <ToggleButtonGroup
        value={isRef ? 'ref' : 'inline'}
        exclusive
        onChange={setMode}
        size='small'
      >
        <ToggleButton value='inline' sx={{ textTransform: 'none', px: 1.5 }}>
          Inline table
        </ToggleButton>
        <ToggleButton value='ref' sx={{ textTransform: 'none', px: 1.5 }}>
          Saved table
        </ToggleButton>
      </ToggleButtonGroup>

      {isRef ? (
        <RefTablePicker
          step={step}
          tables={tables.data ?? []}
          loading={tables.isLoading}
          onSelect={(tableId) => {
            // Cache the picked table's name for friendly summaries (self-heals a
            // stale name on re-pick); drop it if somehow unresolved.
            const picked = tables.data?.find((t) => t.id === tableId);
            onChange({
              ...step,
              tableId,
              ...(picked
                ? { tableName: picked.name }
                : { tableName: undefined }),
            });
          }}
        />
      ) : (
        <LookupTableGrid
          columns={step.columns}
          rows={step.rows as Cell[][]}
          onChange={(cols, rows) => onChange({ ...step, columns: cols, rows })}
          onRenameColumn={(_i, from, to) => {
            // keep match column references in sync with the rename
            onChange({
              ...step,
              match: step.match.map((m) =>
                m.mode === 'exact'
                  ? m.column === from
                    ? { ...m, column: to }
                    : m
                  : {
                      ...m,
                      minColumn: m.minColumn === from ? to : m.minColumn,
                      maxColumn: m.maxColumn === from ? to : m.maxColumn,
                    },
              ),
            });
          }}
        />
      )}

      {isRef && !step.tableId && (
        <Alert severity='warning' sx={{ fontSize: 12.5 }}>
          Pick a saved table for this lookup.
        </Alert>
      )}

      <LookupMatchConfig
        columns={columns}
        state={{
          match: step.match,
          onMiss: step.onMiss,
          defaultRow: step.defaultRow,
        }}
        onChange={(patch) => onChange({ ...step, ...patch } as LookupStep)}
        availableBindings={availableBindings}
      />
    </Stack>
  );
};

interface RefTablePickerProps {
  step: RefLookupStep;
  tables: LookupTableListRow[];
  loading: boolean;
  onSelect: (tableId: string) => void;
}

const RefTablePicker = ({
  step,
  tables,
  loading,
  onSelect,
}: RefTablePickerProps) => {
  const selected = tables.find((t) => t.id === step.tableId);

  return (
    <Stack spacing={1.5}>
      <TextField
        value={tables.some((t) => t.id === step.tableId) ? step.tableId : ''}
        onChange={(e) => onSelect(e.target.value)}
        size='small'
        select
        label='Saved lookup table'
        sx={{ maxWidth: 360 }}
        helperText={
          loading
            ? 'Loading tables…'
            : tables.length === 0
              ? 'No saved tables yet — create one under Lookup tables.'
              : undefined
        }
      >
        {tables.map((t) => (
          <MenuItem key={t.id} value={t.id}>
            {t.name}
          </MenuItem>
        ))}
      </TextField>

      {!loading && step.tableId && !selected && (
        <Alert severity='error' sx={{ fontSize: 12.5 }}>
          The referenced table
          {step.tableName ? ` "${step.tableName}"` : ''} is unavailable
          (archived or deleted). Pick another table.
        </Alert>
      )}

      {selected && (
        <Box>
          {selected.description && (
            <Typography
              sx={{ fontSize: 12.5, color: 'text.secondary', mb: 0.75 }}
            >
              {selected.description}
            </Typography>
          )}
          <Stack
            direction='row'
            spacing={0.75}
            useFlexGap
            sx={{ flexWrap: 'wrap' }}
          >
            {selected.columns.map((c) => (
              <Chip
                key={c.name}
                size='small'
                variant='outlined'
                label={`${c.name}: ${c.type}`}
                sx={{ fontFamily: MONO_FONT, fontSize: 11.5 }}
              />
            ))}
          </Stack>
          <Typography
            sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.75 }}
          >
            The grid is resolved from the saved table at run time.{' '}
            <Link href='/lookup-tables' target='_blank' rel='noopener'>
              Manage tables
            </Link>
          </Typography>
        </Box>
      )}
    </Stack>
  );
};
