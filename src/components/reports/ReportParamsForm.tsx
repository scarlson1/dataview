/**
 * Run-time inputs for a parameterized report, rendered from the saved
 * `reports.params` config (see #/types/reports ReportParam). The parent owns
 * the Run/CSV buttons; it calls `collect()` on the exposed handle to get
 * validated, serialized values for `runReport({ params })`.
 *
 * Entity params reuse EntitySelect — the live option list is just a PostgREST
 * query (RLS-gated, react-query cached) against the allowlisted table from the
 * saved config; picker columns come from ENTITY_PICKERS, never from the config.
 */

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import dayjs, { type Dayjs } from 'dayjs';
import { forwardRef, Suspense, useImperativeHandle } from 'react';
import { useAppForm } from '#/hooks/form';
import { ENTITY_PICKERS } from '#/lib/reportParams';
import type { ReportParam } from '#/types/reports';

export interface ReportParamsFormHandle {
  /** Validate + serialize the current inputs for `runReport({ params })`. */
  collect: () =>
    | { ok: true; values: Record<string, unknown> }
    | { ok: false; message: string };
}

interface ReportParamsFormProps {
  params: ReportParam[];
}

const DATE_FORMAT = 'YYYY-MM-DD';

// Form-state seed per param type; literal defaults from the config pre-fill.
const defaultFor = (p: ReportParam): unknown => {
  switch (p.type) {
    case 'date':
      return typeof p.default === 'string' && p.default
        ? dayjs(p.default)
        : null;
    case 'entity':
      return typeof p.default === 'number' ? p.default : null;
    case 'boolean':
      return typeof p.default === 'boolean' ? p.default : false;
    default:
      return p.default != null ? String(p.default) : '';
  }
};

const buildDefaults = (params: ReportParam[]): Record<string, unknown> =>
  Object.fromEntries(params.map((p) => [p.name, defaultFor(p)]));

// Serialize one form value to the run-report wire shape; null = "not provided"
// (the server applies the default or binds NULL for optional params).
const serializeOne = (
  p: ReportParam,
  value: unknown,
): { value: unknown } | { error: string } => {
  switch (p.type) {
    case 'date': {
      const d = value as Dayjs | null;
      if (!d) return { value: null };
      if (!d.isValid()) return { error: `${p.label} is not a valid date` };
      return { value: d.format(DATE_FORMAT) };
    }
    case 'number': {
      const s = String(value ?? '').trim();
      if (!s) return { value: null };
      const n = Number(s);
      if (!Number.isFinite(n)) return { error: `${p.label} must be a number` };
      return { value: n };
    }
    case 'boolean':
      return { value: Boolean(value) };
    case 'entity':
      return { value: (value as number | null) ?? null };
    default: {
      const s = String(value ?? '').trim();
      return { value: s || null };
    }
  }
};

// Date-range presets: pure client-side sugar that fills the two pickers.
const RANGE_PRESETS: { label: string; range: () => [Dayjs, Dayjs] }[] = [
  {
    label: 'This month',
    range: () => [dayjs().startOf('month'), dayjs().endOf('month')],
  },
  {
    label: 'Last month',
    range: () => [
      dayjs().subtract(1, 'month').startOf('month'),
      dayjs().subtract(1, 'month').endOf('month'),
    ],
  },
  {
    label: 'This quarter',
    range: () => {
      const start = dayjs()
        .startOf('month')
        .subtract(dayjs().month() % 3, 'month');
      return [start, start.add(2, 'month').endOf('month')];
    },
  },
  { label: 'YTD', range: () => [dayjs().startOf('year'), dayjs()] },
];

export const ReportParamsForm = forwardRef<
  ReportParamsFormHandle,
  ReportParamsFormProps
>(({ params }, ref) => {
  const form = useAppForm({ defaultValues: buildDefaults(params) });

  useImperativeHandle(ref, () => ({
    collect: () => {
      const values: Record<string, unknown> = {};
      for (const p of params) {
        const res = serializeOne(p, form.state.values[p.name]);
        if ('error' in res) return { ok: false, message: res.error };
        if (res.value === null) {
          if (p.required && p.default == null) {
            return { ok: false, message: `${p.label} is required` };
          }
          continue; // let the server apply the default / bind NULL
        }
        values[p.name] = res.value;
      }
      return { ok: true, values };
    },
  }));

  // "This month" etc. only make sense for the start_date/end_date convention.
  const hasDateRange =
    params.some((p) => p.type === 'date' && p.name === 'start_date') &&
    params.some((p) => p.type === 'date' && p.name === 'end_date');

  return (
    <form.AppForm>
      <Stack spacing={1.5}>
        {hasDateRange && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {RANGE_PRESETS.map(({ label, range }) => (
              <Chip
                key={label}
                label={label}
                size='small'
                variant='outlined'
                onClick={() => {
                  const [start, end] = range();
                  form.setFieldValue('start_date', start);
                  form.setFieldValue('end_date', end);
                }}
              />
            ))}
          </Box>
        )}
        <Suspense fallback={<Skeleton variant='rounded' height={56} />}>
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              flexWrap: 'wrap',
              '& > *': { minWidth: 220, flex: '1 1 220px', maxWidth: 340 },
            }}
          >
            {params.map((p) => (
              <form.AppField key={p.name} name={p.name}>
                {(field) => {
                  switch (p.type) {
                    case 'date':
                      return (
                        <field.DatePicker
                          label={p.label}
                          slotProps={{
                            textField: { size: 'small', required: p.required },
                          }}
                        />
                      );
                    case 'select':
                      return (
                        <field.Select
                          label={p.label}
                          size='small'
                          required={p.required}
                          options={
                            p.required
                              ? (p.options ?? [])
                              : [
                                  { value: '', label: 'All' },
                                  ...(p.options ?? []),
                                ]
                          }
                        />
                      );
                    case 'entity': {
                      const picker =
                        ENTITY_PICKERS[p.entity?.table ?? 'carriers'];
                      return (
                        <field.EntitySelect
                          label={p.label}
                          table={picker.queryTable}
                          searchColumns={picker.searchColumns}
                          getOptionLabel={picker.getOptionLabel}
                          size='small'
                          helperText={
                            p.required ? undefined : 'Leave empty for all'
                          }
                        />
                      );
                    }
                    case 'boolean':
                      return <field.Checkbox label={p.label} />;
                    default:
                      return (
                        <field.TextField
                          label={p.label}
                          size='small'
                          required={p.required}
                          type={p.type === 'number' ? 'number' : 'text'}
                        />
                      );
                  }
                }}
              </form.AppField>
            ))}
          </Box>
        </Suspense>
      </Stack>
    </form.AppForm>
  );
});
