import { formOptions } from '@tanstack/react-form';
import { z } from 'zod';

export const newBusinessStage = z.enum([
  'prospect',
  'quoted',
  'indication',
  'firm_order',
  'bound',
  'lost',
  'declined',
]);
// ('prospect','submitted','quoted','bind_order','bound','lost','declined')

export const priority = z.enum(['low', 'medium', 'high']);

const policyData = z.object({
  lineOfBusiness: z.string(),
  policyNumber: z.string(),
  effectiveDate: z.string(),
  expirationDate: z.string(),
  jurisdiction: z.string(),
  state: z.string(),
  postal: z.string(),
  annualPremium: z.string(), // make it numeric with mui numeric (more deps)
  terrorismPremium: z.string(),
  policyFee: z.string(),
  inspectionFee: z.string(),
  otherFees: z.string(),
  otherFeeDescription: z.string(),
  grossCommissionPctOverride: z.string(),
  minEarnedPremiumPct: z.string(),
});
export type PolicyDataValues = z.infer<typeof policyData>;

export const coverageData = z.object({
  limitA: z.string(),
  limitB: z.string(),
  limitC: z.string(),
  limitD: z.string(),
  deductibleDollarAmount: z.string(),
});

export const newBusinessValues = z.object({
  submissionNumber: z.string(),
  stage: newBusinessStage,
  priority: priority,
  // correct way to satisfy data validation
  // submissionDate: z
  // .instanceof(dayjs as any) // Validates it's a Dayjs object if present
  // .nullable() // Accepts null as a valid type (satisfies initial state)
  // .refine((val) => val !== null, {
  //   message: 'Date is required', // Error if submitted as null
  // })
  // .refine((val) => !val || (val as Dayjs).isValid(), {
  //   message: 'Invalid date selection',
  // }),
  submissionDate: z.date(),
  quoteDueDate: z.date(),
  quoteReceivedDate: z.date(),
  assignedTo: z.string(), // TODO: SELECT FROM ?? UW ??
  clientId: z.number(),
  agencyId: z.number(),
  carrier: z.string(),
  policy: policyData,
  coverage: coverageData,
  lloyds: z.object({
    umr: z.string(),
    yearOfAccount: z.string().length(4),
    sectionNumber: z.string(),
    notes: z.string(),
  }),
});
export type NewBusinessValues = z.infer<typeof newBusinessValues>;

export const defaultNewBusinessValues: NewBusinessValues = {
  submissionNumber: '',
  stage: '' as unknown as NewBusinessValues['stage'],
  priority: '' as unknown as NewBusinessValues['priority'],
  submissionDate: null as unknown as NewBusinessValues['submissionDate'],
  quoteDueDate: null as unknown as NewBusinessValues['quoteDueDate'],
  quoteReceivedDate: null as unknown as NewBusinessValues['quoteReceivedDate'],
  assignedTo: '',
  clientId: null as unknown as NewBusinessValues['clientId'],
  agencyId: null as unknown as NewBusinessValues['agencyId'],
  carrier: '',
  policy: {
    lineOfBusiness: '',
    policyNumber: '',
    effectiveDate: null as unknown as PolicyDataValues['effectiveDate'],
    expirationDate: null as unknown as PolicyDataValues['expirationDate'],
    jurisdiction: '',
    state: '',
    postal: '',
    annualPremium: '',
    terrorismPremium: '',
    policyFee: '',
    inspectionFee: '',
    otherFees: '',
    otherFeeDescription: '',
    grossCommissionPctOverride: '',
    minEarnedPremiumPct: '',
  },
  coverage: {
    limitA: '',
    limitB: '',
    limitC: '',
    limitD: '',
    deductibleDollarAmount: '',
  },
  lloyds: {
    umr: '',
    yearOfAccount: '',
    sectionNumber: '',
    notes: '',
  },
};

export const newBusinessFormOpts = formOptions({
  defaultValues: defaultNewBusinessValues,
  validators: {
    onSubmit: newBusinessValues,
  },
});
