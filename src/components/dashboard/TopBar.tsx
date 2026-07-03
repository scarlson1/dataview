import { InviteUserForm } from '#/components/auth/InviteUserForm';
import { ToggleDarkMode } from '#/components/ToggleDarkMode';
import { useAuth } from '#/context/AuthContext';
import { MONO_FONT } from '#/theme/tokens';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { ChevronRight, PanelLeft, UserRoundPlus } from 'lucide-react';
import { useState } from 'react';

interface TopBarProps {
  activeName: string;
  onToggleSidebar: () => void;
}

export const TopBar = ({ activeName, onToggleSidebar }: TopBarProps) => {
  // const { mode, toggleMode } = useColorMode();

  return (
    <AppBar
      position='static'
      elevation={0}
      sx={(theme) => ({
        height: 64,
        justifyContent: 'center',
        backgroundColor: 'background.paper',
        color: 'text.primary',
        borderBottom: `1px solid ${theme.palette.divider}`,
      })}
    >
      <Toolbar
        disableGutters
        sx={{ minHeight: '64px !important', px: '20px', gap: '6px' }}
      >
        <Tooltip title='Toggle sidebar'>
          <IconButton
            onClick={onToggleSidebar}
            sx={{ width: 40, height: 40, ml: '-8px' }}
          >
            <PanelLeft size={22} />
          </IconButton>
        </Tooltip>

        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: '8px', ml: '6px' }}
        >
          <Typography
            sx={{
              display: { xs: 'none', sm: 'block' },
              fontSize: 14,
              color: 'text.secondary',
            }}
          >
            Tables
          </Typography>
          <Box
            sx={{
              display: { xs: 'none', sm: 'flex' },
              color: 'text.disabled',
            }}
          >
            <ChevronRight size={18} />
          </Box>
          <Typography
            sx={{
              fontSize: 14,
              fontWeight: 500,
              fontFamily: MONO_FONT,
            }}
          >
            {activeName}
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        <AddUser />
        {/* <Tooltip title='Toggle theme'>
          <IconButton onClick={toggleMode} sx={{ width: 40, height: 40 }}>
            {mode === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
          </IconButton>
        </Tooltip> */}
        <ToggleDarkMode />
        {/* TODO: implement notifications ?? */}
        {/* <Tooltip title='Notifications'>
          <IconButton sx={{ width: 40, height: 40 }}>
            <Bell size={22} />
          </IconButton>
        </Tooltip>
        <Tooltip title='Help'>
          <IconButton sx={{ width: 40, height: 40 }}>
            <CircleHelp size={22} />
          </IconButton>
        </Tooltip> */}
        {/* <Avatar
          sx={(theme) => ({
            width: 36,
            height: 36,
            ml: '6px',
            fontSize: 13,
            fontWeight: 600,
            backgroundColor: theme.vars.palette.primary.light,
            color: 'primary.main',
          })}
        >
          AL
        </Avatar> */}
      </Toolbar>
    </AppBar>
  );
};

function AddUser() {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  if (role != 'admin') return null;

  return (
    <>
      <IconButton>
        <UserRoundPlus />
      </IconButton>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth='xs'
        fullWidth
        fullScreen={fullScreen}
      >
        <DialogTitle>Add User</DialogTitle>
        <DialogContent>
          <InviteUserForm />
        </DialogContent>
      </Dialog>
    </>
  );
}
