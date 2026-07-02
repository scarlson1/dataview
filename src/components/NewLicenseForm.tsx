import { NewAgencyForm } from '#/components/NewAgencyForm';
import {
  licenseType,
  type NewLicenseValues,
  newLicenseFormOpts,
} from '#/constants/newLicenseForm';
import { US_STATES } from '#/constants/usStates';
import type { Tables, TablesInsert } from '#/data/database.types';
import type { EntityFormProps } from '#/data/entityForms';
import { useAppForm } from '#/hooks/form';
import { emptyToNull, toDateStr } from '#/lib/formCoerce';
import { supabase } from '#/supabaseClient';
import { Alert, Box, Button, Collapse, Grid, Skeleton, Stack } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Suspense } from 'react';
import { toast } from 'sonner';

type LicenseRow = Tables<'license'>;
type LicenseInsert = TablesInsert<'license'>;

const stateOptions = US_STATES.map((s) => ({ value: s.code, label: s.name }));
const licenseTypeOptions = licenseType.options.map((v) => ({
  value: v,
  label: v,
}));

const str = (v: unknown): string => (v == null ? '' : String(v));

const toFormValues = (
  row: Record<string, unknown> | null | undefined,
  seed: Partial<NewLicenseValues> = {},
): NewLicenseValues => ({
  ...newLicenseFormOpts.defaultValues,
  ...(row
    ? {
        agentId: (row.agent_id as number) ?? (null as unknown as number),
        licenseType: str(row.license_type),
        state: str(row.state),
        licenseNumber: str(row.license_number),
        effDate: row.eff_date ? dayjs(str(row.eff_date)) : null,
        expDate: row.exp_date ? dayjs(str(row.exp_date)) : null,
        defaultSlLicensee: Boolean(row.default_sl_licensee),
        notes: str(row.notes),
      }
    : {}),
  ...seed,
});

export const NewLicenseForm = ({
  recordId,
  initialRow,
  defaultValues,
  onSaved,
  onCancel,
}: EntityFormProps) => {
  const editing = recordId != null;

  const { mutateAsync, isPending, error, isError } = useMutation({
    mutationFn: async (values: LicenseInsert) => {
      const q =
        recordId != null
          ? supabase.from('license').update(values).eq('id', recordId).select()
          : supabase.from('license').insert(values).select();
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data[0] as LicenseRow;
    },
    onSuccess: (row) => {
      toast.success(editing ? 'License updated' : 'License created', {
        id: 'license',
      });
      onSaved?.(row);
    },
    onError: (err) => toast.error(err.message, { id: 'license' }),
  });

  const form = useAppForm({
    ...newLicenseFormOpts,
    defaultValues: toFormValues(
      initialRow,
      defaultValues as Partial<NewLicenseValues>,
    ),
    onSubmit: async ({ value }) => {
      const row: LicenseInsert = {
        agent_id: value.agentId,
        license_type: value.licenseType.trim(),
        state: value.state.trim().toUpperCase(),
        license_number: value.licenseNumber.trim(),
        eff_date: toDateStr(value.effDate) ?? '',
        exp_date: toDateStr(value.expDate) ?? '',
        default_sl_licensee: value.defaultSlLicensee,
        notes: emptyToNull(value.notes),
      };
      await mutateAsync(row);
    },
  });

  return (
    <form.AppForm>
      <Stack direction='column' spacing={2} sx={{ p: 3 }}>
        <form.AppField name='agentId'>
          {(field) => (
            <field.EntitySelect
              label='Agency / licensee'
              table='agencies'
              searchColumns={['entity_name', 'last_name', 'first_name']}
              getOptionLabel={(r) =>
                (r.display_name as string) || `Agent #${r.id}`
              }
              renderCreateForm={({ defaultName, onCreated, onCancel }) => (
                <NewAgencyForm
                  defaultValues={{ entityName: defaultName }}
                  onCreated={onCreated}
                  onCancel={onCancel}
                />
              )}
            />
          )}
        </form.AppField>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='licenseType'>
              {(field) => (
                <field.Select label='License type' options={licenseTypeOptions} />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='state'>
              {(field) => <field.Select label='State' options={stateOptions} />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='licenseNumber'>
              {(field) => <field.TextField label='License #' />}
            </form.AppField>
          </Grid>
          <Grid size={6}>
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
          <Grid size={6}>
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
        </Grid>

        <Box>
          <form.AppField name='defaultSlLicensee'>
            {(field) => (
              <field.Checkbox label='Default surplus-lines licensee for this agency + state' />
            )}
          </form.AppField>
        </Box>

        <form.AppField name='notes'>
          {(field) => <field.TextField label='Notes' multiline minRows={2} />}
        </form.AppField>

        <Collapse in={isError}>
          <Alert severity='error'>{error?.message ?? 'An error occurred'}</Alert>
        </Collapse>

        <Stack direction='row' spacing={2}>
          {onCancel && (
            <Button disabled={isPending} onClick={onCancel}>
              Cancel
            </Button>
          )}
          <form.SubmitButton label={editing ? 'Save license' : 'Create license'} />
        </Stack>
      </Stack>
    </form.AppForm>
  );
};

export default NewLicenseForm;
