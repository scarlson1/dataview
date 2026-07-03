import { formOptions } from '@tanstack/react-form';
import type { Dayjs } from 'dayjs';
import { z } from 'zod';

export const paymentMethod = z.enum([
  'ach',
  'check',
  'wire',
  'credit_card',
  'other',
]);
export const paymentStatus = z.enum([
  'outstanding',
  'partial',
  'paid',
  'overdue',
  'waived',
]);

export const newPaymentValues = z.object({
  policyId: z.number(),
  clientId: z.number(),
  dueDate: z.any(),
  paymentDate: z.any(),
  amountDue: z.string().min(1, 'Required'),
  amountPaid: z.string(),
  paymentMethod: z.string(),
  invoiceNumber: z.string(),
  status: z.string(),
});
export type NewPaymentValues = z.infer<typeof newPaymentValues>;

export const defaultPaymentValues: NewPaymentValues = {
  policyId: null as unknown as number,
  clientId: null as unknown as number,
  dueDate: null as Dayjs | null,
  paymentDate: null as Dayjs | null,
  amountDue: '',
  amountPaid: '',
  paymentMethod: '',
  invoiceNumber: '',
  status: 'outstanding',
};

export const newPaymentFormOpts = formOptions({
  defaultValues: defaultPaymentValues,
  validators: { onSubmit: newPaymentValues },
});
