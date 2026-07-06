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
  type NewPaymentValues,
  newPaymentFormOpts,
  paymentMethod,
  paymentStatus,
} from '#/constants/newPaymentForm';
import type { Tables, TablesInsert } from '#/data/database.types';
import type { EntityFormProps } from '#/data/entityForms';
import { useAppForm } from '#/hooks/form';
import { emptyToNull, toDateStr, toNumber } from '#/lib/formCoerce';
import { supabase } from '#/supabaseClient';

type PaymentRow = Tables<'payments'>;
type PaymentInsert = TablesInsert<'payments'>;

const str = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): string => (v == null ? '' : String(v));
const methodOptions = paymentMethod.options.map((v) => ({
  value: v,
  label: v.replace(/_/g, ' '),
}));
const statusOptions = paymentStatus.options.map((v) => ({
  value: v,
  label: v,
}));

const toFormValues = (
  row: Record<string, unknown> | null | undefined,
  seed: Partial<NewPaymentValues> = {},
): NewPaymentValues => ({
  ...newPaymentFormOpts.defaultValues,
  ...(row
    ? {
        policyId: (row.policy_id as number) ?? (null as unknown as number),
        clientId: (row.client_id as number) ?? (null as unknown as number),
        dueDate: row.due_date ? dayjs(str(row.due_date)) : null,
        paymentDate: row.payment_date ? dayjs(str(row.payment_date)) : null,
        amountDue: num(row.amount_due),
        amountPaid: num(row.amount_paid),
        paymentMethod: str(row.payment_method),
        invoiceNumber: str(row.invoice_number),
        status: str(row.status) || 'outstanding',
      }
    : {}),
  ...seed,
});

export const NewPaymentForm = ({
  recordId,
  initialRow,
  defaultValues,
  onSaved,
  onCancel,
}: EntityFormProps) => {
  const editing = recordId != null;

  const { mutateAsync, isPending, error, isError } = useMutation({
    mutationFn: async (values: PaymentInsert) => {
      const q =
        recordId != null
          ? supabase.from('payments').update(values).eq('id', recordId).select()
          : supabase.from('payments').insert(values).select();
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data[0] as PaymentRow;
    },
    onSuccess: (row) => {
      toast.success(editing ? 'Payment updated' : 'Payment created', {
        id: 'payment',
      });
      onSaved?.(row);
    },
    onError: (err) => toast.error(err.message, { id: 'payment' }),
  });

  const form = useAppForm({
    ...newPaymentFormOpts,
    defaultValues: toFormValues(
      initialRow,
      defaultValues as Partial<NewPaymentValues>,
    ),
    onSubmit: async ({ value }) => {
      const row: PaymentInsert = {
        policy_id: value.policyId,
        client_id: value.clientId,
        due_date: toDateStr(value.dueDate) ?? '',
        payment_date: toDateStr(value.paymentDate),
        amount_due: toNumber(value.amountDue) ?? 0,
        amount_paid: toNumber(value.amountPaid),
        payment_method: emptyToNull(
          value.paymentMethod,
        ) as PaymentInsert['payment_method'],
        invoice_number: emptyToNull(value.invoiceNumber),
        status: (emptyToNull(value.status) ??
          'outstanding') as PaymentInsert['status'],
      };
      await mutateAsync(row);
    },
  });

  return (
    <form.AppForm>
      <Stack direction='column' spacing={2}>
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
                if (r?.client_id != null)
                  form.setFieldValue('clientId', r.client_id as number);
              }}
            />
          )}
        </form.AppField>

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

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Suspense fallback={<Skeleton variant='rounded' height={40} />}>
              <form.AppField name='dueDate'>
                {({ DatePicker }) => (
                  <DatePicker
                    label='Due date'
                    slotProps={{ textField: { size: 'small' } }}
                  />
                )}
              </form.AppField>
            </Suspense>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Suspense fallback={<Skeleton variant='rounded' height={40} />}>
              <form.AppField name='paymentDate'>
                {({ DatePicker }) => (
                  <DatePicker
                    label='Payment date'
                    slotProps={{ textField: { size: 'small' } }}
                  />
                )}
              </form.AppField>
            </Suspense>
          </Grid>
          <Grid size={{ xs: 6, sm: 6 }}>
            <form.AppField name='amountDue'>
              {(field) => (
                <field.TextField
                  label='Amount due'
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
            <form.AppField name='amountPaid'>
              {(field) => (
                <field.TextField
                  label='Amount paid'
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
          <Grid size={{ xs: 12, sm: 4 }}>
            <form.AppField name='paymentMethod'>
              {(field) => (
                <field.Select label='Method' options={methodOptions} />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <form.AppField name='status'>
              {(field) => (
                <field.Select label='Status' options={statusOptions} />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <form.AppField name='invoiceNumber'>
              {(field) => <field.TextField label='Invoice #' />}
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
            label={editing ? 'Save payment' : 'Create payment'}
          />
        </Stack>
      </Stack>
    </form.AppForm>
  );
};

export default NewPaymentForm;
