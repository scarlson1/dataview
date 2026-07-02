import { formOptions } from '@tanstack/react-form';
import type { Dayjs } from 'dayjs';
import { z } from 'zod';

export const licenseType = z.enum([
  'Surplus Lines',
  'Resident P&C',
  'Non-Resident P&C',
  'Other',
]);

// Dates are held as Dayjs|null (MUI DatePicker) — kept loose to avoid Dayjs-vs-Date
// validation friction; coerced to 'YYYY-MM-DD' on submit.
export const newLicenseValues = z.object({
  agentId: z.number(),
  licenseType: z.string().min(1, 'Required'),
  state: z.string().min(2, 'Required'),
  licenseNumber: z.string().min(1, 'Required'),
  effDate: z.any(),
  expDate: z.any(),
  defaultSlLicensee: z.boolean(),
  notes: z.string(),
});
export type NewLicenseValues = z.infer<typeof newLicenseValues>;

export const defaultLicenseValues: NewLicenseValues = {
  agentId: null as unknown as number,
  licenseType: '',
  state: '',
  licenseNumber: '',
  effDate: null as Dayjs | null,
  expDate: null as Dayjs | null,
  defaultSlLicensee: false,
  notes: '',
};

export const newLicenseFormOpts = formOptions({
  defaultValues: defaultLicenseValues,
  validators: { onSubmit: newLicenseValues },
});
