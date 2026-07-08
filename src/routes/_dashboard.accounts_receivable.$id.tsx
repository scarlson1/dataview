/**
 * Bespoke AR detail — the receivable header (invoice total, paid, balance, aging)
 * with its payment history and a Record Payment action. The generic flat detail
 * page can't show the child payments or the running balance, which is the point
 * of an AR file. Reads accounts_receivable_computed for the live balance.
 */

import { RecordPaymentDialog } from '#/components/RecordPaymentDialog';
import { StatusChip } from '#/components/StatusChip';
import { useAuth } from '#/context/AuthContext';
import { labelize, money } from '#/lib/money';
import { supabase } from '#/supabaseClient';
import { valueTone } from '#/theme/tokens';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, FileText, Plus } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_dashboard/accounts_receivable/$id')({
  component: ArDetail,
  loader: ({ params }) => ({ crumb: params.id }),
});

interface ArRow {
  id: number;
  ar_ref: string | null;
  inv_id: number | null;
  policy_id: number | null;
  client_id: number | null;
  invoice_date: string | null;
  due_date: string | null;
  invoice_total: number | null;
  total_paid: number | null;
  balance_due: number | null;
  days_outstanding: number | null;
  last_payment_date: string | null;
  ar_status: string | null;
  write_off_amt: number | null;
  collection_notes: string | null;
}
interface PaymentRow {
  id: number;
  arpm_ref: string | null;
  payment_date: string | null;
  payment_amount: number | null;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
}

const HeaderField = ({ label, value }: { label: string; value: string }) => (
  <Box>
    <Typography
      sx={{
        fontSize: 11.5,
        fontWeight: 600,
        color: 'text.secondary',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </Typography>
    <Typography sx={{ fontSize: 14, mt: 0.25 }}>{value}</Typography>
  </Box>
);

function ArDetail() {
  const { id } = Route.useParams();
  const arId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const canRecordPayment = can('accounts_receivable_payments', 'write');
  const [payOpen, setPayOpen] = useState(false);

  const arQuery = useQuery({
    queryKey: ['ar-detail', arId],
    queryFn: async () => {
      const arRes = await supabase
        .from('accounts_receivable_computed')
        .select('*')
        .eq('id', arId)
        .single();
      if (arRes.error) throw arRes.error;
      const ar = arRes.data as unknown as ArRow;
      let clientName: string | null = null;
      if (ar.client_id != null) {
        const { data } = await supabase
          .from('clients')
          .select('company_name, first_name, last_name')
          .eq('id', ar.client_id)
          .single();
        const c = data as {
          company_name: string | null;
          first_name: string | null;
          last_name: string | null;
        } | null;
        clientName =
          c?.company_name ||
          [c?.first_name, c?.last_name].filter(Boolean).join(' ') ||
          null;
      }
      return { ar, clientName };
    },
  });

  const paymentsQuery = useQuery({
    queryKey: ['ar-payments', arId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_receivable_payments')
        .select(
          'id, arpm_ref, payment_date, payment_amount, payment_method, reference_number, notes',
        )
        .eq('ar_id', arId)
        .order('payment_date');
      if (error) throw error;
      return data as unknown as PaymentRow[];
    },
  });

  const ar = arQuery.data?.ar;
  const clientName = arQuery.data?.clientName;
  const payments = paymentsQuery.data ?? [];
  const title = ar?.ar_ref ?? `AR #${id}`;
  const balance = Number(ar?.balance_due) || 0;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ar-detail', arId] });
    qc.invalidateQueries({ queryKey: ['ar-payments', arId] });
    qc.invalidateQueries({ queryKey: ['table-data'] });
    qc.invalidateQueries({ queryKey: ['agd-aging'] });
  };

  return (
    <Box sx={{ maxWidth: 1000 }}>
      <Button
        size='small'
        startIcon={<ArrowLeft size={16} />}
        onClick={() =>
          navigate({ to: '/$table', params: { table: 'accounts_receivable' } })
        }
        sx={{ mb: 2 }}
      >
        Accounts Receivable
      </Button>

      {arQuery.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : arQuery.isError ? (
        <Typography color='error'>
          {(arQuery.error as Error)?.message ?? 'Failed to load receivable.'}
        </Typography>
      ) : ar ? (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography
                sx={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace' }}
              >
                {title}
              </Typography>
              {ar.ar_status && (
                <StatusChip
                  label={labelize(ar.ar_status)}
                  tone={valueTone(ar.ar_status)}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {ar.inv_id != null && (
                <Button
                  variant='outlined'
                  startIcon={<FileText size={16} />}
                  onClick={() =>
                    navigate({
                      to: '/invoices/$id',
                      params: { id: String(ar.inv_id) },
                    })
                  }
                >
                  Invoice
                </Button>
              )}
              {canRecordPayment && (
                <Button
                  variant='contained'
                  startIcon={<Plus size={16} />}
                  disabled={balance <= 0}
                  onClick={() => setPayOpen(true)}
                >
                  Record payment
                </Button>
              )}
            </Box>
          </Box>

          <Paper variant='outlined' sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 2.5,
              }}
            >
              <HeaderField label='Client' value={clientName ?? '—'} />
              <HeaderField
                label='Invoice date'
                value={ar.invoice_date ?? '—'}
              />
              <HeaderField label='Due date' value={ar.due_date ?? '—'} />
              <HeaderField
                label='Invoice total'
                value={money(ar.invoice_total)}
              />
              <HeaderField label='Total paid' value={money(ar.total_paid)} />
              <HeaderField label='Balance due' value={money(ar.balance_due)} />
              <HeaderField
                label='Days outstanding'
                value={
                  ar.days_outstanding != null
                    ? String(ar.days_outstanding)
                    : '—'
                }
              />
              <HeaderField
                label='Last payment'
                value={ar.last_payment_date ?? '—'}
              />
              {Number(ar.write_off_amt) > 0 && (
                <HeaderField
                  label='Written off'
                  value={money(ar.write_off_amt)}
                />
              )}
            </Box>
            {ar.collection_notes && (
              <Typography
                sx={{ fontSize: 13.5, color: 'text.secondary', mt: 2 }}
              >
                {ar.collection_notes}
              </Typography>
            )}
          </Paper>

          <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1.5 }}>
            Payments ({payments.length})
          </Typography>
          <Paper variant='outlined' sx={{ borderRadius: 2, overflow: 'auto' }}>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Reference</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Ref #</TableCell>
                  <TableCell align='right'>Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>
                      {p.arpm_ref}
                    </TableCell>
                    <TableCell>{p.payment_date ?? '—'}</TableCell>
                    <TableCell>{labelize(p.payment_method)}</TableCell>
                    <TableCell>{p.reference_number ?? '—'}</TableCell>
                    <TableCell align='right'>
                      {money(p.payment_amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ color: 'text.disabled' }}>
                      {paymentsQuery.isLoading
                        ? 'Loading…'
                        : 'No payments recorded.'}
                    </TableCell>
                  </TableRow>
                )}
                {payments.length > 0 && (
                  <TableRow
                    sx={{ '& td': { fontWeight: 700, borderTop: '2px solid' } }}
                  >
                    <TableCell colSpan={4}>Total paid</TableCell>
                    <TableCell align='right'>{money(ar.total_paid)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>

          <RecordPaymentDialog
            ar={{
              id: ar.id,
              ar_ref: ar.ar_ref ?? `AR #${ar.id}`,
              balance_due: ar.balance_due,
            }}
            open={payOpen}
            onClose={() => setPayOpen(false)}
            onRecorded={refresh}
          />
        </>
      ) : null}
    </Box>
  );
}
