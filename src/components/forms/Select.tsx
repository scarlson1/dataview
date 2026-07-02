import { useFieldContext } from '#/hooks/formContext';
import type { TextFieldProps as MuiTextFieldProps } from '@mui/material';
import { MenuItem, TextField as MuiTextField } from '@mui/material';
import { useSelector } from '@tanstack/react-store';

interface SelectOption {
  value: string;
  label: string;
}

type SelectProps = Omit<
  MuiTextFieldProps,
  'onChange' | 'onBlur' | 'error' | 'select'
> & { options: SelectOption[] };

export function Select({ options, children, ...props }: SelectProps) {
  const { state, store, handleBlur, handleChange } = useFieldContext<string>();
  const errors = useSelector(store, (state) => state.meta.errors);

  return (
    <MuiTextField
      select
      fullWidth
      variant='outlined'
      color='primary'
      {...props}
      value={state.value ?? ''}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      error={state.meta.isTouched && !state.meta.isValid}
      helperText={
        errors.length && state.meta.isTouched
          ? errors.map((e) => e?.message).join(', ')
          : props.helperText
      }
    >
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </MuiTextField>
  );
}

export default Select;
