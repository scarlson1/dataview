import { Grid } from '@mui/material';
import { withForm } from '#/hooks/form';

export const ClientDetailsForm = withForm({
  defaultValues: {
    companyName: '',
    clientType: '',
    firstName: '',
    lastName: '',
  },
  // // Optional, but adds props to the `render` function in addition to `form`
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
            name='companyName'
            children={(field) => <field.TextField label='Company Name' />}
          />
        </Grid>
        <Grid size={4}>
          <form.AppField
            name='clientType'
            children={(field) => <field.TextField label='Client Type' />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <form.AppField
            name='firstName'
            children={(field) => <field.TextField label='First Name' />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <form.AppField
            name='lastName'
            children={(field) => <field.TextField label='Last Name' />}
          />
        </Grid>
      </Grid>
    );
  },
});
