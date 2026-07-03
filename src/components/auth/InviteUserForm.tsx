import { supabase } from '#/supabaseClient';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useForm } from '@tanstack/react-form';
import { toast } from 'sonner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Keep in sync with the public.app_role enum (20260703021911_rbac.sql).
const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'underwriter', label: 'Underwriter' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'viewer', label: 'Viewer (read-only)' },
] as const;

const validateEmail = ({ value }: { value: string }) =>
  !value
    ? 'Email is required'
    : EMAIL_RE.test(value)
      ? undefined
      : 'Enter a valid email address';

const inputSx = {
  '& .MuiOutlinedInput-root': { height: 46, fontSize: 15 },
  '& .MuiOutlinedInput-input': { padding: '0 14px' },
} as const;

const FieldLabel = ({ children }: { children: string }) => (
  <Typography
    component='label'
    sx={{
      display: 'block',
      fontSize: 11,
      fontWeight: 500,
      color: 'text.secondary',
      mb: '6px',
    }}
  >
    {children}
  </Typography>
);

interface InviteUserFormProps {
  /** Called after a successful invite (e.g. to refresh a team list). */
  onInvited?: () => void;
}

export const InviteUserForm = ({ onInvited }: InviteUserFormProps = {}) => {
  const form = useForm({
    defaultValues: { email: '', role: 'viewer' },
    onSubmit: async ({ value, formApi }) => {
      const { error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: value.email,
          role: value.role,
          redirectTo: `${window.location.origin}/accept-invite`,
        },
      });

      if (error) {
        toast.error(error.message || 'Failed to send invite');
        return;
      }

      toast.success(`Invite sent to ${value.email}`);
      formApi.reset();
      onInvited?.();
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
          const showError = field.state.meta.errors.length > 0;
          return (
            <Box sx={{ mb: '14px' }}>
              <FieldLabel>Invite by email</FieldLabel>
              <TextField
                fullWidth
                type='email'
                placeholder='teammate@company.com'
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

      <form.Field name='role'>
        {(field) => (
          <Box sx={{ mb: '14px' }}>
            <FieldLabel>Role</FieldLabel>
            <TextField
              select
              fullWidth
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              helperText=' '
              sx={inputSx}
            >
              {ROLE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button
            type='submit'
            variant='contained'
            disabled={!canSubmit}
            sx={{ height: 42, fontSize: 14, fontWeight: 600 }}
          >
            {isSubmitting ? 'Sending…' : 'Send invite'}
          </Button>
        )}
      </form.Subscribe>
    </Box>
  );
};
