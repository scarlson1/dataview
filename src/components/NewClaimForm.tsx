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
import {
  claimStatus,
  type NewClaimValues,
  newClaimFormOpts,
} from '#/constants/newClaimForm';
import type { Tables, TablesInsert } from '#/data/database.types';
import type { EntityFormProps } from '#/data/entityForms';
import { useAppForm } from '#/hooks/form';
import { emptyToNull, toDateStr, toNumber } from '#/lib/formCoerce';
import { supabase } from '#/supabaseClient';

type ClaimRow = Tables<'claims'>;
type ClaimInsert = TablesInsert<'claims'>;

const str = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): string => (v == null ? '' : String(v));
const statusOptions = claimStatus.options.map((v) => ({ value: v, label: v }));

const toFormValues = (
  row: Record<string, unknown> | null | undefined,
  seed: Partial<NewClaimValues> = {},
): NewClaimValues => ({
  ...newClaimFormOpts.defaultValues,
  ...(row
    ? {
        policyId: (row.policy_id as number) ?? (null as unknown as number),
        clientId: (row.client_id as number) ?? (null as unknown as number),
        carrierId: (row.carrier_id as number) ?? (null as unknown as number),
        dateOfLoss: row.date_of_loss ? dayjs(str(row.date_of_loss)) : null,
        dateReported: row.date_reported ? dayjs(str(row.date_reported)) : null,
        lossType: str(row.loss_type),
        description: str(row.description),
        reserveAmt: num(row.reserve_amt),
        paidAmt: num(row.paid_amt),
        adjuster: str(row.adjuster),
        status: str(row.status) || 'open',
      }
    : {}),
  ...seed,
});

export const NewClaimForm = ({
  recordId,
  initialRow,
  defaultValues,
  onSaved,
  onCancel,
}: EntityFormProps) => {
  const editing = recordId != null;

  const { mutateAsync, isPending, error, isError } = useMutation({
    mutationFn: async (values: ClaimInsert) => {
      const q =
        recordId != null
          ? supabase.from('claims').update(values).eq('id', recordId).select()
          : supabase.from('claims').insert(values).select();
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data[0] as ClaimRow;
    },
    onSuccess: (row) => {
      toast.success(editing ? 'Claim updated' : 'Claim created', {
        id: 'claim',
      });
      onSaved?.(row);
    },
    onError: (err) => toast.error(err.message, { id: 'claim' }),
  });

  const form = useAppForm({
    ...newClaimFormOpts,
    defaultValues: toFormValues(
      initialRow,
      defaultValues as Partial<NewClaimValues>,
    ),
    onSubmit: async ({ value }) => {
      const row: ClaimInsert = {
        policy_id: value.policyId,
        client_id: value.clientId,
        carrier_id: value.carrierId,
        date_of_loss: toDateStr(value.dateOfLoss) ?? '',
        date_reported: toDateStr(value.dateReported) ?? '',
        loss_type: emptyToNull(value.lossType),
        description: emptyToNull(value.description),
        reserve_amt: toNumber(value.reserveAmt),
        paid_amt: toNumber(value.paidAmt),
        adjuster: emptyToNull(value.adjuster),
        status: (emptyToNull(value.status) ?? 'open') as ClaimInsert['status'],
      };
      await mutateAsync(row);
    },
  });

  return (
    <form.AppForm>
      <Stack direction='column' spacing={2}>
        {/* Policy — auto-fills client & carrier from the selected policy row */}
        <form.AppField name='policyId'>
          {(field) => (
            <field.EntitySelect
              label='Policy'
              table='policies_computed'
              searchColumns={['pol_ref', 'policy_number']}
              getOptionLabel={(r) =>
                [r.pol_ref, r.policy_number].filter(Boolean).join(' · ') ||
                `Policy #${r.id}`
              }
              onSelectRow={(r) => {
                if (r) {
                  if (r.client_id != null)
                    form.setFieldValue('clientId', r.client_id as number);
                  if (r.carrier_id != null)
                    form.setFieldValue('carrierId', r.carrier_id as number);
                }
              }}
            />
          )}
        </form.AppField>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='clientId'>
              {(field) => (
                <field.EntitySelect
                  label='Client'
                  table='clients'
                  searchColumns={['company_name', 'last_name', 'first_name']}
                  getOptionLabel={(r) =>
                    (r.company_name as string) ||
                    [r.first_name, r.last_name].filter(Boolean).join(' ') ||
                    `Client #${r.id}`
                  }
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='carrierId'>
              {(field) => (
                <field.EntitySelect
                  label='Carrier'
                  table='carriers'
                  searchColumns={['carrier_name']}
                  getOptionLabel={(r) =>
                    (r.carrier_name as string) || `Carrier #${r.id}`
                  }
                />
              )}
            </form.AppField>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Suspense fallback={<Skeleton variant='rounded' height={40} />}>
              <form.AppField name='dateOfLoss'>
                {({ DatePicker }) => (
                  <DatePicker
                    label='Date of loss'
                    slotProps={{ textField: { size: 'small' } }}
                  />
                )}
              </form.AppField>
            </Suspense>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Suspense fallback={<Skeleton variant='rounded' height={40} />}>
              <form.AppField name='dateReported'>
                {({ DatePicker }) => (
                  <DatePicker
                    label='Date reported'
                    slotProps={{ textField: { size: 'small' } }}
                  />
                )}
              </form.AppField>
            </Suspense>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='lossType'>
              {(field) => <field.TextField label='Loss type' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='status'>
              {(field) => (
                <field.Select label='Status' options={statusOptions} />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 6 }}>
            <form.AppField name='reserveAmt'>
              {(field) => (
                <field.TextField
                  label='Reserve'
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position='start'>$</InputAdornment>
                      ),
                    },
                    htmlInput: { inputMode: 'decimal' },
                  }}
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 6 }}>
            <form.AppField name='paidAmt'>
              {(field) => (
                <field.TextField
                  label='Paid'
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position='start'>$</InputAdornment>
                      ),
                    },
                    htmlInput: { inputMode: 'decimal' },
                  }}
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={12}>
            <form.AppField name='adjuster'>
              {(field) => <field.TextField label='Adjuster' />}
            </form.AppField>
          </Grid>
          <Grid size={12}>
            <form.AppField name='description'>
              {(field) => (
                <field.TextField label='Description' multiline minRows={2} />
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
          <form.SubmitButton label={editing ? 'Save claim' : 'Create claim'} />
        </Stack>
      </Stack>
    </form.AppForm>
  );
};

export default NewClaimForm;
