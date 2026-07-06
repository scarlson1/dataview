import {
  Alert,
  Button,
  Collapse,
  Grid,
  InputAdornment,
  Stack,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  MONTHS,
  type NewBudgetTargetValues,
  newBudgetTargetFormOpts,
} from '#/constants/newBudgetTargetForm';
import type { Tables, TablesInsert } from '#/data/database.types';
import type { EntityFormProps } from '#/data/entityForms';
import { useAppForm } from '#/hooks/form';
import { emptyToNull, toNumber } from '#/lib/formCoerce';
import { supabase } from '#/supabaseClient';

type BudgetRow = Tables<'budget_targets'>;
type BudgetInsert = TablesInsert<'budget_targets'>;

const str = (v: unknown): string => (v == null ? '' : String(v));
const monthOptions = MONTHS.map((m, i) => ({ value: String(i + 1), label: m }));

const toFormValues = (
  row: Record<string, unknown> | null | undefined,
  seed: Partial<NewBudgetTargetValues> = {},
): NewBudgetTargetValues => ({
  ...newBudgetTargetFormOpts.defaultValues,
  ...(row
    ? {
        year: str(row.year),
        month: str(row.month) || '1',
        lineOfBusiness: str(row.line_of_business),
        gwpTarget: str(row.gwp_target),
        notes: str(row.notes),
      }
    : {}),
  ...seed,
});

export const NewBudgetTargetForm = ({
  recordId,
  initialRow,
  defaultValues,
  onSaved,
  onCancel,
}: EntityFormProps) => {
  const editing = recordId != null;

  const { mutateAsync, isPending, error, isError } = useMutation({
    mutationFn: async (values: BudgetInsert) => {
      const q =
        recordId != null
          ? supabase
              .from('budget_targets')
              .update(values)
              .eq('id', recordId)
              .select()
          : supabase.from('budget_targets').insert(values).select();
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data[0] as BudgetRow;
    },
    onSuccess: (row) => {
      toast.success(editing ? 'Target updated' : 'Target created', {
        id: 'budget',
      });
      onSaved?.(row);
    },
    onError: (err) => toast.error(err.message, { id: 'budget' }),
  });

  const form = useAppForm({
    ...newBudgetTargetFormOpts,
    defaultValues: toFormValues(
      initialRow,
      defaultValues as Partial<NewBudgetTargetValues>,
    ),
    onSubmit: async ({ value }) => {
      const row: BudgetInsert = {
        year: toNumber(value.year) ?? new Date().getFullYear(),
        month: toNumber(value.month) ?? 1,
        line_of_business: value.lineOfBusiness.trim(),
        gwp_target: toNumber(value.gwpTarget) ?? 0,
        notes: emptyToNull(value.notes),
      };
      await mutateAsync(row);
    },
  });

  return (
    <form.AppForm>
      <Stack direction='column' spacing={2}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='year'>
              {(field) => (
                <field.TextField
                  label='Year'
                  slotProps={{
                    htmlInput: { inputMode: 'numeric', maxLength: 4 },
                  }}
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 8 }}>
            <form.AppField name='month'>
              {(field) => <field.Select label='Month' options={monthOptions} />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='lineOfBusiness'>
              {(field) => <field.TextField label='Line of business' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='gwpTarget'>
              {(field) => (
                <field.TextField
                  label='GWP target'
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
            label={editing ? 'Save target' : 'Create target'}
          />
        </Stack>
      </Stack>
    </form.AppForm>
  );
};

export default NewBudgetTargetForm;
