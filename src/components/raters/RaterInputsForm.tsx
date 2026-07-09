/**
 * Run-time inputs for a rater, rendered from `definition.inputs`. A near
 * clone of ReportParamsForm (kept separate so reports stay stable): the
 * parent owns the Run button and calls `collect()` on the handle for
 * validated, serialized values. `seedValues` pre-fills from a mapped source
 * record; values stay editable after seeding.
 */

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import dayjs, { type Dayjs } from 'dayjs';
import { forwardRef, Suspense, useImperativeHandle } from 'react';
import { useAppForm } from '#/hooks/form';
import { RATER_ENTITY_PICKERS } from '#/lib/raterPickers';
import type { RaterInput } from '#/types/raters';

export interface RaterInputsFormHandle {
  /** Validate + serialize the current inputs for `runRater({ inputs })`. */
  collect: () =>
    | { ok: true; values: Record<string, unknown> }
    | { ok: false; message: string };
  /** Overwrite current values (record pre-fill). Missing keys are untouched. */
  seed: (values: Record<string, unknown>) => void;
}

interface RaterInputsFormProps {
  inputs: RaterInput[];
}

const DATE_FORMAT = 'YYYY-MM-DD';

const defaultFor = (input: RaterInput): unknown => {
  switch (input.type) {
    case 'date':
      return typeof input.default === 'string' && input.default
        ? dayjs(input.default)
        : null;
    case 'entity':
      return typeof input.default === 'number' ? input.default : null;
    case 'boolean':
      return typeof input.default === 'boolean' ? input.default : false;
    default:
      return input.default != null ? String(input.default) : '';
  }
};

/** Convert a raw record/column value into the form-state shape for an input. */
export const toFormValue = (input: RaterInput, raw: unknown): unknown => {
  if (raw === null || raw === undefined) return defaultFor(input);
  switch (input.type) {
    case 'date': {
      const d = dayjs(String(raw));
      return d.isValid() ? d : null;
    }
    case 'boolean':
      return Boolean(raw);
    case 'entity':
      return typeof raw === 'number' ? raw : null;
    default:
      return String(raw);
  }
};

const serializeOne = (
  input: RaterInput,
  value: unknown,
): { value: unknown } | { error: string } => {
  switch (input.type) {
    case 'date': {
      const d = value as Dayjs | null;
      if (!d) return { value: null };
      if (!d.isValid()) return { error: `${input.label} is not a valid date` };
      return { value: d.format(DATE_FORMAT) };
    }
    case 'number': {
      const s = String(value ?? '').trim();
      if (!s) return { value: null };
      const n = Number(s);
      if (!Number.isFinite(n))
        return { error: `${input.label} must be a number` };
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

export const RaterInputsForm = forwardRef<
  RaterInputsFormHandle,
  RaterInputsFormProps
>(({ inputs }, ref) => {
  const form = useAppForm({
    defaultValues: Object.fromEntries(
      inputs.map((i) => [i.name, defaultFor(i)]),
    ),
  });

  useImperativeHandle(ref, () => ({
    collect: () => {
      const values: Record<string, unknown> = {};
      for (const input of inputs) {
        const res = serializeOne(input, form.state.values[input.name]);
        if ('error' in res) return { ok: false, message: res.error };
        if (res.value === null) {
          if (input.required && input.default == null) {
            return { ok: false, message: `${input.label} is required` };
          }
          continue; // server applies the default / binds null
        }
        values[input.name] = res.value;
      }
      return { ok: true, values };
    },
    seed: (values) => {
      for (const input of inputs) {
        if (input.name in values) {
          form.setFieldValue(
            input.name,
            toFormValue(input, values[input.name]),
          );
        }
      }
    },
  }));

  return (
    <form.AppForm>
      <Suspense fallback={<Skeleton variant='rounded' height={56} />}>
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            flexWrap: 'wrap',
            '& > *': { minWidth: 200, flex: '1 1 200px', maxWidth: 320 },
          }}
        >
          {inputs.map((input) => (
            <form.AppField key={input.name} name={input.name}>
              {(field) => {
                switch (input.type) {
                  case 'date':
                    return (
                      <field.DatePicker
                        label={input.label}
                        slotProps={{
                          textField: {
                            size: 'small',
                            required: input.required,
                          },
                        }}
                      />
                    );
                  case 'select':
                    return (
                      <field.Select
                        label={input.label}
                        size='small'
                        required={input.required}
                        options={
                          input.required
                            ? (input.options ?? [])
                            : [
                                { value: '', label: '—' },
                                ...(input.options ?? []),
                              ]
                        }
                      />
                    );
                  case 'entity': {
                    const picker =
                      RATER_ENTITY_PICKERS[input.entity?.table ?? 'policies'];
                    return (
                      <field.EntitySelect
                        label={input.label}
                        table={picker.queryTable}
                        searchColumns={picker.searchColumns}
                        getOptionLabel={picker.getOptionLabel}
                        size='small'
                      />
                    );
                  }
                  case 'boolean':
                    return <field.Checkbox label={input.label} />;
                  default:
                    return (
                      <field.TextField
                        label={input.label}
                        size='small'
                        required={input.required}
                        type={input.type === 'number' ? 'number' : 'text'}
                      />
                    );
                }
              }}
            </form.AppField>
          ))}
        </Box>
      </Suspense>
    </form.AppForm>
  );
});
