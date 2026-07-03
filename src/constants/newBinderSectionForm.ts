import { formOptions } from '@tanstack/react-form';
import { z } from 'zod';

export const binderSectionStatus = z.enum(['active', 'inactive']);

export const newBinderSectionValues = z.object({
  binderId: z.number(),
  sectionNumber: z.string().min(1, 'Required'),
  sectionDisplayName: z.string(),
  sectionLimit: z.string(),
  sectionAttachment: z.string(),
  lobCodes: z.string(),
  participationPct: z.string().min(1, 'Required'), // entered as %, stored as decimal
  status: z.string(),
  notes: z.string(),
});
export type NewBinderSectionValues = z.infer<typeof newBinderSectionValues>;

export const defaultBinderSectionValues: NewBinderSectionValues = {
  binderId: null as unknown as number,
  sectionNumber: '',
  sectionDisplayName: '',
  sectionLimit: '',
  sectionAttachment: '',
  lobCodes: '',
  participationPct: '',
  status: 'active',
  notes: '',
};

export const newBinderSectionFormOpts = formOptions({
  defaultValues: defaultBinderSectionValues,
  validators: { onSubmit: newBinderSectionValues },
});
