import {
  TextField as MuiTextField,
  type TextFieldProps as MuiTextFieldProps,
} from '@mui/material';
import { useSelector } from '@tanstack/react-store';
import { forwardRef } from 'react';
import { IMaskInput } from 'react-imask';
import { useFieldContext } from '@/hooks/formContext';

interface MaskAdapterProps {
  mask: string;
  onChange: (event: { target: { value: string } }) => void;
  name: string;
}

// The adapter MUI mounts as the underlying <input>
const MaskAdapter = forwardRef<HTMLInputElement, MaskAdapterProps>(
  ({ onChange, mask, ...other }, ref) => (
    <IMaskInput
      {...other}
      mask={mask}
      inputRef={ref}
      // unmask: store raw digits (recommended) — omit to store the formatted string
      unmask
      onAccept={(value) => onChange({ target: { value: value as string } })}
      overwrite
    />
  ),
);
MaskAdapter.displayName = 'MaskAdapter';

interface MaskInputProps
  extends Omit<MuiTextFieldProps, 'onChange' | 'onBlur' | 'error'> {
  mask?: string;
}

export const MaskInput = ({
  mask = '(000) 000-0000',
  ...props
}: MaskInputProps) => {
  const { state, store, handleBlur, handleChange } = useFieldContext<string>();
  const errors = useSelector(store, (s) => s.meta.errors);

  return (
    <MuiTextField
      fullWidth
      variant='outlined'
      color='primary'
      {...props}
      value={state.value}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      error={state.meta.isTouched && !state.meta.isValid}
      helperText={
        errors.length && state.meta.isTouched
          ? errors.map((e) => e?.message).join(', ')
          : props.helperText
      }
      slotProps={{
        input: {
          inputComponent: MaskAdapter as never,
          inputProps: { mask },
        },
      }}
    />
  );
};

export default MaskInput;
