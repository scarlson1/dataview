import { formOptions } from '@tanstack/react-form';
import type { Dayjs } from 'dayjs';
import { z } from 'zod';

export const claimStatus = z.enum(['open', 'closed', 'reopened', 'denied']);

export const newClaimValues = z.object({
  policyId: z.number(),
  clientId: z.number(),
  carrierId: z.number(),
  dateOfLoss: z.any(),
  dateReported: z.any(),
  lossType: z.string(),
  description: z.string(),
  reserveAmt: z.string(),
  paidAmt: z.string(),
  adjuster: z.string(),
  status: z.string(),
});
export type NewClaimValues = z.infer<typeof newClaimValues>;

export const defaultClaimValues: NewClaimValues = {
  policyId: null as unknown as number,
  clientId: null as unknown as number,
  carrierId: null as unknown as number,
  dateOfLoss: null as Dayjs | null,
  dateReported: null as Dayjs | null,
  lossType: '',
  description: '',
  reserveAmt: '',
  paidAmt: '',
  adjuster: '',
  status: 'open',
};

export const newClaimFormOpts = formOptions({
  defaultValues: defaultClaimValues,
  validators: { onSubmit: newClaimValues },
});
