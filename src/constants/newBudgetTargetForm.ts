import { formOptions } from '@tanstack/react-form';
import { z } from 'zod';

export const newBudgetTargetValues = z.object({
  year: z.string().min(4, 'Required'),
  month: z.string().min(1, 'Required'),
  lineOfBusiness: z.string().min(1, 'Required'),
  gwpTarget: z.string().min(1, 'Required'),
  notes: z.string(),
});
export type NewBudgetTargetValues = z.infer<typeof newBudgetTargetValues>;

export const defaultBudgetTargetValues: NewBudgetTargetValues = {
  year: String(new Date().getFullYear()),
  month: '1',
  lineOfBusiness: '',
  gwpTarget: '',
  notes: '',
};

export const newBudgetTargetFormOpts = formOptions({
  defaultValues: defaultBudgetTargetValues,
  validators: { onSubmit: newBudgetTargetValues },
});

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
