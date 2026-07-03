import { supabase } from '#/supabaseClient';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = ({ value }: { value: string }) =>
  !value
    ? 'Email is required'
    : EMAIL_RE.test(value)
      ? undefined
      : 'Enter a valid email address';

const validatePassword = ({ value }: { value: string }) =>
  value ? undefined : 'Password is required';

const inputSx = {
  '& .MuiOutlinedInput-root': { height: 46, fontSize: 15 },
  '& .MuiOutlinedInput-input': { padding: '0 14px' },
} as const;

const FieldLabel = ({ children }: { children: string }) => (
  <Typography
    component='label'
    sx={{
      display: 'block',
      fontSize: 12.5,
      fontWeight: 500,
      color: 'text.secondary',
      mb: '6px',
    }}
  >
    {children}
  </Typography>
);

interface SignInFormProps {
  onSuccess: () => void;
}

export const SignInForm = ({ onSuccess }: SignInFormProps) => {
  const [pwResetOpen, setPwResetOpen] = useState(false);

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: value.email,
        password: value.password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      onSuccess();
    },
  });

  return (
    <Box
      component='form'
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      noValidate
    >
      <form.Field
        name='email'
        validators={{ onChange: validateEmail, onSubmit: validateEmail }}
      >
        {(field) => {
          // Show errors once the field has been interacted with or a submit
          // has been attempted (submit runs the validators and populates
          // `errors` even when the field was never focused).
          const showError = field.state.meta.errors.length > 0;
          return (
            <Box sx={{ mb: '18px' }}>
              <FieldLabel>Email</FieldLabel>
              <TextField
                fullWidth
                type='email'
                placeholder='you@company.com'
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={showError}
                helperText={
                  showError ? String(field.state.meta.errors[0]) : ' '
                }
                sx={inputSx}
              />
            </Box>
          );
        }}
      </form.Field>

      <form.Field
        name='password'
        validators={{ onChange: validatePassword, onSubmit: validatePassword }}
      >
        {(field) => {
          // Show errors once the field has been interacted with or a submit
          // has been attempted (submit runs the validators and populates
          // `errors` even when the field was never focused).
          const showError = field.state.meta.errors.length > 0;
          return (
            <Box sx={{ mb: '6px' }}>
              <FieldLabel>Password</FieldLabel>
              <TextField
                fullWidth
                type='password'
                placeholder='••••••••••'
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={showError}
                helperText={
                  showError ? String(field.state.meta.errors[0]) : ' '
                }
                sx={inputSx}
              />
            </Box>
          );
        }}
      </form.Field>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: '22px' }}>
        <Link
          component='button'
          type='button'
          underline='none'
          sx={{ fontSize: 13, fontWeight: 500 }}
          onClick={() => setPwResetOpen(true)}
        >
          Forgot password?
        </Link>
        <ForgotPasswordDialog
          defaultValues={{ email: '' }}
          open={pwResetOpen}
          handleDismiss={() => setPwResetOpen(false)}
        />
      </Box>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button
            type='submit'
            fullWidth
            variant='contained'
            disabled={!canSubmit}
            sx={{
              height: 46,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        )}
      </form.Subscribe>
    </Box>
  );
};

function ForgotPasswordDialog({
  defaultValues = { email: '' },
  open,
  handleDismiss,
}: {
  defaultValues?: { email: string };
  open: boolean;
  handleDismiss: () => void;
}) {
  const {
    mutate: sendReset,
    isPending,
    isSuccess,
    // isError,
    // error,
  } = useMutation({
    mutationFn: (email: string) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${import.meta.env.BASE_URL}/auth/password-reset`,
      }),
    // onSuccess: () => {
    //   toast.success('Reset email sent. Check your inbox.', { id: 'pw-reset' });
    // },
    onError: (err) => {
      console.log(err);
      toast.error('Failed to send password reset email.', { id: 'pw-reset' });
    },
  });

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      sendReset(value.email);
    },
  });

  return (
    <>
      <Dialog
        open={open}
        onClose={() => handleDismiss()}
        maxWidth='xs'
        fullWidth
      >
        <DialogTitle>Send Password Reset Link</DialogTitle>
        <DialogContent>
          {!isSuccess ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
              id='pw-reset-form'
            >
              <form.Field
                name='email'
                children={({ state, handleChange, handleBlur }) => {
                  return (
                    <TextField
                      autoFocus
                      value={state.value}
                      onChange={(e) => handleChange(e.target.value)}
                      onBlur={handleBlur}
                      label='Email'
                      placeholder='johndoe@gmail.com'
                      fullWidth
                    />
                  );
                }}
              />
            </form>
          ) : (
            <Box
              sx={{
                p: 2,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {/* TODO: small checkmark lottie */}
              <Typography>Check your input!</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!isSuccess ? (
            <>
              <Button onClick={() => handleDismiss()}>Cancel</Button>
              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
              >
                {(
                  [canSubmit], // isSubmitting
                ) => (
                  <Button
                    loading={isPending}
                    type='submit'
                    form='pw-reset-form'
                    disabled={!canSubmit}
                  >
                    Submit
                  </Button>
                )}
              </form.Subscribe>
            </>
          ) : (
            <Button onClick={() => handleDismiss()}>Done</Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
