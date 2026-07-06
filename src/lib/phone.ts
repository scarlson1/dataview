import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { z } from 'zod';

// Phone fields store raw digits (e.g. '4155551234'); the mask handles display.
// libphonenumber-js still parses previously-formatted values, so edit forms
// loading legacy data validate fine.
export const isValidPhone = (value: string): boolean =>
  parsePhoneNumberFromString(value, 'US')?.isValid() ?? false;

// Required US phone number.
export const zPhone = z.string().refine(isValidPhone, 'Invalid phone number');

// Optional US phone number — an empty string is allowed.
export const zPhoneOptional = z
  .string()
  .refine((v) => v === '' || isValidPhone(v), 'Invalid phone number');
