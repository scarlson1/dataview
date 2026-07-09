import {
  type CountryCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';
import { z } from 'zod';

// Phone fields are stored in E.164 (e.g. '+14155551234'). Older rows may hold
// raw US digits ('4155551234') or previously-formatted values ('(415) 555-1234');
// both still parse and validate, so edit forms loading legacy data work.
export const isValidPhone = (value: string): boolean => {
  if (!value) return false;
  // E.164 (leading '+') is parsed without a default region; legacy values fall
  // back to US so previously-entered numbers keep validating.
  const region: CountryCode | undefined = value.startsWith('+')
    ? undefined
    : 'US';
  return parsePhoneNumberFromString(value, region)?.isValid() ?? false;
};

// Normalize any accepted input to E.164, defaulting bare/legacy numbers to a
// region. Returns the original string if it can't be parsed (validation catches it).
export const toE164 = (
  value: string,
  defaultCountry: CountryCode = 'US',
): string => {
  if (!value) return '';
  const region = value.startsWith('+') ? undefined : defaultCountry;
  return parsePhoneNumberFromString(value, region)?.number ?? value;
};

// Required phone number (any country).
export const zPhone = z.string().refine(isValidPhone, 'Invalid phone number');

// Optional phone number — an empty string is allowed.
export const zPhoneOptional = z
  .string()
  .refine((v) => v === '' || isValidPhone(v), 'Invalid phone number');
