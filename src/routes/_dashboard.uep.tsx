/**
 * Net-Commission UEP reserve report with a movable report date (workbook D5).
 * Calls net_com_uep_asof(p_report_date); the funded reserve total and every
 * row recalculates when the date changes.
 */
import { downloadCsv } from '#/lib/csv';
import { money, pct } from '#/lib/money';
import { supabase } from '#/supabaseClient';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Download } from 'lucide-react';
import dayjs from 'dayjs';
import { useState } from 'react';

export const Route = createFileRoute('/_dashboard/uep')({
  component: UepReport,
});

interface UepRow {
  policy_id: number;
  client_name: string | null;
  line_of_business: string | null;
  carrier_name: string | null;
  status_as_of_rpt_date: string | null;
  total_term_premium: number | null;
  mga_net_com_amt: number | null;
  uep_pct_required: number | null;
  received_nep_pct: number | null;
  selected_net_com_uep_pct: number | null;
  mga_net_com_uep_amt: number | null;
}

function UepReport() {
  const [reportDate, setReportDate] = useState(dayjs().format('YYYY-MM-DD'));

  const query = useQuery({
    queryKey: ['uep-report', reportDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('net_com_uep_asof', {
        p_report_date: reportDate,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as UepRow[];
    },
  });

  const rows = query.data ?? [];
  const fundedTotal = rows.reduce(
    (a, r) => a + (Number(r.mga_net_com_uep_amt) || 0),
    0,
  );

  return (
    <Box sx={{ maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
            Net-Commission UEP Reserve
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
            Funded fiduciary reserve on MGA net commission, as of the report date.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            label='Report date'
            type='date'
            size='small'
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button
            variant='outlined'
            startIcon={<Download size={16} />}
            disabled={rows.length === 0}
            onClick={() =>
              downloadCsv(
                `uep-reserve-${reportDate}`,
                rows as unknown as Record<string, unknown>[],
              )
            }
          >
            CSV
          </Button>
        </Box>
      </Box>

      <Paper variant='outlined' sx={{ p: 2, borderRadius: 2 }}>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary', fontWeight: 600 }}>
          Funded Net-Com UEP Reserve
        </Typography>
        <Typography sx={{ fontSize: 28, fontWeight: 700 }}>
          {money(fundedTotal)}
        </Typography>
      </Paper>

      <Paper variant='outlined' sx={{ borderRadius: 2, overflow: 'auto' }}>
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>Policy</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align='right'>Term Premium</TableCell>
              <TableCell align='right'>MGA Net Com</TableCell>
              <TableCell align='right'>UEP % Req</TableCell>
              <TableCell align='right'>Received NEP %</TableCell>
              <TableCell align='right'>Selected %</TableCell>
              <TableCell align='right'>Funded UEP $</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.policy_id}>
                <TableCell>{r.client_name ?? `#${r.policy_id}`}</TableCell>
                <TableCell>{r.line_of_business ?? '—'}</TableCell>
                <TableCell>{r.status_as_of_rpt_date ?? '—'}</TableCell>
                <TableCell align='right'>{money(r.total_term_premium)}</TableCell>
                <TableCell align='right'>{money(r.mga_net_com_amt)}</TableCell>
                <TableCell align='right'>{pct(r.uep_pct_required)}</TableCell>
                <TableCell align='right'>{pct(r.received_nep_pct)}</TableCell>
                <TableCell align='right'>
                  {pct(r.selected_net_com_uep_pct)}
                </TableCell>
                <TableCell align='right'>{money(r.mga_net_com_uep_amt)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} sx={{ color: 'text.disabled' }}>
                  {query.isLoading ? 'Loading…' : 'No policies as of this date.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
