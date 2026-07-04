import type {
  AutocompleteValue,
  AutocompleteProps as MuiAutocompleteProps,
  TextFieldProps,
} from '@mui/material';
import { Autocomplete as MuiAutocomplete, TextField } from '@mui/material';
import { useSelector } from '@tanstack/react-store';
import { useFieldContext } from '#/hooks/formContext';

type AutocompleteProps<
  Value,
  Multiple extends boolean | undefined,
  DisableClearable extends boolean | undefined,
  FreeSolo extends boolean | undefined,
  ChipComponent extends React.ElementType = 'div',
> = Omit<
  MuiAutocompleteProps<
    Value,
    Multiple,
    DisableClearable,
    FreeSolo,
    ChipComponent
  >,
  'value' | 'onChange' | 'onBlur' | 'error' | 'renderInput'
> & {
  label: string; // TODO: move to textFieldProps ??
  helperText?: string;
  textFieldProps?: Omit<TextFieldProps, 'value' | ''>;
};

function Autocomplete<
  Value,
  Multiple extends boolean | undefined,
  DisableClearable extends boolean | undefined,
  FreeSolo extends boolean | undefined,
  ChipComponent extends React.ElementType = 'div',
>({
  label,
  helperText,
  textFieldProps,
  // slotProps ={},
  ...props
}: AutocompleteProps<
  Value,
  Multiple,
  DisableClearable,
  FreeSolo,
  ChipComponent
>) {
  const { state, store, handleBlur, handleChange } =
    useFieldContext<
      AutocompleteValue<Value, Multiple, DisableClearable, FreeSolo>
    >();
  const errors = useSelector(store, (state) => state.meta.errors);

  return (
    <MuiAutocomplete<Value, Multiple, DisableClearable, FreeSolo, ChipComponent>
      value={state.value}
      onChange={(_, newVal) => {
        handleChange(newVal);
      }}
      blurOnSelect={!props?.multiple}
      {...props}
      renderInput={(params) => (
        <TextField
          {...params}
          onBlur={handleBlur}
          label={label}
          error={state.meta.isTouched && !state.meta.isValid}
          helperText={
            errors.length
              ? errors.map((e) => e?.message).join(', ')
              : helperText
          }
          {...(textFieldProps || {})}
          slotProps={{
            ...(textFieldProps?.slotProps || {}),
            ...params.slotProps,
            input: {
              ...params.slotProps?.input,
              // ...params.InputProps,
              ...(textFieldProps?.slotProps?.input || {}),
            },
          }}
        />
      )}
    />
  );
}

export default Autocomplete;
