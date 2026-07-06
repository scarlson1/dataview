import { NewBusinessForm } from '#/components/NewBusinessForm';
import {
  Box,
  CircularProgress,
  Drawer,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { X } from 'lucide-react';
import { Suspense } from 'react';

interface NewBusinessDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export const NewBusinessDrawer = ({
  open,
  onClose,
  onCreated,
}: NewBusinessDrawerProps) => {
  const theme = useTheme();
  // Side sheet on desktop; full-screen sheet from the bottom on mobile.
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: isMobile ? '100%' : { sm: 480, md: 560 },
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography component='h2' variant='h6'>
          New Business Submission
        </Typography>
        <IconButton onClick={onClose} edge='end' aria-label='Close'>
          <X size={20} />
        </IconButton>
      </Box>

      <Suspense
        fallback={
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CircularProgress />
          </Box>
        }
      >
        <NewBusinessForm
          onSaved={() => {
            onCreated?.();
            onClose();
          }}
        />
      </Suspense>
    </Drawer>
  );
};
