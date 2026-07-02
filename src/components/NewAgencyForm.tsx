import { AddressFieldGroup } from '#/components/AddressFieldGroup';
import {
  agentLevel,
  billingEntity,
  licenseeType,
  newAgencyFormOpts,
  type NewAgencyValues,
} from '#/constants/newAgentForm';
import type { Tables, TablesInsert } from '#/data/database.types';
import type { EntityFormProps } from '#/data/entityForms';
import { useAppForm } from '#/hooks/form';
import { supabase } from '#/supabaseClient';
import { Alert, Button, Collapse, Grid, MenuItem, Stack } from '@mui/material';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import type { ComponentType } from 'react';

type AgencyRowInsert = TablesInsert<'agencies'>;
type AgencyRow = Tables<'agencies'>;

interface NewAgencyFormProps {
  defaultValues?: Partial<NewAgencyValues>;
  /** Present when editing an existing agency. */
  recordId?: number;
  /** Fetched agency row used to pre-fill an edit. */
  initialRow?: Record<string, unknown> | null;
  /** Called on insert (also used by EntitySelect inline-create). */
  onCreated?: (row: AgencyRow) => void;
  /** Registry-standard success callback (create or edit). */
  onSaved?: (row: AgencyRow) => void;
  onCancel?: () => void;
}

const agencyStr = (v: unknown): string => (v == null ? '' : String(v));

const agencyRowToValues = (
  row: Record<string, unknown> | null | undefined,
): Partial<NewAgencyValues> =>
  row
    ? ({
        entityName: agencyStr(row.entity_name),
        agentLevel: agencyStr(row.agency_level),
        licenseeType: agencyStr(row.licensee_type),
        firstName: agencyStr(row.first_name),
        lastName: agencyStr(row.last_name),
        parentAgencyId: row.parent_id == null ? '' : String(row.parent_id),
        billingEntity: agencyStr(row.billing_entity),
        email: agencyStr(row.email),
        phone: agencyStr(row.phone),
        address: {
          addressLine1: agencyStr(row.address_line1),
          addressLine2: agencyStr(row.address_line2),
          city: agencyStr(row.city),
          state: agencyStr(row.state),
          postal: agencyStr(row.postal),
        },
      } as unknown as Partial<NewAgencyValues>)
    : {};

export const NewAgencyForm = ({
  defaultValues = {},
  recordId,
  initialRow,
  onCreated,
  onSaved,
  onCancel,
}: NewAgencyFormProps) => {
  const editing = recordId != null;
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
      const q =
        recordId != null
          ? supabase.from('agencies').update(values).eq('id', recordId).select()
          : supabase.from('agencies').insert(values).select();
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data[0] as AgencyRow;
    },
    onSuccess: (data) => {
      onCreated?.(data);
      onSaved?.(data);
    },
    // onError: () => {},
  });

  const form = useAppForm({
    ...newAgencyFormOpts,
    defaultValues: {
      ...newAgencyFormOpts.defaultValues,
      ...agencyRowToValues(initialRow),
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

          <form.SubmitButton label={editing ? 'Save agency' : 'Create agency'} />
        </Stack>
      </Stack>
    </form.AppForm>
  );
};

// Registry-facing default export (props are a superset of EntityFormProps).
export default NewAgencyForm as unknown as ComponentType<EntityFormProps>;
