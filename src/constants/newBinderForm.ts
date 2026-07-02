import { formOptions } from '@tanstack/react-form';
import type { Dayjs } from 'dayjs';
import { z } from 'zod';

export const newBinderValues = z.object({
  carrierId: z.number(),
  binderNumber: z.string().min(1, 'Required'),
  yoa: z.string(),
  effDate: z.any(),
  expDate: z.any(),
  grossComPct: z.string().min(1, 'Required'), // entered as % (e.g. 32.5), stored as 0.325
  notes: z.string(),
});
export type NewBinderValues = z.infer<typeof newBinderValues>;

export const defaultBinderValues: NewBinderValues = {
  carrierId: null as unknown as number,
  binderNumber: '',
  yoa: '',
  effDate: null as Dayjs | null,
  expDate: null as Dayjs | null,
  grossComPct: '',
  notes: '',
};

export const newBinderFormOpts = formOptions({
  defaultValues: defaultBinderValues,
  validators: { onSubmit: newBinderValues },
});
