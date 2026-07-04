import {
  Alert,
  Button,
  Collapse,
  Divider,
  Grid,
  InputAdornment,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  EQUIPMENT_CATEGORIES,
  type NewAirEquipmentValues,
  newAirEquipmentFormOpts,
} from '#/constants/newAirEquipmentForm';
import type { Tables, TablesInsert } from '#/data/database.types';
import type { EntityFormProps } from '#/data/entityForms';
import { useAppForm } from '#/hooks/form';
import { emptyToNull, toNumber } from '#/lib/formCoerce';
import { supabase } from '#/supabaseClient';

type EqpRow = Tables<'air_equipment'>;
type EqpInsert = TablesInsert<'air_equipment'>;

const str = (v: unknown): string => (v == null ? '' : String(v));
const categoryOptions = EQUIPMENT_CATEGORIES.map((v) => ({
  value: v,
  label: v,
}));

const SectionLabel = ({ children }: { children: string }) => (
  <Typography
    sx={{
      fontSize: 12,
      fontWeight: 700,
      color: 'text.secondary',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}
  >
    {children}
  </Typography>
);

const toFormValues = (
  row: Record<string, unknown> | null | undefined,
  seed: Partial<NewAirEquipmentValues> = {},
): NewAirEquipmentValues => ({
  ...newAirEquipmentFormOpts.defaultValues,
  ...(row
    ? {
        exposureId: (row.exposure_id as number) ?? (null as unknown as number),
        equipmentCategory: str(row.equipment_category) || 'AI / GPU Compute',
        gpuManufacturer: str(row.gpu_manufacturer),
        gpuModel: str(row.gpu_model),
        gpuCount: str(row.gpu_count),
        gpuUnitAge: str(row.gpu_unit_age),
        gpuPurchaseDate: str(row.gpu_purchase_date),
        gpuUnitReplacementCost: str(row.gpu_unit_replacement_cost),
        serverRackCount: str(row.server_rack_count),
        serverReplacementCost: str(row.server_replacement_cost),
        supportingInfraValue: str(row.supporting_infra_value),
        powerDrawKw: str(row.power_draw_kw),
        coolingType: str(row.cooling_type),
        fireSuppressionSystem: str(row.fire_suppression_system),
        notes: str(row.notes),
      }
    : {}),
  ...seed,
});

export const NewAirEquipmentForm = ({
  recordId,
  initialRow,
  defaultValues,
  onSaved,
  onCancel,
}: EntityFormProps) => {
  const editing = recordId != null;

  const { mutateAsync, isPending, error, isError } = useMutation({
    mutationFn: async (values: EqpInsert) => {
      const q =
        recordId != null
          ? supabase
              .from('air_equipment')
              .update(values)
              .eq('id', recordId)
              .select()
          : supabase.from('air_equipment').insert(values).select();
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data[0] as EqpRow;
    },
    onSuccess: (row) => {
      toast.success(editing ? 'Equipment updated' : 'Equipment added', {
        id: 'air-eqp',
      });
      onSaved?.(row);
    },
    onError: (err) => toast.error(err.message, { id: 'air-eqp' }),
  });

  const form = useAppForm({
    ...newAirEquipmentFormOpts,
    defaultValues: toFormValues(
      initialRow,
      defaultValues as Partial<NewAirEquipmentValues>,
    ),
    onSubmit: async ({ value }) => {
      const row: EqpInsert = {
        exposure_id: value.exposureId,
        equipment_category: emptyToNull(value.equipmentCategory),
        gpu_manufacturer: emptyToNull(value.gpuManufacturer),
        gpu_model: emptyToNull(value.gpuModel),
        gpu_count: toNumber(value.gpuCount) ?? 0,
        gpu_unit_age: toNumber(value.gpuUnitAge),
        gpu_purchase_date: emptyToNull(value.gpuPurchaseDate),
        gpu_unit_replacement_cost: toNumber(value.gpuUnitReplacementCost) ?? 0,
        server_rack_count: toNumber(value.serverRackCount) ?? 0,
        server_replacement_cost: toNumber(value.serverReplacementCost) ?? 0,
        supporting_infra_value: toNumber(value.supportingInfraValue) ?? 0,
        power_draw_kw: toNumber(value.powerDrawKw),
        cooling_type: emptyToNull(value.coolingType),
        fire_suppression_system: emptyToNull(value.fireSuppressionSystem),
        notes: emptyToNull(value.notes),
      };
      await mutateAsync(row);
    },
  });

  const dollar = {
    input: {
      startAdornment: <InputAdornment position='start'>$</InputAdornment>,
    },
    htmlInput: { inputMode: 'decimal' as const },
  };
  const numeric = { htmlInput: { inputMode: 'numeric' as const } };

  return (
    <form.AppForm>
      <Stack direction='column' spacing={2.5}>
        <SectionLabel>Exposure link</SectionLabel>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 8 }}>
            <form.AppField name='exposureId'>
              {(field) => (
                <field.EntitySelect
                  label='AIR exposure'
                  table='air_exposure'
                  searchColumns={['air_ref', 'location_id', 'location_name']}
                  getOptionLabel={(r) =>
                    [r.air_ref, r.location_name].filter(Boolean).join(' · ') ||
                    `Exposure #${r.id}`
                  }
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <form.AppField name='equipmentCategory'>
              {(field) => (
                <field.Select label='Category' options={categoryOptions} />
              )}
            </form.AppField>
          </Grid>
        </Grid>

        <Divider />
        <SectionLabel>GPU schedule</SectionLabel>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='gpuManufacturer'>
              {(field) => <field.TextField label='Manufacturer' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='gpuModel'>
              {(field) => <field.TextField label='Model / chip series' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='gpuCount'>
              {(field) => (
                <field.TextField label='GPU count' slotProps={numeric} />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='gpuUnitAge'>
              {(field) => (
                <field.TextField label='Unit age (yrs)' slotProps={numeric} />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='gpuPurchaseDate'>
              {(field) => (
                <field.TextField
                  label='Purchase date'
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: {} }}
                  type='date'
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='gpuUnitReplacementCost'>
              {(field) => (
                <field.TextField
                  label='Unit replacement cost'
                  slotProps={dollar}
                />
              )}
            </form.AppField>
          </Grid>
        </Grid>

        <Divider />
        <SectionLabel>Servers & infrastructure</SectionLabel>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='serverRackCount'>
              {(field) => (
                <field.TextField
                  label='Server / rack count'
                  slotProps={numeric}
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='serverReplacementCost'>
              {(field) => (
                <field.TextField
                  label='Server cost / unit'
                  slotProps={dollar}
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='supportingInfraValue'>
              {(field) => (
                <field.TextField
                  label='Supporting infra (UPS/cooling)'
                  slotProps={dollar}
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='powerDrawKw'>
              {(field) => (
                <field.TextField label='Power draw (kW)' slotProps={numeric} />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='coolingType'>
              {(field) => <field.TextField label='Cooling type' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='fireSuppressionSystem'>
              {(field) => <field.TextField label='Fire suppression' />}
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
            label={editing ? 'Save equipment' : 'Add equipment'}
          />
        </Stack>
      </Stack>
    </form.AppForm>
  );
};

export default NewAirEquipmentForm;
