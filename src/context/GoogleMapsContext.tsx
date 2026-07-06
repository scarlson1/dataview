import { loadPlaces } from '#/lib/address';
import { use, type PropsWithChildren } from 'react';

export function GoogleMapsProvider({ children }: PropsWithChildren) {
  use(loadPlaces()); // suspends here until 'places' is ready
  return <>{children}</>;
}

// import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
// import { useEffect, useState, type PropsWithChildren } from 'react';

// setOptions({ key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY, v: 'weekly' });

// let placesPromise: ReturnType<typeof importLibrary> | undefined;
// export const loadPlaces = () => (placesPromise ??= importLibrary('places'));

// export function GoogleMapsProvider({ children }: PropsWithChildren) {
//   const [ready, setReady] = useState(false);
//   useEffect(() => {
//     loadPlaces().then(() => setReady(true));
//   }, []);

//   return ready ? <>{children}</> : null; // or a Skeleton, like your DatePicker Suspense fallbacks
// }
