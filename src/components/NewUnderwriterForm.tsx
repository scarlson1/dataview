import {
  type NewUnderwriterValues,
  newUnderwriterFormOpts,
  underwriterStatus,
} from '#/constants/newUnderwriterForm';
import type { Tables, TablesInsert } from '#/data/database.types';
import type { EntityFormProps } from '#/data/entityForms';
import { useAppForm } from '#/hooks/form';
import { emptyToNull } from '#/lib/formCoerce';
import { supabase } from '#/supabaseClient';
import { Alert, Button, Collapse, Grid, Stack } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

type UwRow = Tables<'underwriters'>;
type UwInsert = TablesInsert<'underwriters'>;

const str = (v: unknown): string => (v == null ? '' : String(v));

const toFormValues = (
  row: Record<string, unknown> | null | undefined,
  seed: Partial<NewUnderwriterValues> = {},
): NewUnderwriterValues => ({
  ...newUnderwriterFormOpts.defaultValues,
  ...(row
    ? {
        firstName: str(row.first_name),
        lastName: str(row.last_name),
        titleRole: str(row.title_role),
        email: str(row.email),
        phone: str(row.phone),
        status: str(row.status) || 'active',
      }
    : {}),
  ...seed,
});

const statusOptions = underwriterStatus.options.map((v) => ({
  value: v,
  label: v.replace('_', ' '),
}));

export const NewUnderwriterForm = ({
  recordId,
  initialRow,
  defaultValues,
  onSaved,
  onCancel,
}: EntityFormProps) => {
  const editing = recordId != null;

  const { mutateAsync, isPending, error, isError } = useMutation({
    mutationFn: async (values: UwInsert) => {
      const q =
        recordId != null
          ? supabase
              .from('underwriters')
              .update(values)
              .eq('id', recordId)
              .select()
          : supabase.from('underwriters').insert(values).select();
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data[0] as UwRow;
    },
    onSuccess: (row) => {
      toast.success(editing ? 'Underwriter updated' : 'Underwriter created', {
        id: 'underwriter',
      });
      onSaved?.(row);
    },
    onError: (err) => toast.error(err.message, { id: 'underwriter' }),
  });

  const form = useAppForm({
    ...newUnderwriterFormOpts,
    defaultValues: toFormValues(
      initialRow,
      defaultValues as Partial<NewUnderwriterValues>,
    ),
    onSubmit: async ({ value }) => {
      const row: UwInsert = {
        first_name: value.firstName.trim(),
        last_name: value.lastName.trim(),
        title_role: emptyToNull(value.titleRole),
        email: emptyToNull(value.email),
        phone: emptyToNull(value.phone),
        status: (emptyToNull(value.status) ?? 'active') as UwInsert['status'],
      };
      await mutateAsync(row);
    },
  });

  return (
    <form.AppForm>
      <Stack direction='column' spacing={2}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='firstName'>
              {(field) => <field.TextField label='First name' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='lastName'>
              {(field) => <field.TextField label='Last name' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='titleRole'>
              {(field) => <field.TextField label='Title / role' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='status'>
              {(field) => (
                <field.Select label='Status' options={statusOptions} />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='email'>
              {(field) => <field.TextField label='Email' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='phone'>
              {(field) => <field.PhoneInput label='Phone' />}
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
            label={editing ? 'Save underwriter' : 'Create underwriter'}
          />
        </Stack>
      </Stack>
    </form.AppForm>
  );
};

export default NewUnderwriterForm;
