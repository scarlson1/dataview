/**
 * Carrier Premium / Commission report — premium and commission by carrier,
 * combining single-carrier policy totals with each subscription participant's
 * share (backed by the carrier_prem_com_report view). Read-only with a CSV
 * export; totals foot to the portfolio.
 */
import { downloadCsv } from '#/lib/csv';
import { money } from '#/lib/money';
import { supabase } from '#/supabaseClient';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Download } from 'lucide-react';

export const Route = createFileRoute('/_dashboard/carrier-prem-com')({
  component: CarrierPremComReport,
});

interface CarrierRow {
  carrier_id: number;
  carrier_name: string | null;
  transaction_count: number | null;
  total_premium: number | null;
  total_gross_com: number | null;
  total_mga_net_com: number | null;
  total_carrier_net: number | null;
}

const num = (v: number | null): number => Number(v) || 0;

function CarrierPremComReport() {
  const query = useQuery({
    queryKey: ['carrier-prem-com'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carrier_prem_com_report')
        .select('*');
      if (error) throw new Error(error.message);
      return (data as unknown as CarrierRow[]).sort(
        (a, b) => num(b.total_premium) - num(a.total_premium),
      );
    },
  });

  const rows = query.data ?? [];
  const totals = rows.reduce(
    (a, r) => ({
      premium: a.premium + num(r.total_premium),
      gross: a.gross + num(r.total_gross_com),
      mga: a.mga + num(r.total_mga_net_com),
      carrier: a.carrier + num(r.total_carrier_net),
    }),
    { premium: 0, gross: 0, mga: 0, carrier: 0 },
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
            Carrier Premium / Commission
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
            Premium and commission by carrier, including subscription
            participation shares.
          </Typography>
        </Box>
        <Button
          variant='outlined'
          startIcon={<Download size={16} />}
          disabled={rows.length === 0}
          onClick={() =>
            downloadCsv(
              'carrier-prem-com',
              rows as unknown as Record<string, unknown>[],
            )
          }
        >
          CSV
        </Button>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr 1fr',
            md: 'repeat(4, 1fr)',
          },
          gap: 2,
        }}
      >
        <Kpi label='Total premium' value={money(totals.premium)} />
        <Kpi label='Gross commission' value={money(totals.gross)} />
        <Kpi label='MGA net commission' value={money(totals.mga)} />
        <Kpi label='Carrier net' value={money(totals.carrier)} />
      </Box>

      <Paper variant='outlined' sx={{ borderRadius: 2, overflow: 'auto' }}>
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>Carrier</TableCell>
              <TableCell align='right'>Txns</TableCell>
              <TableCell align='right'>Premium</TableCell>
              <TableCell align='right'>Gross com</TableCell>
              <TableCell align='right'>MGA net com</TableCell>
              <TableCell align='right'>Carrier net</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.carrier_id}>
                <TableCell>{r.carrier_name ?? '—'}</TableCell>
                <TableCell align='right'>{r.transaction_count ?? 0}</TableCell>
                <TableCell align='right'>{money(r.total_premium)}</TableCell>
                <TableCell align='right'>{money(r.total_gross_com)}</TableCell>
                <TableCell align='right'>{money(r.total_mga_net_com)}</TableCell>
                <TableCell align='right'>{money(r.total_carrier_net)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} sx={{ color: 'text.disabled' }}>
                  {query.isLoading ? 'Loading…' : 'No carrier activity.'}
                </TableCell>
              </TableRow>
            )}
            {rows.length > 0 && (
              <TableRow sx={{ '& td': { fontWeight: 700, borderTop: '2px solid' } }}>
                <TableCell>Total</TableCell>
                <TableCell align='right' />
                <TableCell align='right'>{money(totals.premium)}</TableCell>
                <TableCell align='right'>{money(totals.gross)}</TableCell>
                <TableCell align='right'>{money(totals.mga)}</TableCell>
                <TableCell align='right'>{money(totals.carrier)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

const Kpi = ({ label, value }: { label: string; value: string }) => (
  <Paper variant='outlined' sx={{ p: 2, borderRadius: 2 }}>
    <Typography sx={{ fontSize: 12.5, color: 'text.secondary', fontWeight: 600 }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: 22, fontWeight: 700, mt: 0.5 }}>{value}</Typography>
  </Paper>
);
