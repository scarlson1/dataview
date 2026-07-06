import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ShieldCheck } from 'lucide-react';
import { AcceptInviteForm } from '#/components/auth/AcceptInviteForm';
import { ToggleDarkMode } from '#/components/ToggleDarkMode';

export const Route = createFileRoute('/accept-invite')({
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const navigate = useNavigate();
  const goToApp = () => navigate({ to: '/' });

  return (
    <Box
      sx={(theme) => ({
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        backgroundColor: theme.vars.palette.authBg,
        backgroundSize: '22px 22px',
      })}
    >
      <Paper
        elevation={0}
        sx={(theme) => ({
          width: '100%',
          maxWidth: 404,
          border: `1px solid ${theme.vars.palette.borderSoft}`,
          borderRadius: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 12px 32px rgba(0,0,0,0.14)',
          p: '40px 38px 34px',
        })}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            mb: '28px',
          }}
        >
          <Box
            sx={(theme) => ({
              width: 54,
              height: 54,
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              mb: '16px',
              boxShadow: `0 4px 12px ${theme.vars.palette.primary.light}`,
            })}
          >
            <ShieldCheck size={28} />
          </Box>
          <Typography
            sx={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em' }}
          >
            Set your password
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: '4px' }}>
            You've been invited — finish setting up your account
          </Typography>
        </Box>

        <AcceptInviteForm onSuccess={goToApp} />

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: '22px' }}>
          <ToggleDarkMode />
        </Box>
      </Paper>
    </Box>
  );
}
