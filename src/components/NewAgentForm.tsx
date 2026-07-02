import { AddressFieldGroup } from '#/components/AddressFieldGroup';
import {
  agentLevel,
  billingEntity,
  licenseeType,
  newAgencyFormOpts,
} from '#/constants/newAgentForm';
import { useAppForm } from '#/hooks/form';
import { supabase } from '#/supabaseClient';
import { Grid, MenuItem, Stack } from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';

export const NewAgentForm = () => {
  const { data: agencies } = useSuspenseQuery({
    queryKey: ['agencies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agencies_with_status')
        .select('id::text, display_name')
        .eq('status', 'active');

      if (error) return;
      return data;
    },
  });

  const form = useAppForm({
    ...newAgencyFormOpts,
  });

  return (
    // <Box component='form' onSubmit={() => {}}>
    <form.AppForm>
      <Stack direction='column' spacing={2}>
        <Grid container spacing={2}>
          <Grid size={6}>
            <form.AppField
              name='agentLevel'
              children={(field) => (
                <field.TextField label='Agent level' select>
                  <MenuItem value=''>
                    <em>None</em>
                  </MenuItem>
                  {agentLevel.options.map((o) => (
                    <MenuItem key={o} value={o}>
                      {o}
                    </MenuItem>
                  ))}
                </field.TextField>
              )}
            />
          </Grid>
          <Grid size={6}>
            <form.AppField
              name='licenseeType'
              children={(field) => (
                <field.TextField label='Licensee type' select>
                  <MenuItem value=''>
                    <em>None</em>
                  </MenuItem>
                  {licenseeType.options.map((o) => (
                    <MenuItem key={o} value={o}>
                      {o}
                    </MenuItem>
                  ))}
                </field.TextField>
              )}
            />
          </Grid>
          <Grid size={12}>
            <form.AppField
              name='entityName'
              children={(field) => <field.TextField label='Entity name' />}
            />
          </Grid>
          <Grid size={12}>
            <form.AppField
              name='firstName'
              children={(field) => <field.TextField label='First name' />}
            />
          </Grid>
          <Grid size={12}>
            <form.AppField
              name='lastName'
              children={(field) => <field.TextField label='Last name' />}
            />
          </Grid>

          <Grid size={4}>
            <form.AppField
              name='parentAgencyId'
              children={(field) => (
                <field.TextField label='Parent agency' select>
                  <MenuItem value=''>
                    <em>None</em>
                  </MenuItem>
                  {agencies?.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.display_name}
                    </MenuItem>
                  ))}
                </field.TextField>
              )}
            />
          </Grid>
          <Grid size={4}>
            <form.AppField
              name='billingEntity'
              children={(field) => (
                <field.TextField label='Billing entity' select>
                  <MenuItem value=''>
                    <em>None</em>
                  </MenuItem>
                  {billingEntity.options.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </field.TextField>
              )}
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
