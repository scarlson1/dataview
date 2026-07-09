/**
 * Step-by-step results of a rater run: status per step, the bound value,
 * and a detail line (matched lookup row, fetch row count, branch case taken).
 */

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Check, CircleSlash, X } from 'lucide-react';
import { MONO_FONT } from '#/theme/tokens';
import type { TraceStep } from '#/types/raters';

interface TracePanelProps {
  steps: TraceStep[];
}

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? String(value)
      : String(Number(value.toFixed(6)));
  }
  if (typeof value === 'object') {
    const json = JSON.stringify(value);
    return json.length > 80 ? `${json.slice(0, 77)}…` : json;
  }
  return String(value);
};

const detailLine = (step: TraceStep): string | null => {
  const d = step.detail;
  if (!d) return null;
  if (step.type === 'lookup') {
    if (d.usedDefault) return 'no row matched — used the default row';
    if (typeof d.matchedRowIndex === 'number')
      return `matched row ${(d.matchedRowIndex as number) + 1}`;
  }
  if (step.type === 'fetch') {
    if (typeof d.rowCount === 'number')
      return `${d.table}: ${d.rowCount} row(s)`;
    if (typeof d.url === 'string') return d.url as string;
  }
  if (step.type === 'branch') {
    return d.caseTaken === 'else'
      ? 'took: else'
      : `took: ${d.caseLabel ?? `case ${(d.caseTaken as number) + 1}`}`;
  }
  return null;
};

export const TracePanel = ({ steps }: TracePanelProps) => (
  <Paper variant='outlined' sx={{ borderRadius: 1.5 }}>
    {steps.map((step, i) => (
      <Box
        // biome-ignore lint/suspicious/noArrayIndexKey: ids can repeat across branch cases
        key={`${step.id}-${i}`}
        sx={(t) => ({
          display: 'flex',
          alignItems: 'baseline',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderBottom:
            i < steps.length - 1 ? `1px solid ${t.palette.divider}` : 'none',
          opacity: step.status === 'skipped' ? 0.45 : 1,
        })}
      >
        <Box sx={{ alignSelf: 'center', display: 'inline-flex', width: 16 }}>
          {step.status === 'ok' && (
            <Check size={14} color='var(--mui-palette-success-main)' />
          )}
          {step.status === 'error' && (
            <X size={14} color='var(--mui-palette-error-main)' />
          )}
          {step.status === 'skipped' && <CircleSlash size={13} />}
        </Box>
        <Typography
          sx={{
            fontFamily: MONO_FONT,
            fontSize: 12.5,
            fontWeight: 600,
            minWidth: 120,
          }}
        >
          {step.id}
        </Typography>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          {step.status === 'error' ? (
            <Typography sx={{ fontSize: 12.5, color: 'error.main' }}>
              {step.error}
            </Typography>
          ) : step.status === 'ok' && step.type !== 'branch' ? (
            <Typography
              sx={{
                fontFamily: MONO_FONT,
                fontSize: 12.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {formatValue(step.value)}
            </Typography>
          ) : null}
          {detailLine(step) && (
            <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
              {detailLine(step)}
            </Typography>
          )}
        </Stack>
        {typeof step.ms === 'number' && step.status === 'ok' && step.ms > 0 && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {step.ms}ms
          </Typography>
        )}
      </Box>
    ))}
  </Paper>
);
