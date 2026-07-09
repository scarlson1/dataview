/**
 * Prominent banner for a terminal decision (decline / refer / …). Shown in
 * place of premium cards when a run ends in a `decision` step. "decline" reads
 * as an error color; anything else as a warning/neutral call-out.
 */

import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import type { RaterOutcome } from '#/types/raters';

const severityFor = (decision: string): 'error' | 'warning' | 'info' => {
  const d = decision.toLowerCase();
  if (d.includes('decline') || d.includes('reject')) return 'error';
  if (d.includes('refer') || d.includes('review')) return 'warning';
  return 'info';
};

export const OutcomeBanner = ({ outcome }: { outcome: RaterOutcome }) => (
  <Alert severity={severityFor(outcome.decision)} variant='outlined'>
    <AlertTitle sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
      {outcome.decision}
    </AlertTitle>
    {outcome.reason ?? outcome.label ?? 'No further pricing was computed.'}
  </Alert>
);
