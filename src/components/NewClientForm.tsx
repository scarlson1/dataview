import { AddressFieldGroup } from '#/components/AddressFieldGroup';
import { clientType, newClientFormOpts } from '#/constants/newClientForm';
import { useAppForm } from '#/hooks/form';
import { Grid, MenuItem, Stack } from '@mui/material';

export const NewClientForm = () => {
  const form = useAppForm({
    ...newClientFormOpts,
  });

  return (
    // <Box component='form' onSubmit={() => {}}>
    <form.AppForm>
      <Stack direction='column' spacing={2}>
        <Grid container spacing={2}>
          <Grid size={8}>
            <form.AppField
              name='companyName'
              children={(field) => <field.TextField label='Company name' />}
            />
          </Grid>
          <Grid size={4}>
            <form.AppField
              name='clientType'
              children={(field) => (
                <field.TextField label='Client type' select>
                  {clientType.options.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </field.TextField>
              )}
            />
          </Grid>
          <Grid size={8}>
            <form.AppField
              name='firstName'
              children={(field) => <field.TextField label='First name' />}
            />
          </Grid>
          <Grid size={4}>
            <form.AppField
              name='lastName'
              children={(field) => <field.TextField label='Last name' />}
            />
          </Grid>
        </Grid>
        <AddressFieldGroup
          form={form}
          fields='address'
          spacing={2}
          rowSpacing={undefined}
          columnSpacing={undefined}
        />
        <form.SubmitButton label='Create client' />
      </Stack>
    </form.AppForm>
  );
};
