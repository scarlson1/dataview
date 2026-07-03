/**
 * Generic responsive drawer for entity create/edit forms — side sheet on
 * desktop, bottom sheet on mobile. Generalized from NewBusinessDrawer so every
 * entity's form can be launched the same way from its list/detail page.
 */
import {
  Box,
  Drawer,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { X } from 'lucide-react';

interface EntityDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const EntityDrawer = ({
  open,
  title,
  onClose,
  children,
}: EntityDrawerProps) => {
  const theme = useTheme();
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
          {title}
        </Typography>
        <IconButton onClick={onClose} edge='end' aria-label='Close'>
          <X size={20} />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{children}</Box>
    </Drawer>
  );
};
