/**
 * Bespoke invoice detail — the invoice header plus a premium/fee breakdown that
 * foots to the amount billed (total_term_prem_fees), with links to the policy it
 * bills and the AR it feeds. The generic flat detail can't group the premium vs.
 * fees vs. commission build-up, which is what an invoice is.
 */
import { StatusChip } from '#/components/StatusChip';
import { labelize, money, pct } from '#/lib/money';
import { supabase } from '#/supabaseClient';
import { valueTone } from '#/theme/tokens';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Receipt, ScrollText } from 'lucide-react';

export const Route = createFileRoute('/_dashboard/invoices/$id')({
  component: InvoiceDetail,
});

interface InvoiceRow {
  id: number;
  inv_ref: string | null;
  policy_id: number | null;
  ar_id: number | null;
  agent_id: number | null;
  transaction_type: string | null;
  invoice_date: string | null;
  due_date: string | null;
  policy_eff_date: string | null;
  policy_exp_date: string | null;
  term_premium: number | null;
  term_terrorism_premium: number | null;
  total_term_premium: number | null;
  policy_fee: number | null;
  inspection_fee: number | null;
  other_fees: number | null;
  other_fee_description: string | null;
  total_term_prem_fees: number | null;
  mga_net_com_pct: number | null;
  mga_net_com_amt: number | null;
  invoice_status: string | null;
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

const Line = ({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) => (
  <TableRow sx={bold ? { '& td': { fontWeight: 700, borderTop: '2px solid' } } : undefined}>
    <TableCell sx={{ color: muted ? 'text.secondary' : undefined, pl: muted ? 4 : 2 }}>
      {label}
    </TableCell>
    <TableCell align='right'>{value}</TableCell>
  </TableRow>
);

function InvoiceDetail() {
  const { id } = Route.useParams();
  const invId = Number(id);
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['invoice-detail', invId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invId)
        .single();
      if (error) throw error;
      return data as unknown as InvoiceRow;
    },
  });

  const inv = query.data;
  const title = inv?.inv_ref ?? `Invoice #${id}`;
  const hasOther = Number(inv?.other_fees) > 0;

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Button
        size='small'
        startIcon={<ArrowLeft size={16} />}
        onClick={() => navigate({ to: '/$table', params: { table: 'invoices' } })}
        sx={{ mb: 2 }}
      >
        Invoices
      </Button>

      {query.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : query.isError ? (
        <Typography color='error'>
          {(query.error as Error)?.message ?? 'Failed to load invoice.'}
        </Typography>
      ) : inv ? (
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
              {inv.invoice_status && (
                <StatusChip
                  label={labelize(inv.invoice_status)}
                  tone={valueTone(inv.invoice_status)}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {inv.policy_id != null && (
                <Button
                  variant='outlined'
                  startIcon={<ScrollText size={16} />}
                  onClick={() =>
                    navigate({
                      to: '/$table/$id',
                      params: { table: 'policies', id: String(inv.policy_id) },
                    })
                  }
                >
                  Policy
                </Button>
              )}
              {inv.ar_id != null && (
                <Button
                  variant='outlined'
                  startIcon={<Receipt size={16} />}
                  onClick={() =>
                    navigate({
                      to: '/accounts_receivable/$id',
                      params: { id: String(inv.ar_id) },
                    })
                  }
                >
                  Receivable
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
              <HeaderField label='Transaction' value={labelize(inv.transaction_type)} />
              <HeaderField label='Invoice date' value={inv.invoice_date ?? '—'} />
              <HeaderField label='Due date' value={inv.due_date ?? '—'} />
              <HeaderField label='Policy effective' value={inv.policy_eff_date ?? '—'} />
              <HeaderField label='Policy expiry' value={inv.policy_exp_date ?? '—'} />
            </Box>
          </Paper>

          <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1.5 }}>
            Premium & fees
          </Typography>
          <Paper variant='outlined' sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Table size='small'>
              <TableBody>
                <Line label='Term premium' value={money(inv.term_premium)} />
                {Number(inv.term_terrorism_premium) > 0 && (
                  <Line
                    label='Terrorism premium'
                    value={money(inv.term_terrorism_premium)}
                    muted
                  />
                )}
                <Line label='Total term premium' value={money(inv.total_term_premium)} bold />
                <Line label='Policy fee' value={money(inv.policy_fee)} muted />
                <Line label='Inspection fee' value={money(inv.inspection_fee)} muted />
                {hasOther && (
                  <Line
                    label={inv.other_fee_description || 'Other fees'}
                    value={money(inv.other_fees)}
                    muted
                  />
                )}
                <Line label='Total premium + fees' value={money(inv.total_term_prem_fees)} bold />
                <Line
                  label={`MGA net commission (${pct(inv.mga_net_com_pct)})`}
                  value={money(inv.mga_net_com_amt)}
                  muted
                />
              </TableBody>
            </Table>
          </Paper>

          {inv.notes && (
            <Typography sx={{ fontSize: 13.5, color: 'text.secondary', mt: 2 }}>
              {inv.notes}
            </Typography>
          )}
        </>
      ) : null}
    </Box>
  );
}
