import { formOptions } from '@tanstack/react-form';
import { z } from 'zod';

export const EQUIPMENT_CATEGORIES = [
  'AI / GPU Compute',
  'Server / Storage',
  'Networking',
  'Supporting Infrastructure',
  'Other',
];

export const newAirEquipmentValues = z.object({
  exposureId: z.number(),
  equipmentCategory: z.string(),
  gpuManufacturer: z.string(),
  gpuModel: z.string(),
  gpuCount: z.string(),
  gpuUnitAge: z.string(),
  gpuPurchaseDate: z.string(),
  gpuUnitReplacementCost: z.string(),
  serverRackCount: z.string(),
  serverReplacementCost: z.string(),
  supportingInfraValue: z.string(),
  powerDrawKw: z.string(),
  coolingType: z.string(),
  fireSuppressionSystem: z.string(),
  notes: z.string(),
});
export type NewAirEquipmentValues = z.infer<typeof newAirEquipmentValues>;

export const defaultAirEquipmentValues: NewAirEquipmentValues = {
  exposureId: null as unknown as number,
  equipmentCategory: 'AI / GPU Compute',
  gpuManufacturer: '',
  gpuModel: '',
  gpuCount: '',
  gpuUnitAge: '',
  gpuPurchaseDate: '',
  gpuUnitReplacementCost: '',
  serverRackCount: '',
  serverReplacementCost: '',
  supportingInfraValue: '',
  powerDrawKw: '',
  coolingType: '',
  fireSuppressionSystem: '',
  notes: '',
};

export const newAirEquipmentFormOpts = formOptions({
  defaultValues: defaultAirEquipmentValues,
  validators: { onSubmit: newAirEquipmentValues },
});
