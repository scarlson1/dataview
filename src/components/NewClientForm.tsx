import { AddressFieldGroup } from '#/components/AddressFieldGroup';
import {
  clientType,
  newClientFormOpts,
  type NewClientValues,
} from '#/constants/newClientForm';
import type { Tables, TablesInsert } from '#/data/database.types';
import { useAppForm } from '#/hooks/form';
import { supabase } from '#/supabaseClient';
import { Alert, Button, Collapse, Grid, MenuItem, Stack } from '@mui/material';
import { useMutation } from '@tanstack/react-query';

type ClientRowInsert = TablesInsert<'clients'>;
type ClientRow = Tables<'clients'>;

interface NewClientFormProps {
  defaultValues?: Partial<NewClientValues>;
  onCreated?: (data: ClientRow) => void;
  onCancel?: () => void;
}

export const NewClientForm = ({
  defaultValues = {},
  onCreated,
  onCancel,
}: NewClientFormProps) => {
  const { mutateAsync, isPending, error, isError } = useMutation({
    mutationFn: async (values: ClientRowInsert) => {
      const { data, error } = await supabase
        .from('clients')
        .upsert(values)
        .select();
      if (error) throw new Error(error.message);
      return data[0] as ClientRow;
    },
    onSuccess: (data) => {
      if (onCreated) onCreated(data);
    },
    // onError: () => {},
  });

  const form = useAppForm({
    ...newClientFormOpts,
    defaultValues: {
      ...newClientFormOpts.defaultValues,
      ...defaultValues,
    },
    onSubmit: async ({ value }) => {
      try {
        const row: ClientRowInsert = {
          company_name: value.companyName,
          client_type: value.clientType as ClientRowInsert['client_type'],
          first_name: value.firstName,
          last_name: value.lastName,
          email: value.email,
          phone: value.phone,
          address_line1: value.address.addressLine1,
          address_line2: value.address.addressLine2,
          city: value.address.city,
          state: value.address.state,
          postal: value.address.postal,
          industry: '',
        };
        await mutateAsync(row);
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

        <Collapse in={isError}>
          <Alert severity='error'>
            {error?.message ?? 'An error occurred'}
          </Alert>
        </Collapse>

        <Stack direction='row' spacing={2}>
          <Button
            disabled={isPending}
            onClick={() => {
              if (onCancel) onCancel();
            }}
          >
            Cancel
          </Button>
          <form.SubmitButton label='Create client' />
        </Stack>
      </Stack>
    </form.AppForm>
  );
};
