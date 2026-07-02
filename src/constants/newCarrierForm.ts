import { formOptions } from '@tanstack/react-form';
import { z } from 'zod';

export const carrierType = z.enum([
  'admitted',
  'E&S',
  'lloyds_syndicate',
  'lloyds_managing_agent',
]);

export const carrierStatus = z.enum(['active', 'inactive']);

export const newCarrierValues = z.object({
  carrierName: z.string().min(1, 'Required'),
  naicNumber: z.string(),
  amBestRating: z.string(), // select ??
  carrierType: z.string(),
  linesOfBusiness: z.string(),
  stateAdmitted: z.string(),
  domicileState: z.string(),
  contactName: z.string(),
  phone: z.string(),
  email: z.string(),
  claimsPhone: z.string(),
  country: z.string(),
  status: z.string(),
  address: z.object({
    addressLine1: z.string(),
    addressLine2: z.string(),
    city: z.string(),
    state: z.string(),
    postal: z.string(),
  }),
});
export type NewCarrierValues = z.infer<typeof newCarrierValues>;

export const defaultCarrierValues: NewCarrierValues = {
  carrierName: '',
  naicNumber: '',
  amBestRating: '',
  carrierType: '',
  linesOfBusiness: '',
  stateAdmitted: '',
  domicileState: '',
  contactName: '',
  phone: '',
  email: '',
  claimsPhone: '',
  country: '',
  status: 'active',
  address: {
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postal: '',
  },
};

export const newCarrierFormOpts = formOptions({
  defaultValues: defaultCarrierValues,
  validators: { onSubmit: newCarrierValues },
});
