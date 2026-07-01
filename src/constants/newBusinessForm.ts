import { formOptions } from "@tanstack/react-form";
import { z } from "zod";

export const addressValues = z.object({
  addressLine1: z.string().min(1),
  addressLine2: z.string(),
  city: z.string().min(1),
  state: z.string().min(2), // TODO: add state validation ??
  postal: z.string().min(5),
});

export const newBusinessValues = addressValues.and(z.object({
    companyName: z.string().min(1),
  clientType: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
}));
export type NewBusinessValues = z.infer<typeof newBusinessValues>

export const defaultNewBusinessValues: NewBusinessValues = {
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postal: '',
  companyName: '',
  clientType: '',
  firstName: '',
  lastName: '',
};

export const newBusinessFormOpts = formOptions({
    defaultValues: defaultNewBusinessValues,
    validators: {
        onSubmit: newBusinessValues,
    },
})