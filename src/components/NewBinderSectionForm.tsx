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
  binderSectionStatus,
  type NewBinderSectionValues,
  newBinderSectionFormOpts,
} from '#/constants/newBinderSectionForm';
import type { Tables, TablesInsert } from '#/data/database.types';
import type { EntityFormProps } from '#/data/entityForms';
import { useAppForm } from '#/hooks/form';
import {
  decimalToPct,
  emptyToNull,
  pctToDecimal,
  toNumber,
} from '#/lib/formCoerce';
import { supabase } from '#/supabaseClient';

type SectionRow = Tables<'binder_section'>;
type SectionInsert = TablesInsert<'binder_section'>;

const str = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): string => (v == null ? '' : String(v));
const statusOptions = binderSectionStatus.options.map((v) => ({
  value: v,
  label: v,
}));

const toFormValues = (
  row: Record<string, unknown> | null | undefined,
  seed: Partial<NewBinderSectionValues> = {},
): NewBinderSectionValues => ({
  ...newBinderSectionFormOpts.defaultValues,
  ...(row
    ? {
        binderId: (row.binder_id as number) ?? (null as unknown as number),
        sectionNumber: str(row.section_number),
        sectionDisplayName: str(row.section_display_name),
        sectionLimit: num(row.section_limit),
        sectionAttachment: num(row.section_attachment),
        lobCodes: str(row.lob_codes),
        participationPct: decimalToPct(row.participation_pct as number | null),
        status: str(row.status) || 'active',
        notes: str(row.notes),
      }
    : {}),
  ...seed,
});

export const NewBinderSectionForm = ({
  recordId,
  initialRow,
  defaultValues,
  onSaved,
  onCancel,
}: EntityFormProps) => {
  const editing = recordId != null;

  const { mutateAsync, isPending, error, isError } = useMutation({
    mutationFn: async (values: SectionInsert) => {
      const q =
        recordId != null
          ? supabase
              .from('binder_section')
              .update(values)
              .eq('id', recordId)
              .select()
          : supabase.from('binder_section').insert(values).select();
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data[0] as SectionRow;
    },
    onSuccess: (row) => {
      toast.success(editing ? 'Section updated' : 'Section created', {
        id: 'binder-section',
      });
      onSaved?.(row);
    },
    onError: (err) => toast.error(err.message, { id: 'binder-section' }),
  });

  const form = useAppForm({
    ...newBinderSectionFormOpts,
    defaultValues: toFormValues(
      initialRow,
      defaultValues as Partial<NewBinderSectionValues>,
    ),
    onSubmit: async ({ value }) => {
      const row: SectionInsert = {
        binder_id: value.binderId,
        section_number: value.sectionNumber.trim(),
        section_display_name: emptyToNull(value.sectionDisplayName),
        section_limit: toNumber(value.sectionLimit),
        section_attachment: toNumber(value.sectionAttachment),
        lob_codes: emptyToNull(value.lobCodes),
        participation_pct: pctToDecimal(value.participationPct) ?? 0,
        status: (emptyToNull(value.status) ??
          'active') as SectionInsert['status'],
        notes: emptyToNull(value.notes),
      };
      await mutateAsync(row);
    },
  });

  return (
    <form.AppForm>
      <Stack direction='column' spacing={2}>
        <form.AppField name='binderId'>
          {(field) => (
            <field.EntitySelect
              label='Binder'
              table='binder'
              searchColumns={['binder_number', 'bdr_ref']}
              getOptionLabel={(r) =>
                [r.bdr_ref, r.binder_number].filter(Boolean).join(' · ') ||
                `Binder #${r.id}`
              }
            />
          )}
        </form.AppField>

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='sectionNumber'>
              {(field) => <field.TextField label='Section #' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 9 }}>
            <form.AppField name='sectionDisplayName'>
              {(field) => <field.TextField label='Display name' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='sectionLimit'>
              {(field) => (
                <field.TextField
                  label='Section limit'
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
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='sectionAttachment'>
              {(field) => (
                <field.TextField
                  label='Attachment'
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
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='lobCodes'>
              {(field) => <field.TextField label='LOB codes' />}
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
              {(field) => (
                <field.Select label='Status' options={statusOptions} />
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
            label={editing ? 'Save section' : 'Create section'}
          />
        </Stack>
      </Stack>
    </form.AppForm>
  );
};

export default NewBinderSectionForm;
