import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

setOptions({ key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY, v: 'weekly' });

let placesPromise: ReturnType<typeof importLibrary> | undefined;

// Requires the index.html bootstrap snippet so google.maps.importLibrary exists.
export const loadPlaces = () =>
  (placesPromise ??= google.maps.importLibrary('places'));

export interface ParsedAddress {
  line1: string;
  city: string;
  state: string;
  postal: string;
  country: string;
}

const pick = (
  comps: google.maps.GeocoderAddressComponent[],
  type: string,
  short = false,
) =>
  comps.find((c) => c.types.includes(type))?.[
    short ? 'short_name' : 'long_name'
  ] ?? '';

export const parseAddressComponents = (
  comps: google.maps.GeocoderAddressComponent[],
): ParsedAddress => ({
  line1: [pick(comps, 'street_number'), pick(comps, 'route')]
    .filter(Boolean)
    .join(' '),
  city:
    pick(comps, 'locality') ||
    pick(comps, 'postal_town') ||
    pick(comps, 'sublocality'),
  state: pick(comps, 'administrative_area_level_1', true), // short_name => 'CA'
  postal: pick(comps, 'postal_code'),
  country: pick(comps, 'country', true), // short_name => ISO code, e.g. 'US'
});
