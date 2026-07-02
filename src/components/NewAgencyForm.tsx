import { AddressFieldGroup } from '#/components/AddressFieldGroup';
import {
  agentLevel,
  billingEntity,
  licenseeType,
  newAgencyFormOpts,
  type NewAgencyValues,
} from '#/constants/newAgentForm';
import type { Tables, TablesInsert } from '#/data/database.types';
import { useAppForm } from '#/hooks/form';
import { supabase } from '#/supabaseClient';
import { Alert, Button, Collapse, Grid, MenuItem, Stack } from '@mui/material';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';

type AgencyRowInsert = TablesInsert<'agencies'>;
type AgencyRow = Tables<'agencies'>;

interface NewAgencyFormProps {
  defaultValues?: Partial<NewAgencyValues>;
  onCreated?: (row: AgencyRow) => void;
  onCancel?: () => void;
}

export const NewAgencyForm = ({
  defaultValues = {},
  onCreated,
  onCancel,
}: NewAgencyFormProps) => {
  const { data: agencies } = useSuspenseQuery({
    queryKey: ['agencies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agencies_with_status')
        .select('id::text, display_name')
        .eq('status', 'active');

      if (error) return [];
      return data;
    },
  });

  const { mutateAsync, error, isError, isPending } = useMutation({
    mutationFn: async (values: AgencyRowInsert) => {
      const { data, error } = await supabase
        .from('agencies')
        .upsert(values) // onConflict requires unique key constraint
        .select(); // , { onConflict: 'entity_name, first_name, last_name' }
      // "The Target Must Have an Index: The column(s) specified in onConflict must have a UNIQUE constraint or a unique index configured"

      if (error) throw new Error(error.message);
      // const row = data[0]
      // if (!row) throw new Error('upsert succeeded, failed to return data')
      return data[0] as AgencyRow;
    },
    onSuccess: (data) => {
      if (onCreated) onCreated(data);
    },
    // onError: () => {},
  });

  const form = useAppForm({
    ...newAgencyFormOpts,
    defaultValues: {
      ...newAgencyFormOpts.defaultValues,
      ...defaultValues,
    },
    onSubmit: async ({ value }) => {
      try {
        const agency: AgencyRowInsert = {
          entity_name: value.entityName,
          agency_level: value.agentLevel,
          licensee_type: value.licenseeType,
          first_name: value.firstName,
          last_name: value.lastName,
          parent_id: value.parentAgencyId ? Number(value.parentAgencyId) : null,
          billing_entity: value.billingEntity,
          email: value.email,
          phone: value.phone,
          address_line1: value.address.addressLine1,
          address_line2: value.address.addressLine2,
          city: value.address.city,
          state: value.address.state,
          postal: value.address.postal,
        };

        await mutateAsync(agency);
      } catch (err) {
        console.log(err);
      }
    },
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
        <Collapse in={isError}>
          <Alert severity='error'>
            {error?.message ?? 'An error occurred'}
          </Alert>
        </Collapse>
        <Stack direction='row' spacing={2}>
          {onCancel ? (
            <Button disabled={isPending} onClick={() => onCancel()}>
              Cancel
            </Button>
          ) : null}

          <form.SubmitButton label='Create client' />
        </Stack>
      </Stack>
    </form.AppForm>
  );
};
