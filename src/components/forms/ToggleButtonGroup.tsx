import {
  FormControl,
  FormLabel,
  type ToggleButtonGroupProps as MuiToggleButtonGroupProps,
  Typography,
} from '@mui/material';
import ToggleButton, {
  type ToggleButtonProps,
} from '@mui/material/ToggleButton';
import MuiToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useSelector } from '@tanstack/react-store';
import { type ReactNode, useId } from 'react';
import { useFieldContext } from '#/hooks/formContext';

type ToggleButtonOption = {
  value: string;
  label?: string;
  icon?: ReactNode;
} & ToggleButtonProps;

type ToggleButtonGroupProps = Omit<
  MuiToggleButtonGroupProps,
  'onChange' | 'onBlur' | 'error'
> & { options: ToggleButtonOption[]; label?: string };

function ToggleButtonGroup({
  options,
  label,
  children,
  ...props
}: ToggleButtonGroupProps) {
  const id = useId();
  const { state, store, handleBlur, handleChange } = useFieldContext<string>();
  const errors = useSelector(store, (state) => state.meta.errors);

  return (
    <FormControl
      component='fieldset'
      error={state.meta.isTouched && Boolean(errors?.length)}
    >
      {label ? (
        <FormLabel
          component='legend'
          id={`${id}-label`}
          sx={{ fontWeight: 'medium', mb: 0.25, fontSize: '0.75rem' }}
        >
          {label}
        </FormLabel>
      ) : null}

      <MuiToggleButtonGroup
        {...props}
        value={state.value}
        onChange={(_, val) => handleChange(val)}
        onBlur={handleBlur}
        color={errors?.length ? 'error' : props.color}
      >
        {children}
        {options.map((o) => (
          <ToggleButton key={o.value} value={o.value}>
            {o.icon ? o.icon : null}
            {o.label ? o.label : null}
          </ToggleButton>
        ))}
      </MuiToggleButtonGroup>
      {errors?.length
        ? errors.map((e) => (
            <Typography
              key={`err-${e}`}
              color='error'
              variant='body2'
              sx={{ fontSize: '0.775rem' }}
            >
              {e}
            </Typography>
          ))
        : null}
    </FormControl>
  );
}

export default ToggleButtonGroup;
