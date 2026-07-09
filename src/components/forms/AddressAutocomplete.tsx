import { useFieldContext } from '#/hooks/formContext';
import {
  loadPlaces,
  parseAddressComponents,
  type ParsedAddress,
} from '#/lib/address';
import type { TextFieldProps } from '@mui/material';
import { Autocomplete, TextField } from '@mui/material';
import { useSelector } from '@tanstack/react-store';
import { use } from 'react';
import usePlacesAutocomplete, { getGeocode } from 'use-places-autocomplete';

type Suggestion = google.maps.places.AutocompletePrediction;

interface AddressAutocompleteProps {
  label?: string;
  helperText?: string;
  onAddressSelect?: (addr: ParsedAddress) => void;
  textFieldProps?: Omit<TextFieldProps, 'value' | 'onChange'>;
  /**
   * Restrict autocomplete predictions to these ISO country codes (e.g. ['us']).
   * Omit for worldwide search.
   */
  countries?: string[];
}

function AddressAutocomplete({
  label = 'Address',
  helperText,
  onAddressSelect,
  textFieldProps,
  countries,
}: AddressAutocompleteProps) {
  use(loadPlaces()); // suspends until places is ready
  const { state, store, handleBlur, handleChange } = useFieldContext<string>();
  const errors = useSelector(store, (s) => s.meta.errors);

  const {
    suggestions: { data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: countries?.length
      ? { componentRestrictions: { country: countries } }
      : {},
    debounce: 300,
  });

  const handleSelect = async (prediction: Suggestion) => {
    handleChange(prediction.structured_formatting.main_text);
    const [result] = await getGeocode({ placeId: prediction.place_id });
    onAddressSelect?.(parseAddressComponents(result.address_components));
    clearSuggestions();
  };

  return (
    <Autocomplete<Suggestion, false, false, true>
      freeSolo
      autoHighlight
      filterOptions={(x) => x} // Google already filtered; don't re-filter
      options={data}
      value={state.value}
      inputValue={state.value}
      getOptionLabel={(o) => (typeof o === 'string' ? o : o.description)}
      onInputChange={(_, v) => {
        handleChange(v); // keep addressLine1 in sync with free typing
        setValue(v); // drive predictions
      }}
      onChange={(_, v) => {
        if (v && typeof v !== 'string') handleSelect(v);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          onBlur={handleBlur}
          error={state.meta.isTouched && !state.meta.isValid}
          helperText={
            errors.length && state.meta.isTouched
              ? errors.map((e) => e?.message).join(', ')
              : helperText
          }
          {...textFieldProps}
        />
      )}
    />
  );
}

export default AddressAutocomplete;
