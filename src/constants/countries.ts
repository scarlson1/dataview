import { getCountries } from 'libphonenumber-js';
import labels from 'react-phone-number-input/locale/en.json';

export interface Country {
  code: string; // ISO 3166-1 alpha-2, e.g. 'US'
  name: string;
}

// Full ISO country list derived from libphonenumber-js, named via the
// react-phone-number-input English locale (same source the phone field uses).
export const COUNTRIES: Country[] = getCountries()
  .map((code) => ({
    code,
    name: (labels as Record<string, string>)[code] ?? code,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// Options for the country <Select> (value = ISO code, label = country name).
export const countryOptions = COUNTRIES.map((c) => ({
  value: c.code,
  label: c.name,
}));

// Countries that use a fixed set of subdivisions we render as a dropdown.
// Everything else falls back to a free-text State/Province field.
export const DROPDOWN_STATE_COUNTRIES = new Set(['US']);
