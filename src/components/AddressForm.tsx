import { withForm } from '#/hooks/form';
import { Grid } from '@mui/material';

export const AddressForm = withForm({
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
  render: function Render({ form, spacing, rowSpacing, columnSpacing }) {
    return (
      <Grid
        container
        spacing={spacing}
        rowSpacing={rowSpacing}
        columnSpacing={columnSpacing}
      >
        <Grid size={8}>
          <form.AppField
            name='addressLine1'
            children={(field) => <field.TextField label='Address Line 1' />}
          />
        </Grid>
        <Grid size={4}>
          <form.AppField
            name='addressLine2'
            children={(field) => <field.TextField label='Address Line 2' />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <form.AppField
            name='city'
            children={(field) => <field.TextField label='City' />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <form.AppField
            name='state'
            children={(field) => <field.TextField label='Last Name' />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <form.AppField
            name='postal'
            children={(field) => <field.TextField label='Last Name' />}
          />
        </Grid>
      </Grid>
    );
  },
});
