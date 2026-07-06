import { AddressFieldGroup } from '#/components/AddressFieldGroup';
import {
  clientType,
  newClientFormOpts,
  type NewClientValues,
} from '#/constants/newClientForm';
import type { Tables, TablesInsert } from '#/data/database.types';
import type { EntityFormProps } from '#/data/entityForms';
import { useAppForm } from '#/hooks/form';
import { supabase } from '#/supabaseClient';
import { Alert, Button, Collapse, Grid, Stack } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import type { ComponentType } from 'react';

type ClientRowInsert = TablesInsert<'clients'>;
type ClientRow = Tables<'clients'>;

interface NewClientFormProps {
  defaultValues?: Partial<NewClientValues>;
  recordId?: number;
  initialRow?: Record<string, unknown> | null;
  onCreated?: (data: ClientRow) => void;
  onSaved?: (data: ClientRow) => void;
  onCancel?: () => void;
}

const clientTypeOptions = clientType.options.map((c) => ({
  value: c,
  label: c,
}));

const clientStr = (v: unknown): string => (v == null ? '' : String(v));

const clientRowToValues = (
  row: Record<string, unknown> | null | undefined,
): Partial<NewClientValues> =>
  row
    ? ({
        companyName: clientStr(row.company_name),
        clientType: clientStr(row.client_type),
        firstName: clientStr(row.first_name),
        lastName: clientStr(row.last_name),
        email: clientStr(row.email),
        phone: clientStr(row.phone),
        address: {
          addressLine1: clientStr(row.address_line1),
          addressLine2: clientStr(row.address_line2),
          city: clientStr(row.city),
          state: clientStr(row.state),
          postal: clientStr(row.postal),
        },
      } as unknown as Partial<NewClientValues>)
    : {};

export const NewClientForm = ({
  defaultValues = {},
  recordId,
  initialRow,
  onCreated,
  onSaved,
  onCancel,
}: NewClientFormProps) => {
  const editing = recordId != null;
  const { mutateAsync, isPending, error, isError } = useMutation({
    mutationFn: async (values: ClientRowInsert) => {
      const q =
        recordId != null
          ? supabase.from('clients').update(values).eq('id', recordId).select()
          : supabase.from('clients').insert(values).select();
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data[0] as ClientRow;
    },
    onSuccess: (data) => {
      onCreated?.(data);
      onSaved?.(data);
    },
    // onError: () => {},
  });

  const form = useAppForm({
    ...newClientFormOpts,
    defaultValues: {
      ...newClientFormOpts.defaultValues,
      ...clientRowToValues(initialRow),
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
        return;
      } catch (err) {
        console.log(err);
      }
    },
  });

  return (
    <form.AppForm>
      <Stack direction='column' spacing={2}>
        <Grid container spacing={2}>
          <Grid size={12}>
            <form.AppField
              name='clientType'
              // children={(field) => (
              //   <field.TextField label='Client type' select size='small'>
              //     {clientType.options.map((option) => (
              //       <MenuItem key={option} value={option}>
              //         {option}
              //       </MenuItem>
              //     ))}
              //   </field.TextField>
              // )}
              children={(field) => (
                <field.ToggleButtonGroup
                  options={clientTypeOptions}
                  exclusive
                  label='Client type'
                  size='small'
                  color='primary'
                />
              )}
            />
          </Grid>

          <form.Subscribe
            selector={(state) => state.values.clientType}
            children={(clientType) =>
              clientType !== 'individual' ? (
                <Grid size={12}>
                  <form.AppField
                    name='companyName'
                    children={(field) => (
                      <field.TextField label='Company name' size='small' />
                    )}
                  />
                </Grid>
              ) : (
                <>
                  <Grid size={6}>
                    <form.AppField
                      name='firstName'
                      children={(field) => (
                        <field.TextField label='First name' size='small' />
                      )}
                    />
                  </Grid>
                  <Grid size={6}>
                    <form.AppField
                      name='lastName'
                      children={(field) => (
                        <field.TextField label='Last name' size='small' />
                      )}
                    />
                  </Grid>
                </>
              )
            }
          />

          <Grid size={8}>
            <form.AppField
              name='email'
              children={(field) => (
                <field.TextField label='Email' size='small' />
              )}
            />
          </Grid>
          <Grid size={4}>
            <form.AppField
              name='phone'
              children={(field) => (
                <field.MaskInput label='Phone' size='small' />
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
          inputSize='small'
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
          <form.SubmitButton
            label={editing ? 'Save client' : 'Create client'}
          />
        </Stack>
      </Stack>
    </form.AppForm>
  );
};

// Registry-facing default export (props are a superset of EntityFormProps).
export default NewClientForm as unknown as ComponentType<EntityFormProps>;
