/**
 * Lloyd's participation schedule ("stamp") for a single binder section —
 * a print-formatted rendering of the section's participants and a balance check
 * (participants' shares must foot to the section's stated participation).
 *
 * Presentational only: it receives the section label + already-loaded
 * participants, so it composes anywhere the data is in context (e.g. the binder
 * detail page, via StampPrintDialog). No data fetching, no route.
 */

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { labelize, pct } from '#/lib/money';

export interface StampPart {
  id: number;
  participant_name: string | null;
  participant_type: string | null;
  syndicate_entity_number: string | null;
  participation_pct: number | null;
}

interface StampScheduleProps {
  /** Section display label, e.g. "SECT-001 · Property". */
  label: string;
  /** The section's stated participation. */
  statedPct: number;
  parts: StampPart[];
  /** Participants' shares summed (from section_total_pct). */
  totalPct: number;
}

const PCT_TOL = 0.0000001;

export const StampSchedule = ({
  label,
  statedPct,
  parts,
  totalPct,
}: StampScheduleProps) => {
  const balanced = Math.abs(Number(totalPct) - Number(statedPct)) < PCT_TOL;

  return (
    <Paper
      variant='outlined'
      className='stamp-schedule'
      sx={{ p: { xs: 2, sm: 4 }, borderRadius: 2 }}
    >
      <Typography sx={{ fontSize: 18, fontWeight: 700, textAlign: 'center' }}>
        Participation Schedule
      </Typography>
      <Typography
        sx={{
          fontSize: 14,
          color: 'text.secondary',
          textAlign: 'center',
          mb: 3,
        }}
      >
        {label}
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>Participant</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Syndicate / Entity #</TableCell>
              <TableCell align='right'>Participation %</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {parts.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.participant_name ?? '—'}</TableCell>
                <TableCell>{labelize(r.participant_type)}</TableCell>
                <TableCell>{r.syndicate_entity_number ?? '—'}</TableCell>
                <TableCell align='right'>
                  {pct(r.participation_pct, 5)}
                </TableCell>
              </TableRow>
            ))}
            {parts.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ color: 'text.disabled' }}>
                  No participants for this section.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
      <Box
        sx={{
          mt: 2,
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 700,
        }}
      >
        <Box component='span'>Section stated: {pct(statedPct, 5)}</Box>
        <Box
          component='span'
          sx={{ color: balanced ? 'success.main' : 'error.main' }}
        >
          {balanced ? '✓' : '✗'} Participants total {pct(totalPct, 5)}
        </Box>
      </Box>
    </Paper>
  );
};

export default StampSchedule;
