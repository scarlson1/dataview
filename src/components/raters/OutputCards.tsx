/**
 * Result cards for a rater run's outputs, formatted per the output step's
 * declared format (money / percent / number / text).
 */

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { money, pct } from '#/lib/money';
import type { RaterOutputValue } from '#/types/raters';

export const formatOutput = (output: RaterOutputValue): string => {
  const { value, format } = output;
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    if (format === 'money') return money(value, 2);
    if (format === 'percent') return pct(value);
    return Number.isInteger(value)
      ? String(value)
      : String(Number(value.toFixed(6)));
  }
  return String(value);
};

export const OutputCards = ({
  outputs,
}: {
  outputs: Record<string, RaterOutputValue>;
}) => (
  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
    {Object.entries(outputs).map(([name, output]) => (
      <Paper
        key={name}
        variant='outlined'
        sx={{
          borderRadius: 2,
          px: 2,
          py: 1.5,
          minWidth: 180,
          flex: '0 1 auto',
        }}
      >
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {output.label}
        </Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
          {formatOutput(output)}
        </Typography>
      </Paper>
    ))}
  </Box>
);
