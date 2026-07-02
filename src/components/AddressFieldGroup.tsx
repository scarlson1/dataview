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
  },
  props: {
    spacing: 2,
    rowSpacing: undefined as number | undefined,
    columnSpacing: undefined as number | undefined,
  },
  render: function Render({ group, spacing, rowSpacing, columnSpacing }) {
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
            children={(field) => <field.TextField label='Address line 1' />}
          />
        </Grid>
        <Grid size={4}>
          <group.AppField
            name='addressLine2'
            children={(field) => <field.TextField label='Address line 2' />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <group.AppField
            name='city'
            children={(field) => <field.TextField label='City' />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <group.AppField
            name='state'
            children={(field) => <field.TextField label='State' />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <group.AppField
            name='postal'
            children={(field) => <field.TextField label='Postal' />}
          />
        </Grid>
      </Grid>
    );
  },
});
