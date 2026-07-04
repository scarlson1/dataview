/**
 * Aged receivables (AGD) report — open AR balances bucketed by days outstanding
 * (Current / 1-30 / 31-60 / 61-90 / 90+), backed by the accounts_receivable_aging
 * view. Summary tiles foot to the open-AR total; rows link to the AR detail page.
 */
import { downloadCsv } from '#/lib/csv';
import { money } from '#/lib/money';
import { StatusChip } from '#/components/StatusChip';
import { supabase } from '#/supabaseClient';
import { valueTone } from '#/theme/tokens';
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
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Download } from 'lucide-react';

export const Route = createFileRoute('/_dashboard/agd')({
  component: AgdReport,
});

interface AgingRow {
  id: number;
  ar_ref: string | null;
  client_name: string | null;
  due_date: string | null;
  invoice_total: number | null;
  balance_due: number | null;
  days_outstanding: number | null;
  ar_status: string | null;
  aging_bucket: string | null;
}

const BUCKETS = ['current', '1-30', '31-60', '61-90', '90+'] as const;
const BUCKET_LABEL: Record<string, string> = {
  current: 'Current',
  '1-30': '1–30 days',
  '31-60': '31–60 days',
  '61-90': '61–90 days',
  '90+': '90+ days',
};
const num = (v: number | null): number => Number(v) || 0;

function AgdReport() {
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['agd-aging'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_receivable_aging')
        .select('*');
      if (error) throw new Error(error.message);
      // Report only open balances; the view emits 'paid' for settled rows.
      return (data as unknown as AgingRow[])
        .filter((r) => num(r.balance_due) > 0)
        .sort((a, b) => num(b.days_outstanding) - num(a.days_outstanding));
    },
  });

  const rows = query.data ?? [];
  const byBucket = (bucket: string): number =>
    rows
      .filter((r) => r.aging_bucket === bucket)
      .reduce((a, r) => a + num(r.balance_due), 0);
  const total = rows.reduce((a, r) => a + num(r.balance_due), 0);

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
            Aged Receivables (AGD)
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
            Open AR balances bucketed by days past due.
          </Typography>
        </Box>
        <Button
          variant='outlined'
          startIcon={<Download size={16} />}
          disabled={rows.length === 0}
          onClick={() =>
            downloadCsv(
              'aged-receivables',
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
            sm: 'repeat(3, 1fr)',
            md: 'repeat(6, 1fr)',
          },
          gap: 2,
        }}
      >
        {BUCKETS.map((b) => (
          <Kpi key={b} label={BUCKET_LABEL[b]} value={money(byBucket(b))} />
        ))}
        <Kpi label='Total open' value={money(total)} accent />
      </Box>

      <Paper variant='outlined' sx={{ borderRadius: 2, overflow: 'auto' }}>
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>AR</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Due date</TableCell>
              <TableCell align='right'>Invoice total</TableCell>
              <TableCell align='right'>Balance due</TableCell>
              <TableCell align='right'>Days</TableCell>
              <TableCell>Bucket</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.ar_ref}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() =>
                  navigate({
                    to: '/accounts_receivable/$id',
                    params: { id: String(r.id) },
                  })
                }
              >
                <TableCell sx={{ fontFamily: 'monospace' }}>{r.ar_ref}</TableCell>
                <TableCell>{r.client_name ?? '—'}</TableCell>
                <TableCell>{r.due_date ?? '—'}</TableCell>
                <TableCell align='right'>{money(r.invoice_total)}</TableCell>
                <TableCell align='right'>{money(r.balance_due)}</TableCell>
                <TableCell align='right'>{r.days_outstanding ?? 0}</TableCell>
                <TableCell>{r.aging_bucket ? BUCKET_LABEL[r.aging_bucket] : '—'}</TableCell>
                <TableCell>
                  {r.ar_status ? (
                    <StatusChip label={r.ar_status} tone={valueTone(r.ar_status)} />
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} sx={{ color: 'text.disabled' }}>
                  {query.isLoading ? 'Loading…' : 'No open receivables.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

const Kpi = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) => (
  <Paper
    variant='outlined'
    sx={{ p: 1.75, borderRadius: 2, borderColor: accent ? 'primary.main' : undefined }}
  >
    <Typography
      sx={{ fontSize: 11.5, color: 'text.secondary', fontWeight: 600, whiteSpace: 'nowrap' }}
    >
      {label}
    </Typography>
    <Typography sx={{ fontSize: 17, fontWeight: 700, mt: 0.5 }}>{value}</Typography>
  </Paper>
);
