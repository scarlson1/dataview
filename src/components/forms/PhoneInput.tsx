import { FormControl, FormHelperText, FormLabel } from '@mui/material';
import { useSelector } from '@tanstack/react-store';
import type { Country } from 'react-phone-number-input';
import PhoneInputWithCountrySelect from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useFieldContext } from '@/hooks/formContext';

interface PhoneInputProps {
  label?: string;
  helperText?: string;
  disabled?: boolean;
  defaultCountry?: Country;
}

// Country-aware phone field: renders a flag/country-code selector plus a number
// input and stores the value in E.164 (e.g. '+14155551234'). Wired to the shared
// form field context the same way as MaskInput.
export const PhoneInput = ({
  label = 'Phone',
  helperText,
  disabled,
  defaultCountry = 'US',
}: PhoneInputProps) => {
  const { state, store, handleBlur, handleChange } = useFieldContext<string>();
  const errors = useSelector(store, (s) => s.meta.errors);
  const hasError = state.meta.isTouched && !state.meta.isValid;

  return (
    <FormControl fullWidth error={hasError} disabled={disabled}>
      <FormLabel sx={{ mb: 0.5, fontSize: '0.75rem' }}>{label}</FormLabel>
      <PhoneInputWithCountrySelect
        international
        defaultCountry={defaultCountry}
        value={state.value}
        onChange={(v) => handleChange(v ?? '')}
        onBlur={handleBlur}
        disabled={disabled}
        // MUI-ish outlined look for the number input.
        numberInputProps={{
          className: 'PhoneInputInput',
          style: {
            border: `1px solid ${hasError ? '#d32f2f' : 'rgba(0,0,0,0.23)'}`,
            borderRadius: 4,
            padding: '8.5px 14px',
            fontSize: '1rem',
          },
        }}
      />
      <FormHelperText>
        {errors.length && state.meta.isTouched
          ? errors.map((e) => e?.message).join(', ')
          : helperText}
      </FormHelperText>
    </FormControl>
  );
};

export default PhoneInput;
