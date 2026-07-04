import type { ButtonProps } from '@mui/material';
import { Button } from '@mui/material';
import { useFormContext } from '#/hooks/formContext';

interface SubmitButtonProps extends ButtonProps {
  label: string;
}

export function SubmitButton({
  label,
  sx,
  onClick,
  ...props
}: SubmitButtonProps) {
  const form = useFormContext();

  return (
    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
      {([canSubmit, isSubmitting]) => (
        <Button
          variant='contained'
          disableElevation
          {...props}
          sx={[
            // primaryButtonSx,
            ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
          ]}
          // The forms don't render a native <form>, so drive submission
          // directly instead of relying on type='submit'.
          type='button'
          onClick={(e) => {
            onClick?.(e);
            void form.handleSubmit();
          }}
          loading={isSubmitting || props.loading}
          disabled={!canSubmit || props.disabled}
        >
          {label}
        </Button>
      )}
    </form.Subscribe>
  );
}
