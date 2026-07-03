import { formOptions } from '@tanstack/react-form';
import { z } from 'zod';

export const participantType = z.enum([
  'lloyds_syndicate',
  'insurer',
  'mga',
  'other',
]);
export const binderPartStatus = z.enum(['active', 'inactive']);

export const newBinderPartValues = z.object({
  sectId: z.number(),
  participantName: z.string().min(1, 'Required'),
  participantType: z.string().min(1, 'Required'),
  syndicateEntityNumber: z.string(),
  participationPct: z.string().min(1, 'Required'), // entered as %, stored as decimal
  status: z.string(),
  notes: z.string(),
});
export type NewBinderPartValues = z.infer<typeof newBinderPartValues>;

export const defaultBinderPartValues: NewBinderPartValues = {
  sectId: null as unknown as number,
  participantName: '',
  participantType: '',
  syndicateEntityNumber: '',
  participationPct: '',
  status: 'active',
  notes: '',
};

export const newBinderPartFormOpts = formOptions({
  defaultValues: defaultBinderPartValues,
  validators: { onSubmit: newBinderPartValues },
});
