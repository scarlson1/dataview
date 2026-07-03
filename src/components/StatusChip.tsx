import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import type { ChipTone } from '../theme/tokens';

interface StatusChipProps {
  label: string;
  tone: ChipTone;
  /** Rounded pill (data cells) vs. squared badge (schema keys). */
  variant?: 'pill' | 'badge';
}

/**
 * Small data-driven status chip. Kept as a bespoke component (rather than a
 * global MuiChip override) because the colours come from the row value.
 */
export const StatusChip = ({
  label,
  tone,
  variant = 'pill',
}: StatusChipProps) => {
  const theme = useTheme();
  const { bg, color } = theme.vars.palette.chips[tone];
  const pill = variant === 'pill';

  return (
    <Box
      component='span'
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: pill ? 23 : 22,
        px: pill ? '9px' : '8px',
        borderRadius: pill ? '11px' : '6px',
        fontSize: pill ? 12 : 11,
        fontWeight: 600,
        letterSpacing: pill ? '0.01em' : '0.04em',
        lineHeight: 1,
        backgroundColor: bg,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  );
};
