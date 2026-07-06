import { AddressFieldGroup } from '#/components/AddressFieldGroup';
import {
  carrierStatus,
  carrierType,
  newCarrierFormOpts,
  type NewCarrierValues,
} from '#/constants/newCarrierForm';
import { GoogleMapsProvider } from '#/context/GoogleMapsContext';
import type { Tables, TablesInsert } from '#/data/database.types';
import type { EntityFormProps } from '#/data/entityForms';
import { useAppForm } from '#/hooks/form';
import { emptyToNull } from '#/lib/formCoerce';
import { supabase } from '#/supabaseClient';
import {
  Alert,
  Box,
  Button,
  Collapse,
  Grid,
  Skeleton,
  Stack,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { Suspense } from 'react';
import { toast } from 'sonner';

type CarrierRow = Tables<'carriers'>;
type CarrierInsert = TablesInsert<'carriers'>;

const str = (v: unknown): string => (v == null ? '' : String(v));

const toFormValues = (
  row: Record<string, unknown> | null | undefined,
  seed: Partial<NewCarrierValues> = {},
): NewCarrierValues => ({
  ...newCarrierFormOpts.defaultValues,
  ...(row
    ? {
        carrierName: str(row.carrier_name),
        naicNumber: str(row.naic_number),
        amBestRating: str(row.am_best_rating),
        carrierType: str(row.carrier_type),
        linesOfBusiness: str(row.lines_of_business),
        stateAdmitted: str(row.state_admitted),
        domicileState: str(row.domicile_state),
        contactName: str(row.contact_name),
        phone: str(row.phone),
        email: str(row.email),
        claimsPhone: str(row.claims_phone),
        country: str(row.country),
        status: str(row.status) || 'active',
        address: {
          addressLine1: str(row.address_line1),
          addressLine2: str(row.address_line2),
          city: str(row.city),
          state: str(row.state),
          postal: str(row.postal),
        },
      }
    : {}),
  ...seed,
});

const carrierTypeOptions = carrierType.options.map((v) => ({
  value: v,
  label: v,
}));
const statusOptions = carrierStatus.options.map((v) => ({
  value: v,
  label: v,
}));

export const NewCarrierForm = ({
  recordId,
  initialRow,
  defaultValues,
  onSaved,
  onCancel,
}: EntityFormProps) => {
  const editing = recordId != null;

  const { mutateAsync, isPending, error, isError } = useMutation({
    mutationFn: async (values: CarrierInsert) => {
      const q =
        recordId != null
          ? supabase.from('carriers').update(values).eq('id', recordId).select()
          : supabase.from('carriers').insert(values).select();
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data[0] as CarrierRow;
    },
    onSuccess: (row) => {
      toast.success(editing ? 'Carrier updated' : 'Carrier created', {
        id: 'carrier',
      });
      onSaved?.(row);
    },
    onError: (err) => toast.error(err.message, { id: 'carrier' }),
  });

  const form = useAppForm({
    ...newCarrierFormOpts,
    defaultValues: toFormValues(
      initialRow,
      defaultValues as Partial<NewCarrierValues>,
    ),
    onSubmit: async ({ value }) => {
      const row: CarrierInsert = {
        carrier_name: value.carrierName.trim(),
        naic_number: emptyToNull(value.naicNumber),
        am_best_rating: emptyToNull(value.amBestRating),
        carrier_type: emptyToNull(
          value.carrierType,
        ) as CarrierInsert['carrier_type'],
        lines_of_business: emptyToNull(value.linesOfBusiness),
        state_admitted: emptyToNull(value.stateAdmitted),
        domicile_state: emptyToNull(value.domicileState),
        contact_name: emptyToNull(value.contactName),
        phone: emptyToNull(value.phone),
        email: emptyToNull(value.email),
        claims_phone: emptyToNull(value.claimsPhone),
        country: emptyToNull(value.country),
        status: (emptyToNull(value.status) ??
          'active') as CarrierInsert['status'],
        address_line1: emptyToNull(value.address.addressLine1),
        address_line2: emptyToNull(value.address.addressLine2),
        city: emptyToNull(value.address.city),
        state: emptyToNull(value.address.state),
        postal: emptyToNull(value.address.postal),
      };
      await mutateAsync(row);
    },
  });

  return (
    <form.AppForm>
      <Stack direction='column' spacing={2}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 8 }}>
            <form.AppField name='carrierName'>
              {(field) => <field.TextField label='Carrier name' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <form.AppField name='naicNumber'>
              {(field) => <field.TextField label='NAIC #' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='carrierType'>
              {(field) => (
                <field.Select
                  label='Carrier type'
                  options={carrierTypeOptions}
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='amBestRating'>
              {(field) => <field.TextField label='AM Best rating' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <form.AppField name='status'>
              {(field) => (
                <field.Select label='Status' options={statusOptions} />
              )}
            </form.AppField>
          </Grid>
          <Grid size={12}>
            <form.AppField name='linesOfBusiness'>
              {(field) => (
                <field.TextField
                  label='Lines of business'
                  helperText='Comma-separated LOB codes'
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 8 }}>
            <form.AppField name='stateAdmitted'>
              {(field) => <field.TextField label='States admitted' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <form.AppField name='domicileState'>
              {(field) => (
                <field.TextField
                  label='Domicile state'
                  slotProps={{
                    htmlInput: {
                      maxLength: 2,
                      style: { textTransform: 'uppercase' },
                    },
                  }}
                />
              )}
            </form.AppField>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='contactName'>
              {(field) => <field.TextField label='Contact name' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='email'>
              {(field) => <field.TextField label='Email' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='phone'>
              {(field) => <field.MaskInput label='Phone' size='small' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='claimsPhone'>
              {(field) => <field.MaskInput label='Claims phone' />}
            </form.AppField>
          </Grid>
        </Grid>

        <Suspense fallback={<Skeleton variant='rounded' height={40} />}>
          <GoogleMapsProvider>
            <AddressFieldGroup
              form={form}
              fields='address'
              spacing={2}
              rowSpacing={undefined}
              columnSpacing={undefined}
              inputSize='small'
            />
          </GoogleMapsProvider>
        </Suspense>

        <Box>
          <form.AppField name='country'>
            {(field) => <field.TextField label='Country' />}
          </form.AppField>
        </Box>

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
            label={editing ? 'Save carrier' : 'Create carrier'}
          />
        </Stack>
      </Stack>
    </form.AppForm>
  );
};

export default NewCarrierForm;
