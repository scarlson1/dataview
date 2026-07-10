import { formOptions } from '@tanstack/react-form';
import { z } from 'zod';
import { zPhone } from '#/lib/phone';

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
  state: z.string(), // free-text State/Province (region formats vary by country)
  postal: z.string().min(1),
  country: z.string().min(1),
});

export const newClientValues = //addressValues.and(
  z
    .object({
      companyName: z.string(),
      clientType: clientType,
      firstName: z.string(),
      lastName: z.string(),
      email: z.email(),
      phone: zPhone,
      address: addressValues,
    })
    .refine(
      (data) => {
        if (data.clientType === 'individual') return data.firstName.length > 1;
        return true;
      },
      {
        message: 'name required',
        path: ['firstName'],
      },
    )
    .refine(
      (data) => {
        if (data.clientType === 'individual') return data.lastName.length > 1;
        return true;
      },
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
    country: 'US',
  },
};

export const newClientFormOpts = formOptions({
  defaultValues: defaultClientValues,
  validators: {
    onSubmit: newClientValues,
  },
});
