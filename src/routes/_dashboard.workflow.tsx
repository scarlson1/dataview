/**
 * Workflow board — drives the policy-cycle lifecycle functions (Postgres RPCs)
 * from the UI and surfaces the headline pipeline / reserve / receivable metrics.
 *
 *   New Business  -> Bind            (rpc bind_new_business)   => Policy
 *   Policy        -> Generate Invoice (rpc generate_invoice)   => INV -> AR -> CAP
 *   Receivable    -> Record Payment  (rpc record_ar_payment)   => balances update
 */
import { supabase } from '#/supabaseClient';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import { StatusChip } from '../components/StatusChip';
import { valueTone } from '../theme/tokens';

export const Route = createFileRoute('/_dashboard/workflow')({
  component: WorkflowPage,
});

const money = (n: number | null | undefined): string =>
  n == null
    ? '—'
    : n.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });

interface ClientRef {
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
}
const clientName = (c: ClientRef | null | undefined): string => {
  if (!c) return '—';
  if (c.company_name) return c.company_name;
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || '—';
};

interface NbsRow {
  id: number;
  nbs_ref: string;
  submission_number: string | null;
  stage: string;
  policy_id: number | null;
  line_of_business: string | null;
  clients: ClientRef | null;
}
interface PolicyRow {
  id: number;
  pol_ref: string;
  transaction_type: string;
  carrier_id: number | null;
  total_term_prem_fees: number | null;
}
interface ArRow {
  id: number;
  ar_ref: string;
  ar_status: string;
  invoice_total: number | null;
  total_paid: number | null;
  balance_due: number | null;
}

function WorkflowPage() {
  const qc = useQueryClient();

  const nbsQuery = useQuery({
    queryKey: ['wf', 'nbs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('new_business_submissions')
        .select(
          'id, nbs_ref, submission_number, stage, policy_id, line_of_business, clients(company_name, first_name, last_name)',
        )
        .order('id');
      if (error) throw error;
      return data as unknown as NbsRow[];
    },
  });

  const policiesQuery = useQuery({
    queryKey: ['wf', 'policies'],
    queryFn: async () => {
      const [pc, inv] = await Promise.all([
        supabase
          .from('policies_computed')
          .select('id, pol_ref, transaction_type, carrier_id, total_term_prem_fees')
          .order('id'),
        supabase.from('invoices').select('policy_id'),
      ]);
      if (pc.error) throw pc.error;
      if (inv.error) throw inv.error;
      const invoiced = new Set((inv.data ?? []).map((r) => r.policy_id));
      return (pc.data as unknown as PolicyRow[]).map((p) => ({
        ...p,
        invoiced: invoiced.has(p.id),
      }));
    },
  });

  const arQuery = useQuery({
    queryKey: ['wf', 'ar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_receivable_computed')
        .select('id, ar_ref, ar_status, invoice_total, total_paid, balance_due')
        .order('id');
      if (error) throw error;
      return data as unknown as ArRow[];
    },
  });

  const kpiQuery = useQuery({
    queryKey: ['wf', 'kpis'],
    queryFn: async () => {
      const [rnw, uep] = await Promise.all([
        supabase.from('renewals_computed').select('ev_rnw_gwp'),
        supabase.from('net_com_uep').select('mga_net_com_uep_amt'),
      ]);
      if (rnw.error) throw rnw.error;
      if (uep.error) throw uep.error;
      const sum = (rows: { [k: string]: unknown }[], key: string) =>
        rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
      return {
        pipelineEvGwp: sum(rnw.data ?? [], 'ev_rnw_gwp'),
        uepReserve: sum(uep.data ?? [], 'mga_net_com_uep_amt'),
      };
    },
  });

  const outstandingAr = (arQuery.data ?? []).reduce(
    (acc, r) => acc + Math.max(Number(r.balance_due) || 0, 0),
    0,
  );

  const invalidate = () => {
    for (const k of ['nbs', 'policies', 'ar', 'kpis'])
      qc.invalidateQueries({ queryKey: ['wf', k] });
    qc.invalidateQueries({ queryKey: ['table-data'] });
  };

  const bind = useMutation({
    mutationFn: async (nbsId: number) => {
      const { data, error } = await supabase.rpc('bind_new_business', {
        p_nbs_id: nbsId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (policyId) => {
      toast.success(`Bound → policy #${policyId}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invoice = useMutation({
    mutationFn: async (policyId: number) => {
      const { data, error } = await supabase.rpc('generate_invoice', {
        p_policy_id: policyId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (invId) => {
      toast.success(`Invoice #${invId} generated (INV → AR → CAP)`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: async (vars: { arId: number; amount: number }) => {
      const { data, error } = await supabase.rpc('record_ar_payment', {
        p_ar_id: vars.arId,
        p_amount: vars.amount,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Payment recorded');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const promptPayment = (row: ArRow) => {
    const suggested = Math.max(Number(row.balance_due) || 0, 0);
    const raw = window.prompt(
      `Payment amount for ${row.ar_ref} (balance ${money(row.balance_due)})`,
      String(suggested),
    );
    if (raw == null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a positive amount');
      return;
    }
    pay.mutate({ arId: row.id, amount });
  };

  const unboundNbs = (nbsQuery.data ?? []).filter((n) => n.policy_id == null);
  const uninvoiced = (policiesQuery.data ?? []).filter((p) => !p.invoiced);
  const openAr = (arQuery.data ?? []).filter(
    (r) => (Number(r.balance_due) || 0) > 0,
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1100 }}>
      <Box>
        <Typography sx={{ fontSize: 22, fontWeight: 700 }}>Workflow</Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
          Drive the policy lifecycle: bind submissions, invoice policies, and collect receivables.
        </Typography>
      </Box>

      {/* KPIs */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
        <Kpi label="Pipeline Expected GWP" value={money(kpiQuery.data?.pipelineEvGwp)} />
        <Kpi label="Funded Net-Com UEP Reserve" value={money(kpiQuery.data?.uepReserve)} />
        <Kpi label="Outstanding Receivables" value={money(outstandingAr)} />
      </Box>

      {/* New Business pipeline */}
      <Section
        title="New Business — ready to bind"
        empty={unboundNbs.length === 0}
        emptyText="No unbound submissions."
      >
        {unboundNbs.map((n) => (
          <Row key={n.id}>
            <Mono>{n.nbs_ref}</Mono>
            <Cell grow>{clientName(n.clients)}</Cell>
            <Cell>{n.line_of_business ?? '—'}</Cell>
            <StatusChip label={labelize(n.stage)} tone={valueTone(n.stage)} />
            <Button
              size="small"
              variant="contained"
              disabled={bind.isPending}
              onClick={() => bind.mutate(n.id)}
            >
              Bind
            </Button>
          </Row>
        ))}
      </Section>

      {/* Policies needing an invoice */}
      <Section
        title="Policies — ready to invoice"
        empty={uninvoiced.length === 0}
        emptyText="Every policy has been invoiced."
      >
        {uninvoiced.map((p) => (
          <Row key={p.id}>
            <Mono>{p.pol_ref}</Mono>
            <Cell grow>{labelize(p.transaction_type)}</Cell>
            <Cell>{money(p.total_term_prem_fees)}</Cell>
            <Cell>{p.carrier_id == null ? 'subscription' : 'single carrier'}</Cell>
            <Button
              size="small"
              variant="contained"
              disabled={invoice.isPending}
              onClick={() => invoice.mutate(p.id)}
            >
              Generate Invoice
            </Button>
          </Row>
        ))}
      </Section>

      {/* Receivables */}
      <Section
        title="Receivables — open balances"
        empty={openAr.length === 0}
        emptyText="No open receivables."
      >
        {openAr.map((r) => (
          <Row key={r.id}>
            <Mono>{r.ar_ref}</Mono>
            <Cell grow>
              {money(r.total_paid)} / {money(r.invoice_total)} collected
            </Cell>
            <Cell>Balance {money(r.balance_due)}</Cell>
            <StatusChip label={labelize(r.ar_status)} tone={valueTone(r.ar_status)} />
            <Button
              size="small"
              variant="outlined"
              disabled={pay.isPending}
              onClick={() => promptPayment(r)}
            >
              Record Payment
            </Button>
          </Row>
        ))}
      </Section>
    </Box>
  );
}

const labelize = (s: string): string =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

const Kpi = ({ label, value }: { label: string; value: string }) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
    <Typography sx={{ fontSize: 12.5, color: 'text.secondary', fontWeight: 600 }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: 26, fontWeight: 700, mt: 0.5 }}>{value}</Typography>
  </Paper>
);

const Section = ({
  title,
  empty,
  emptyText,
  children,
}: {
  title: string;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) => (
  <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
    <Box
      sx={(t) => ({
        px: 2,
        py: 1.5,
        borderBottom: `1px solid ${t.palette.divider}`,
        fontSize: 14,
        fontWeight: 700,
      })}
    >
      {title}
    </Box>
    {empty ? (
      <Box sx={{ px: 2, py: 3, color: 'text.disabled', fontSize: 13.5 }}>{emptyText}</Box>
    ) : (
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>{children}</Box>
    )}
  </Paper>
);

const Row = ({ children }: { children: React.ReactNode }) => (
  <Box
    sx={(t) => ({
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      px: 2,
      py: 1.25,
      borderBottom: `1px solid ${t.palette.divider}`,
      '&:last-of-type': { borderBottom: 'none' },
    })}
  >
    {children}
  </Box>
);

const Cell = ({ children, grow }: { children: React.ReactNode; grow?: boolean }) => (
  <Box sx={{ flex: grow ? 1 : 'none', fontSize: 13.5, color: 'text.secondary' }}>
    {children}
  </Box>
);

const Mono = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ fontFamily: 'monospace', fontSize: 13, minWidth: 120 }}>{children}</Box>
);
