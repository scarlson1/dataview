import { formOptions } from '@tanstack/react-form';
import { z } from 'zod';

export const underwriterStatus = z.enum(['active', 'inactive', 'on_leave']);

export const newUnderwriterValues = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  titleRole: z.string(),
  email: z.string(),
  phone: z.string(),
  status: z.string(),
});
export type NewUnderwriterValues = z.infer<typeof newUnderwriterValues>;

export const defaultUnderwriterValues: NewUnderwriterValues = {
  firstName: '',
  lastName: '',
  titleRole: '',
  email: '',
  phone: '',
  status: 'active',
};

export const newUnderwriterFormOpts = formOptions({
  defaultValues: defaultUnderwriterValues,
  validators: { onSubmit: newUnderwriterValues },
});
