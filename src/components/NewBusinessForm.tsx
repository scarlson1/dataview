import { newBusinessFormOpts } from '#/constants/newBusinessForm';
import { withForm } from '#/hooks/form';
import { Grid } from '@mui/material';

// TODO: autocomplete client name from database

export const NewBusinessForm = withForm({
  ...newBusinessFormOpts,
  props: {
    spacing: 2,
    rowSpacing: undefined as number | undefined,
    columnSpacing: undefined as number | undefined,
  },
  render: function Render({ form, spacing }) {
    return (
      <Grid container spacing={spacing}>
        <Grid size={12}>
          <form.AppField
            name='companyName'
            children={(field) => <field.TextField label='Name' />}
          />
        </Grid>
      </Grid>
    );
  },
});
