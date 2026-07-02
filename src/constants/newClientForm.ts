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

export const clientType = z.enum([
  'business',
  'individual',
  'non-profit',
  'government',
  'other',
]);

export const addressValues = z.object({
  addressLine1: z.string().min(1),
  addressLine2: z.string(),
  city: z.string().min(1),
  state: z.string().min(2), // TODO: add state validation ??
  postal: z.string().min(5),
});

export const newClientValues = //addressValues.and(
  z
    .object({
      companyName: z.string(),
      clientType: clientType,
      firstName: z.string(),
      lastName: z.string(),
      email: z.email(),
      phone: z.string().regex(phoneRegex, 'Invalid Number!'),
      address: addressValues,
    })
    .refine(
      (data) => data.clientType === 'individual' && data.firstName.length >= 1,
      {
        message: 'name required',
        path: ['firstName'],
      },
    )
    .refine(
      (data) => data.clientType === 'individual' && data.lastName.length >= 1,
      {
        message: 'name required',
        path: ['lastName'],
      },
    )
    .refine(
      (data) =>
        data.clientType !== 'individual' && data.companyName.length >= 1,
      {
        message: 'company name required',
        path: ['companyName'],
      },
    );
// );
export type NewClientValues = z.infer<typeof newClientValues>;

export const defaultClientValues: NewClientValues = {
  companyName: '',
  clientType: '' as unknown as NewClientValues['clientType'],
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  address: {
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postal: '',
  },
};

export const newClientFormOpts = formOptions({
  defaultValues: defaultClientValues,
  validators: {
    onSubmit: newClientValues,
  },
});
