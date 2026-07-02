import {
  DEDUCTIBLE_TYPES,
  type NewAirExposureValues,
  airExposureStatus,
  newAirExposureFormOpts,
} from '#/constants/newAirExposureForm';
import type { Tables, TablesInsert } from '#/data/database.types';
import type { EntityFormProps } from '#/data/entityForms';
import { useAppForm } from '#/hooks/form';
import { emptyToNull, toNumber } from '#/lib/formCoerce';
import { supabase } from '#/supabaseClient';
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

type AirRow = Tables<'air_exposure'>;
type AirInsert = TablesInsert<'air_exposure'>;

const str = (v: unknown): string => (v == null ? '' : String(v));
const statusOptions = airExposureStatus.options.map((v) => ({ value: v, label: v }));
const deductibleOptions = DEDUCTIBLE_TYPES.map((v) => ({ value: v, label: v }));

const SectionLabel = ({ children }: { children: string }) => (
  <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
    {children}
  </Typography>
);

const toFormValues = (
  row: Record<string, unknown> | null | undefined,
  seed: Partial<NewAirExposureValues> = {},
): NewAirExposureValues => ({
  ...newAirExposureFormOpts.defaultValues,
  ...(row
    ? {
        policyId: (row.policy_id as number) ?? null,
        clientId: (row.client_id as number) ?? null,
        certificateRef: str(row.certificate_ref),
        locationId: str(row.location_id),
        locationName: str(row.location_name),
        streetAddress: str(row.street_address),
        city: str(row.city),
        state: str(row.state),
        zipCode: str(row.zip_code),
        county: str(row.county),
        latitude: str(row.latitude),
        longitude: str(row.longitude),
        geocodeQuality: str(row.geocode_quality),
        numberOfBuildings: str(row.number_of_buildings),
        occupancyCode: str(row.occupancy_code),
        constructionCode: str(row.construction_code),
        buildingId: str(row.building_id),
        yearBuilt: str(row.year_built),
        numStoreys: str(row.num_storeys),
        grossFloorArea: str(row.gross_floor_area),
        primaryConstructionClass: str(row.primary_construction_class),
        roofType: str(row.roof_type),
        roofShape: str(row.roof_shape),
        foundationType: str(row.foundation_type),
        seismicDesignLevel: str(row.seismic_design_level),
        windSpeedDesign: str(row.wind_speed_design),
        fireProtectionClass: str(row.fire_protection_class),
        sprinkler: Boolean(row.sprinkler),
        unitRef: str(row.unit_ref),
        unitFloorLevel: str(row.unit_floor_level),
        unitGrossArea: str(row.unit_gross_area),
        unitOccupancyDesc: str(row.unit_occupancy_desc),
        buildingReplacementValue: str(row.building_replacement_value),
        contentsValue: str(row.contents_value),
        businessInterruptionValue: str(row.business_interruption_value),
        deductibleAmount: str(row.deductible_amount),
        deductibleType: str(row.deductible_type),
        policyLimit: str(row.policy_limit),
        status: str(row.status) || 'active',
        notes: str(row.notes),
      }
    : {}),
  ...seed,
});

export const NewAirExposureForm = ({
  recordId,
  initialRow,
  defaultValues,
  onSaved,
  onCancel,
}: EntityFormProps) => {
  const editing = recordId != null;

  const { mutateAsync, isPending, error, isError } = useMutation({
    mutationFn: async (values: AirInsert) => {
      const q =
        recordId != null
          ? supabase.from('air_exposure').update(values).eq('id', recordId).select()
          : supabase.from('air_exposure').insert(values).select();
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data[0] as AirRow;
    },
    onSuccess: (row) => {
      toast.success(editing ? 'Exposure updated' : 'Exposure created', { id: 'air' });
      onSaved?.(row);
    },
    onError: (err) => toast.error(err.message, { id: 'air' }),
  });

  const form = useAppForm({
    ...newAirExposureFormOpts,
    defaultValues: toFormValues(initialRow, defaultValues as Partial<NewAirExposureValues>),
    onSubmit: async ({ value }) => {
      const row: AirInsert = {
        policy_id: value.policyId ?? null,
        client_id: value.clientId ?? null,
        certificate_ref: emptyToNull(value.certificateRef),
        location_id: emptyToNull(value.locationId),
        location_name: emptyToNull(value.locationName),
        street_address: emptyToNull(value.streetAddress),
        city: emptyToNull(value.city),
        state: emptyToNull(value.state),
        zip_code: emptyToNull(value.zipCode),
        county: emptyToNull(value.county),
        latitude: toNumber(value.latitude),
        longitude: toNumber(value.longitude),
        geocode_quality: toNumber(value.geocodeQuality),
        number_of_buildings: toNumber(value.numberOfBuildings),
        occupancy_code: emptyToNull(value.occupancyCode),
        construction_code: emptyToNull(value.constructionCode),
        building_id: emptyToNull(value.buildingId),
        year_built: toNumber(value.yearBuilt),
        num_storeys: toNumber(value.numStoreys),
        gross_floor_area: toNumber(value.grossFloorArea),
        primary_construction_class: emptyToNull(value.primaryConstructionClass),
        roof_type: emptyToNull(value.roofType),
        roof_shape: emptyToNull(value.roofShape),
        foundation_type: emptyToNull(value.foundationType),
        seismic_design_level: emptyToNull(value.seismicDesignLevel),
        wind_speed_design: emptyToNull(value.windSpeedDesign),
        fire_protection_class: toNumber(value.fireProtectionClass),
        sprinkler: value.sprinkler,
        unit_ref: emptyToNull(value.unitRef),
        unit_floor_level: emptyToNull(value.unitFloorLevel),
        unit_gross_area: toNumber(value.unitGrossArea),
        unit_occupancy_desc: emptyToNull(value.unitOccupancyDesc),
        building_replacement_value: toNumber(value.buildingReplacementValue) ?? 0,
        contents_value: toNumber(value.contentsValue) ?? 0,
        business_interruption_value: toNumber(value.businessInterruptionValue) ?? 0,
        deductible_amount: toNumber(value.deductibleAmount),
        deductible_type: emptyToNull(value.deductibleType),
        policy_limit: toNumber(value.policyLimit),
        status: (emptyToNull(value.status) ?? 'active') as AirInsert['status'],
        notes: emptyToNull(value.notes),
      };
      await mutateAsync(row);
    },
  });

  const money = (name: 'buildingReplacementValue' | 'contentsValue' | 'businessInterruptionValue' | 'deductibleAmount' | 'policyLimit', label: string) => (
    <form.AppField name={name}>
      {(field) => (
        <field.TextField
          label={label}
          slotProps={{
            input: { startAdornment: <InputAdornment position='start'>$</InputAdornment> },
            htmlInput: { inputMode: 'decimal' },
          }}
        />
      )}
    </form.AppField>
  );

  return (
    <form.AppForm>
      <Stack direction='column' spacing={2.5} sx={{ p: 3 }}>
        <SectionLabel>Policy linkage</SectionLabel>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='policyId'>
              {(field) => (
                <field.EntitySelect
                  label='Policy'
                  table='policies'
                  searchColumns={['pol_ref', 'policy_number', 'insured_name']}
                  getOptionLabel={(r) =>
                    [r.pol_ref, r.insured_name].filter(Boolean).join(' · ') || `Policy #${r.id}`
                  }
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='clientId'>
              {(field) => (
                <field.EntitySelect
                  label='Client'
                  table='clients'
                  searchColumns={['company_name', 'first_name', 'last_name']}
                  getOptionLabel={(r) =>
                    r.company_name || [r.first_name, r.last_name].filter(Boolean).join(' ') || `Client #${r.id}`
                  }
                />
              )}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='certificateRef'>
              {(field) => <field.TextField label='Certificate / policy number' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='status'>
              {(field) => <field.Select label='Status' options={statusOptions} />}
            </form.AppField>
          </Grid>
        </Grid>

        <Divider />
        <SectionLabel>Location</SectionLabel>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='locationId'>
              {(field) => <field.TextField label='Location ID' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 9 }}>
            <form.AppField name='locationName'>
              {(field) => <field.TextField label='Location name' />}
            </form.AppField>
          </Grid>
          <Grid size={12}>
            <form.AppField name='streetAddress'>
              {(field) => <field.TextField label='Street address' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 5 }}>
            <form.AppField name='city'>{(field) => <field.TextField label='City' />}</form.AppField>
          </Grid>
          <Grid size={{ xs: 4, sm: 2 }}>
            <form.AppField name='state'>
              {(field) => <field.TextField label='State' slotProps={{ htmlInput: { maxLength: 2 } }} />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 8, sm: 2 }}>
            <form.AppField name='zipCode'>{(field) => <field.TextField label='ZIP' />}</form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <form.AppField name='county'>{(field) => <field.TextField label='County' />}</form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='latitude'>
              {(field) => <field.TextField label='Latitude' slotProps={{ htmlInput: { inputMode: 'decimal' } }} />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='longitude'>
              {(field) => <field.TextField label='Longitude' slotProps={{ htmlInput: { inputMode: 'decimal' } }} />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='geocodeQuality'>
              {(field) => <field.TextField label='Geocode quality (1–5)' slotProps={{ htmlInput: { inputMode: 'numeric' } }} />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='numberOfBuildings'>
              {(field) => <field.TextField label='# buildings' slotProps={{ htmlInput: { inputMode: 'numeric' } }} />}
            </form.AppField>
          </Grid>
        </Grid>

        <Divider />
        <SectionLabel>Building & unit detail</SectionLabel>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='occupancyCode'>
              {(field) => <field.TextField label='AIR OCC code' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='constructionCode'>
              {(field) => <field.TextField label='AIR CCC code' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='buildingId'>{(field) => <field.TextField label='Building ID' />}</form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='yearBuilt'>
              {(field) => <field.TextField label='Year built' slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 4 } }} />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='numStoreys'>
              {(field) => <field.TextField label='Storeys' slotProps={{ htmlInput: { inputMode: 'numeric' } }} />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='grossFloorArea'>
              {(field) => <field.TextField label='Gross floor area (sq ft)' slotProps={{ htmlInput: { inputMode: 'numeric' } }} />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <form.AppField name='primaryConstructionClass'>
              {(field) => <field.TextField label='Primary construction class' />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='roofType'>{(field) => <field.TextField label='Roof type / covering' />}</form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='roofShape'>{(field) => <field.TextField label='Roof shape' />}</form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <form.AppField name='foundationType'>{(field) => <field.TextField label='Foundation type' />}</form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='seismicDesignLevel'>{(field) => <field.TextField label='Seismic design level' />}</form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='windSpeedDesign'>{(field) => <field.TextField label='Wind speed design (mph)' />}</form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <form.AppField name='fireProtectionClass'>
              {(field) => <field.TextField label='Fire protection class (1–10)' slotProps={{ htmlInput: { inputMode: 'numeric' } }} />}
            </form.AppField>
          </Grid>
          <Grid size={12}>
            <form.AppField name='sprinkler'>{(field) => <field.Checkbox label='Sprinklered' />}</form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='unitRef'>{(field) => <field.TextField label='Unit / suite ref' />}</form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='unitFloorLevel'>{(field) => <field.TextField label='Unit floor level' />}</form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='unitGrossArea'>
              {(field) => <field.TextField label='Unit area (sq ft)' slotProps={{ htmlInput: { inputMode: 'numeric' } }} />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <form.AppField name='unitOccupancyDesc'>{(field) => <field.TextField label='Unit occupancy' />}</form.AppField>
          </Grid>
        </Grid>

        <Divider />
        <SectionLabel>Insured values (TIV)</SectionLabel>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>{money('buildingReplacementValue', 'Building replacement value')}</Grid>
          <Grid size={{ xs: 12, sm: 4 }}>{money('contentsValue', 'Contents value')}</Grid>
          <Grid size={{ xs: 12, sm: 4 }}>{money('businessInterruptionValue', 'Business interruption value')}</Grid>
          <Grid size={{ xs: 12, sm: 4 }}>{money('deductibleAmount', 'Deductible amount')}</Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <form.AppField name='deductibleType'>
              {(field) => <field.Select label='Deductible type' options={deductibleOptions} />}
            </form.AppField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>{money('policyLimit', 'Policy limit applicable')}</Grid>
          <Grid size={12}>
            <form.AppField name='notes'>
              {(field) => <field.TextField label='AIR modeling notes' multiline minRows={2} />}
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
          <form.SubmitButton label={editing ? 'Save exposure' : 'Create exposure'} />
        </Stack>
      </Stack>
    </form.AppForm>
  );
};

export default NewAirExposureForm;
