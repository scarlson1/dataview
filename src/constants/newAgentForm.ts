import { formOptions } from '@tanstack/react-form';
import { z } from 'zod';
import { addressValues } from '#/constants/newClientForm';
import { zPhone } from '#/lib/phone';

// Matches the agencies.agency_level DB check constraint.
export const agentLevel = z.enum([
  'mga',
  'wholesale',
  'retail',
  'sub-producer',
]);

export const licenseeType = z.enum(['individual', 'entity']);

export const billingEntity = z.enum(['self', 'parent']);

export const newAgencyValues = z
  .object({
    agentLevel: agentLevel,
    licenseeType: licenseeType,
    entityName: z.string(),
    firstName: z.string(), // only required if
    lastName: z.string(),
    parentAgencyId: z.string(), // if sub-producer (TODO: need .refine)
    billingEntity: billingEntity,
    email: z.email(),
    phone: zPhone,
    address: addressValues,
  })
  .refine(
    (data) => {
      if (data.licenseeType === 'individual')
        return data.firstName.trim().length > 1;
      return true;
    },
    {
      message: 'name required',
      path: ['firstName'],
    },
  )
  .refine(
    (data) => {
      if (data.licenseeType === 'individual')
        return data.lastName.trim().length > 1;
      return true;
    },
    {
      message: 'name required',
      path: ['lastName'],
    },
  )
  .refine(
    (data) => {
      if (data.licenseeType === 'entity')
        return data.entityName.trim().length >= 1;
      return true;
    },
    {
      message: 'company name required',
      path: ['entityName'],
    },
  );

export type NewAgencyValues = z.infer<typeof newAgencyValues>;

export const defaultAgencyValues: NewAgencyValues = {
  entityName: '',
  agentLevel: '' as unknown as NewAgencyValues['agentLevel'],
  licenseeType: '' as unknown as NewAgencyValues['licenseeType'],
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  parentAgencyId: '',
  billingEntity: '' as unknown as NewAgencyValues['billingEntity'],
  address: {
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postal: '',
    country: 'US',
  },
};

export const newAgencyFormOpts = formOptions({
  defaultValues: defaultAgencyValues,
  validators: {
    onSubmit: newAgencyValues,
  },
});
