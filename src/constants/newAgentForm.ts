import { addressValues } from '#/constants/newClientForm';
import { formOptions } from '@tanstack/react-form';
import { z } from 'zod';

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]?[0-9]+[)])?([-]?[\s]?[0-9])+$/,
);

// export const zPhoneNumber = z.string().transform((value, ctx) => {
// const phoneNumber = parsePhoneNumber(value, {
//     defaultCountry: "FI",
// });

// if (!phoneNumber?.isValid()) {
//     ctx.addIssue({
//     code: z.ZodIssueCode.custom,
//     message: "Invalid phone number",
//     });
//     return z.NEVER;
// }

// return phoneNumber.formatInternational();
// });

export const agentLevel = z.enum([
  'agency',
  'sub-producer',
  'individual_agent',
]);

export const licenseeType = z.enum(['individual', 'entity']);

export const billingEntity = z.enum(['self', 'parent']);

export const newAgencyValues = z.object({
  entityName: z.string().min(1),
  agentLevel: agentLevel,
  licenseeType: licenseeType,
  firstName: z.string().min(1), // only required if
  lastName: z.string().min(1),
  parentAgencyId: z.string(), // if sub-producer (TODO: need .refine)
  billingEntity: billingEntity,
  email: z.email(),
  phone: z.string().regex(phoneRegex, 'Invalid Number!'),
  address: addressValues,
});
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
  },
};

export const newAgencyFormOpts = formOptions({
  defaultValues: defaultAgencyValues,
  validators: {
    onSubmit: newAgencyValues,
  },
});
