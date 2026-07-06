import {
  Alert,
  Button,
  Collapse,
  Grid,
  InputAdornment,
  Skeleton,
  Stack,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Suspense } from 'react';
import { toast } from 'sonner';
import { NewCarrierForm } from '#/components/NewCarrierForm';
import {
  type NewBinderValues,
  newBinderFormOpts,
} from '#/constants/newBinderForm';
import type { Tables, TablesInsert } from '#/data/database.types';
import type { EntityFormProps } from '#/data/entityForms';
import { useAppForm } from '#/hooks/form';
import {
  decimalToPct,
  emptyToNull,
  pctToDecimal,
  toDateStr,
  toNumber,
} from '#/lib/formCoerce';
import { supabase } from '#/supabaseClient';

type BinderRow = Tables<'binder'>;
type BinderInsert = TablesInsert<'binder'>;

const str = (v: unknown): string => (v == null ? '' : String(v));

const toFormValues = (
  row: Record<string, unknown> | null | undefined,
  seed: Partial<NewBinderValues> = {},
): NewBinderValues => ({
  ...newBinderFormOpts.defaultValues,
  ...(row
    ? {
        carrierId: (row.carrier_id as number) ?? (null as unknown as number),
        binderNumber: str(row.binder_number),
        yoa: str(row.yoa),
        effDate: row.eff_date ? dayjs(str(row.eff_date)) : null,
        expDate: row.exp_date ? dayjs(str(row.exp_date)) : null,
        grossComPct: decimalToPct(row.gross_com_pct as number | null),
        notes: str(row.notes),
      }
    : {}),
  ...seed,
});

export const NewBinderForm = ({
  recordId,
  initialRow,
  defaultValues,
  onSaved,
  onCancel,
}: EntityFormProps) => {
  const editing = recordId != null;

  const { mutateAsync, isPending, error, isError } = useMutation({
    mutationFn: async (values: BinderInsert) => {
      const q =
        recordId != null
          ? supabase.from('binder').update(values).eq('id', recordId).select()
          : supabase.from('binder').insert(values).select();
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data[0] as BinderRow;
    },
    onSuccess: (row) => {
      toast.success(editing ? 'Binder updated' : 'Binder created', {
        id: 'binder',
      });
      onSaved?.(row);
    },
    onError: (err) => toast.error(err.message, { id: 'binder' }),
  });

  const form = useAppForm({
    ...newBinderFormOpts,
    defaultValues: toFormValues(
      initialRow,
      defaultValues as Partial<NewBinderValues>,
    ),
    onSubmit: async ({ value }) => {
      const row: BinderInsert = {
        carrier_id: value.carrierId,
        binder_number: value.binderNumber.trim(),
        yoa: toNumber(value.yoa),
        eff_date: toDateStr(value.effDate) ?? '',
        exp_date: toDateStr(value.expDate) ?? '',
        gross_com_pct: pctToDecimal(value.grossComPct) ?? 0,
        notes: emptyToNull(value.notes),
      };
      await mutateAsync(row);
    },
  });

  return (
    <form.AppForm>
      <Stack direction='column' spacing={2}>
        <form.AppField name='carrierId'>
          {(field) => (
            <field.EntitySelect
              label='Carrier'
              table='carriers'
              searchColumns={['carrier_name']}
              getOptionLabel={(r) =>
                (r.carrier_name as string) || `Carrier #${r.id}`
              }
              renderCreateForm={({ defaultName, onCreated, onCancel }) => (
                <NewCarrierForm
                  defaultValues={{ carrierName: defaultName }}
                  onSaved={onCreated}
                  onCancel={onCancel}
                />
              )}
            />
          )}
        </form.AppField>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 8 }}>
            <form.AppField name='binderNumber'>
              {(field) => <field.TextField label='Binder #' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <form.AppField name='yoa'>
              {(field) => (
                <field.TextField
                  label='YOA'
                  slotProps={{
                    htmlInput: { inputMode: 'numeric', maxLength: 4 },
                  }}
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Suspense fallback={<Skeleton variant='rounded' height={40} />}>
              <form.AppField name='effDate'>
                {({ DatePicker }) => (
                  <DatePicker
                    label='Effective date'
                    slotProps={{ textField: { size: 'small' } }}
                  />
                )}
              </form.AppField>
            </Suspense>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Suspense fallback={<Skeleton variant='rounded' height={40} />}>
              <form.AppField name='expDate'>
                {({ DatePicker }) => (
                  <DatePicker
                    label='Expiration date'
                    slotProps={{ textField: { size: 'small' } }}
                  />
                )}
              </form.AppField>
            </Suspense>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='grossComPct'>
              {(field) => (
                <field.TextField
                  label='Gross commission'
                  helperText='Source of truth for the commission chain'
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position='end'>%</InputAdornment>
                      ),
                    },
                    htmlInput: { inputMode: 'decimal' },
                  }}
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={12}>
            <form.AppField name='notes'>
              {(field) => (
                <field.TextField label='Notes' multiline minRows={2} />
              )}
            </form.AppField>
          </Grid>
        </Grid>

        <Collapse in={isError}>
          <Alert severity='error'>
            {error?.message ?? 'An error occurred'}
          </Alert>
        </Collapse>

        <Stack direction='row' spacing={2}>
          {onCancel && (
            <Button disabled={isPending} onClick={onCancel}>
              Cancel
            </Button>
          )}
          <form.SubmitButton
            label={editing ? 'Save binder' : 'Create binder'}
          />
        </Stack>
      </Stack>
    </form.AppForm>
  );
};

export default NewBinderForm;
