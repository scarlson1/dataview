import {
  countryOptions,
  DROPDOWN_STATE_COUNTRIES,
} from '#/constants/countries';
import { stateOptions } from '#/constants/usStates';
import { withFieldGroup } from '#/hooks/form';
import { Grid } from '@mui/material';

export const AddressFieldGroup = withFieldGroup({
  // withForm({
  defaultValues: {
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postal: '',
    country: 'US',
  },
  props: {
    spacing: 2,
    rowSpacing: undefined as number | undefined,
    columnSpacing: undefined as number | undefined,
    inputSize: 'small' as 'small' | 'medium',
  },
  render: function Render({
    group,
    spacing,
    rowSpacing,
    columnSpacing,
    inputSize,
  }) {
    return (
      <Grid
        container
        spacing={spacing}
        rowSpacing={rowSpacing}
        columnSpacing={columnSpacing}
      >
        <Grid size={8}>
          <group.AppField
            name='addressLine1'
            children={(field) => (
              <field.AddressAutocomplete
                label='Address'
                // size={inputSize}
                onAddressSelect={(a) => {
                  field.handleChange(a.line1);
                  group.setFieldValue('city', a.city);
                  group.setFieldValue('state', a.state);
                  group.setFieldValue('postal', a.postal);
                  if (a.country) group.setFieldValue('country', a.country);
                }}
              />
            )}
          />
        </Grid>
        <Grid size={4}>
          <group.AppField
            name='addressLine2'
            children={(field) => (
              <field.TextField label='Address line 2' size={inputSize} />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <group.AppField
            name='city'
            children={(field) => (
              <field.TextField label='City' size={inputSize} />
            )}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          {/* State/Province: dropdown for countries with fixed subdivisions
              (US), free-text elsewhere. */}
          <group.Subscribe selector={(s) => s.values.country}>
            {(country) => (
              <group.AppField
                name='state'
                children={(field) =>
                  DROPDOWN_STATE_COUNTRIES.has(country) ? (
                    <field.Select
                      label='State / Province'
                      options={stateOptions}
                      size={inputSize}
                    />
                  ) : (
                    <field.TextField
                      label='State / Province'
                      size={inputSize}
                    />
                  )
                }
              />
            )}
          </group.Subscribe>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <group.AppField
            name='postal'
            children={(field) => (
              <field.TextField label='Postal / ZIP' size={inputSize} />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <group.AppField
            name='country'
            children={(field) => (
              <field.Select
                label='Country'
                options={countryOptions}
                size={inputSize}
              />
            )}
          />
        </Grid>
      </Grid>
    );
  },
});
