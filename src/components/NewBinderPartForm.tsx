import {
  binderPartStatus,
  type NewBinderPartValues,
  newBinderPartFormOpts,
  participantType,
} from '#/constants/newBinderPartForm';
import type { Tables, TablesInsert } from '#/data/database.types';
import type { EntityFormProps } from '#/data/entityForms';
import { useAppForm } from '#/hooks/form';
import { decimalToPct, emptyToNull, pctToDecimal } from '#/lib/formCoerce';
import { supabase } from '#/supabaseClient';
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

type PartRow = Tables<'binder_part'>;
type PartInsert = TablesInsert<'binder_part'>;

const str = (v: unknown): string => (v == null ? '' : String(v));
const typeOptions = participantType.options.map((v) => ({
  value: v,
  label: v.replace(/_/g, ' '),
}));
const statusOptions = binderPartStatus.options.map((v) => ({
  value: v,
  label: v,
}));

const toFormValues = (
  row: Record<string, unknown> | null | undefined,
  seed: Partial<NewBinderPartValues> = {},
): NewBinderPartValues => ({
  ...newBinderPartFormOpts.defaultValues,
  ...(row
    ? {
        sectId: (row.sect_id as number) ?? (null as unknown as number),
        participantName: str(row.participant_name),
        participantType: str(row.participant_type),
        syndicateEntityNumber: str(row.syndicate_entity_number),
        participationPct: decimalToPct(row.participation_pct as number | null),
        status: str(row.status) || 'active',
        notes: str(row.notes),
      }
    : {}),
  ...seed,
});

export const NewBinderPartForm = ({
  recordId,
  initialRow,
  defaultValues,
  onSaved,
  onCancel,
}: EntityFormProps) => {
  const editing = recordId != null;

  const { mutateAsync, isPending, error, isError } = useMutation({
    mutationFn: async (values: PartInsert) => {
      const q =
        recordId != null
          ? supabase.from('binder_part').update(values).eq('id', recordId).select()
          : supabase.from('binder_part').insert(values).select();
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data[0] as PartRow;
    },
    onSuccess: (row) => {
      toast.success(editing ? 'Participant updated' : 'Participant added', {
        id: 'binder-part',
      });
      onSaved?.(row);
    },
    onError: (err) => toast.error(err.message, { id: 'binder-part' }),
  });

  const form = useAppForm({
    ...newBinderPartFormOpts,
    defaultValues: toFormValues(
      initialRow,
      defaultValues as Partial<NewBinderPartValues>,
    ),
    onSubmit: async ({ value }) => {
      const row: PartInsert = {
        sect_id: value.sectId,
        participant_name: value.participantName.trim(),
        participant_type: value.participantType as PartInsert['participant_type'],
        syndicate_entity_number: emptyToNull(value.syndicateEntityNumber),
        participation_pct: pctToDecimal(value.participationPct) ?? 0,
        status: (emptyToNull(value.status) ?? 'active') as PartInsert['status'],
        notes: emptyToNull(value.notes),
      };
      await mutateAsync(row);
    },
  });

  return (
    <form.AppForm>
      <Stack direction='column' spacing={2}>
        <form.AppField name='sectId'>
          {(field) => (
            <field.EntitySelect
              label='Binder section'
              table='binder_section'
              searchColumns={['section_display_name', 'sect_ref', 'section_number']}
              getOptionLabel={(r) =>
                [r.sect_ref, r.section_display_name].filter(Boolean).join(' · ') ||
                `Section #${r.id}`
              }
            />
          )}
        </form.AppField>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 7 }}>
            <form.AppField name='participantName'>
              {(field) => <field.TextField label='Participant name' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 5 }}>
            <form.AppField name='participantType'>
              {(field) => (
                <field.Select label='Participant type' options={typeOptions} />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='syndicateEntityNumber'>
              {(field) => <field.TextField label='Syndicate / entity #' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='participationPct'>
              {(field) => (
                <field.TextField
                  label='Participation'
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
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='status'>
              {(field) => <field.Select label='Status' options={statusOptions} />}
            </form.AppField>
          </Grid>
          <Grid size={12}>
            <form.AppField name='notes'>
              {(field) => <field.TextField label='Notes' multiline minRows={2} />}
            </form.AppField>
          </Grid>
        </Grid>

        <Collapse in={isError}>
          <Alert severity='error'>{error?.message ?? 'An error occurred'}</Alert>
        </Collapse>

        <Stack direction='row' spacing={2}>
          {onCancel && (
            <Button disabled={isPending} onClick={onCancel}>
              Cancel
            </Button>
          )}
          <form.SubmitButton
            label={editing ? 'Save participant' : 'Add participant'}
          />
        </Stack>
      </Stack>
    </form.AppForm>
  );
};

export default NewBinderPartForm;
