/**
 * Workflow board — drives the policy-cycle lifecycle functions (Postgres RPCs)
 * from the UI and surfaces the headline pipeline / reserve / receivable metrics.
 *
 *   New Business  -> Bind            (rpc bind_new_business)   => Policy
 *   Policy        -> Generate Invoice (rpc generate_invoice)   => INV -> AR -> CAP
 *   Receivable    -> Record Payment  (rpc record_ar_payment)   => balances update
 */

import { useAuth } from '#/context/AuthContext';
import { supabase } from '#/supabaseClient';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { RateActionButton } from '#/components/raters/RateActionButton';
import { RouterLink } from '#/components/RouterLink';
import { NewBusinessDrawer } from '../components/NewBusinessDrawer';
import {
  type ArTarget,
  RecordPaymentDialog,
} from '../components/RecordPaymentDialog';
import {
  type CapTarget,
  RecordRemittanceDialog,
} from '../components/RecordRemittanceDialog';
import { StatusChip } from '../components/StatusChip';
import { valueTone } from '../theme/tokens';

export const Route = createFileRoute('/_dashboard/workflow')({
  component: WorkflowPage,
  loader: () => ({ crumb: 'workflows' }),
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
interface CapRow {
  id: number;
  cap_ref: string;
  ap_status: string;
  net_premium_due_carrier: number | null;
  available_for_payment: number | null;
  balance_owing: number | null;
}
interface RenewalRow {
  id: number;
  rnw_ref: string;
  renewal_status: string;
  new_policy_id: number | null;
  days_to_renewal: number | null;
  ev_rnw_gwp: number | null;
}

function WorkflowPage() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const canWriteNbs = can('new_business_submissions', 'write');
  const canWritePolicies = can('policies', 'write');
  const canWriteInvoices = can('invoices', 'write');
  const canWritePayments = can('accounts_receivable_payments', 'write');
  const canWriteRemit = can('capacity_remittance', 'write');
  const canWriteRenewals = can('renewals', 'write');
  const canReadRaters = can('raters', 'read');
  const [newBusinessOpen, setNewBusinessOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<ArTarget | null>(null);
  const [remitTarget, setRemitTarget] = useState<CapTarget | null>(null);

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
          .select(
            'id, pol_ref, transaction_type, carrier_id, total_term_prem_fees',
          )
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

  const capQuery = useQuery({
    queryKey: ['wf', 'cap'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('capacity_computed')
        .select(
          'id, cap_ref, ap_status, net_premium_due_carrier, available_for_payment, balance_owing',
        )
        .order('id');
      if (error) throw error;
      return data as unknown as CapRow[];
    },
  });

  const renewalsQuery = useQuery({
    queryKey: ['wf', 'renewals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('renewals_computed')
        .select(
          'id, rnw_ref, renewal_status, new_policy_id, days_to_renewal, ev_rnw_gwp',
        )
        .order('days_to_renewal');
      if (error) throw error;
      return data as unknown as RenewalRow[];
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
    for (const k of ['nbs', 'policies', 'ar', 'cap', 'renewals', 'kpis'])
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

  const bindRenewal = useMutation({
    mutationFn: async (renewalId: number) => {
      const { data, error } = await supabase.rpc('bind_renewal', {
        p_renewal_id: renewalId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (policyId) => {
      toast.success(`Renewal bound → policy #${policyId}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const seedRenewals = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('seed_renewals', {
        p_days_ahead: 120,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      toast.success(`Seeded ${count ?? 0} renewal(s)`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unboundNbs = (nbsQuery.data ?? []).filter((n) => n.policy_id == null);
  const uninvoiced = (policiesQuery.data ?? []).filter((p) => !p.invoiced);
  const openAr = (arQuery.data ?? []).filter(
    (r) => (Number(r.balance_due) || 0) > 0,
  );
  const openCap = (capQuery.data ?? []).filter(
    (r) => (Number(r.balance_owing) || 0) > 0,
  );
  const openRenewals = (renewalsQuery.data ?? []).filter(
    (r) => r.new_policy_id == null,
  );

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1100 }}
    >
      <Box>
        <Typography sx={{ fontSize: 22, fontWeight: 700 }}>Workflow</Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
          Drive the policy lifecycle: bind submissions, invoice policies, and
          collect receivables.
        </Typography>
      </Box>

      {/* KPIs */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        <Kpi
          label='Pipeline Expected GWP'
          value={money(kpiQuery.data?.pipelineEvGwp)}
        />
        <Kpi
          label='Funded Net-Com UEP Reserve'
          value={money(kpiQuery.data?.uepReserve)}
        />
        <Kpi label='Outstanding Receivables' value={money(outstandingAr)} />
      </Box>

      {/* New Business pipeline */}
      <Section
        title='New Business — ready to bind'
        items={unboundNbs}
        emptyText='No unbound submissions.'
        viewAllTable='new_business_submissions'
        renderRow={(n) => (
          <>
            <Mono>{n.nbs_ref}</Mono>
            <Cell grow>{clientName(n.clients)}</Cell>
            <Cell>{n.line_of_business ?? '—'}</Cell>
            <StatusChip label={labelize(n.stage)} tone={valueTone(n.stage)} />
            {canReadRaters && (
              <RateActionButton
                table='new_business_submissions'
                recordId={n.id}
              />
            )}
            {canWritePolicies && (
              <Button
                size='small'
                variant='contained'
                disabled={bind.isPending}
                onClick={() => bind.mutate(n.id)}
              >
                Bind
              </Button>
            )}
          </>
        )}
        action={
          canWriteNbs ? (
            <Button
              size='small'
              variant='contained'
              startIcon={
                <Plus size={16} color={'var(--variant-containedColor)'} />
              }
              onClick={() => setNewBusinessOpen(true)}
            >
              New submission
            </Button>
          ) : undefined
        }
      />

      {/* Policies needing an invoice */}
      <Section
        title='Policies — ready to invoice'
        items={uninvoiced}
        emptyText='Every policy has been invoiced.'
        viewAllTable='policies'
        renderRow={(p) => (
          <>
            <Mono>{p.pol_ref}</Mono>
            <Cell grow>{labelize(p.transaction_type)}</Cell>
            <Cell>{money(p.total_term_prem_fees)}</Cell>
            <Cell>
              {p.carrier_id == null ? 'subscription' : 'single carrier'}
            </Cell>
            {canWriteInvoices && (
              <Button
                size='small'
                variant='contained'
                disabled={invoice.isPending}
                onClick={() => invoice.mutate(p.id)}
              >
                Generate Invoice
              </Button>
            )}
          </>
        )}
      />

      {/* Receivables */}
      <Section
        title='Receivables — open balances'
        items={openAr}
        emptyText='No open receivables.'
        viewAllTable='accounts_receivable'
        renderRow={(r) => (
          <>
            <Mono>{r.ar_ref}</Mono>
            <Cell grow>
              {money(r.total_paid)} / {money(r.invoice_total)} collected
            </Cell>
            <Cell>Balance {money(r.balance_due)}</Cell>
            <StatusChip
              label={labelize(r.ar_status)}
              tone={valueTone(r.ar_status)}
            />
            {canWritePayments && (
              <Button
                size='small'
                variant='outlined'
                onClick={() => setPayTarget(r)}
              >
                Record Payment
              </Button>
            )}
          </>
        )}
      />

      {/* Carrier AP — ready to remit */}
      <Section
        title='Carrier AP — ready to remit'
        items={openCap}
        emptyText='No open carrier payables.'
        viewAllTable='capacity'
        renderRow={(c) => (
          <>
            <Mono>{c.cap_ref}</Mono>
            <Cell grow>Net due {money(c.net_premium_due_carrier)}</Cell>
            <Cell>Available {money(c.available_for_payment)}</Cell>
            <Cell>Owing {money(c.balance_owing)}</Cell>
            <StatusChip
              label={labelize(c.ap_status)}
              tone={valueTone(c.ap_status)}
            />
            {canWriteRemit && (
              <Button
                size='small'
                variant='outlined'
                disabled={(Number(c.available_for_payment) || 0) <= 0}
                onClick={() => setRemitTarget(c)}
              >
                Record Remittance
              </Button>
            )}
          </>
        )}
      />

      {/* Renewals pipeline */}
      <Section
        title='Renewals — pipeline'
        items={openRenewals}
        emptyText='No renewals awaiting a bind. Seed the pipeline to pull upcoming expiries.'
        viewAllTable='renewals'
        renderRow={(r) => (
          <>
            <Mono>{r.rnw_ref}</Mono>
            <Cell grow>
              {r.days_to_renewal == null
                ? '—'
                : `${r.days_to_renewal} days to renewal`}
            </Cell>
            <Cell>EV GWP {money(r.ev_rnw_gwp)}</Cell>
            <StatusChip
              label={labelize(r.renewal_status)}
              tone={valueTone(r.renewal_status)}
            />
            {canWriteRenewals && (
              <Button
                size='small'
                variant='contained'
                disabled={bindRenewal.isPending}
                onClick={() => bindRenewal.mutate(r.id)}
              >
                Bind renewal
              </Button>
            )}
          </>
        )}
        action={
          canWriteRenewals ? (
            <Button
              size='small'
              variant='outlined'
              startIcon={<RefreshCw size={16} />}
              disabled={seedRenewals.isPending}
              onClick={() => seedRenewals.mutate()}
            >
              Seed renewals
            </Button>
          ) : undefined
        }
      />

      <NewBusinessDrawer
        open={newBusinessOpen}
        onClose={() => setNewBusinessOpen(false)}
        onCreated={() => qc.invalidateQueries({ queryKey: ['wf', 'nbs'] })}
      />
      <RecordPaymentDialog
        ar={payTarget}
        open={payTarget != null}
        onClose={() => setPayTarget(null)}
        onRecorded={invalidate}
      />
      <RecordRemittanceDialog
        cap={remitTarget}
        open={remitTarget != null}
        onClose={() => setRemitTarget(null)}
        onRecorded={invalidate}
      />
    </Box>
  );
}

const labelize = (s: string): string =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

const Kpi = ({ label, value }: { label: string; value: string }) => (
  <Paper variant='outlined' sx={{ p: 2, borderRadius: 2 }}>
    <Typography
      sx={{ fontSize: 12.5, color: 'text.secondary', fontWeight: 600 }}
    >
      {label}
    </Typography>
    <Typography sx={{ fontSize: 26, fontWeight: 700, mt: 0.5 }}>
      {value}
    </Typography>
  </Paper>
);

/** How many rows a section shows before collapsing behind "Show all". */
const ROW_CAP = 5;

function Section<T extends { id: number }>({
  title,
  items,
  emptyText,
  renderRow,
  viewAllTable,
  action,
}: {
  title: string;
  items: T[];
  emptyText: string;
  renderRow: (item: T) => React.ReactNode;
  /** Registered table name to deep-link to for the full list. */
  viewAllTable?: string;
  action?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, ROW_CAP);
  const hidden = items.length - shown.length;

  return (
    <Paper variant='outlined' sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box
        sx={(t) => ({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${t.palette.divider}`,
          fontSize: 14,
          fontWeight: 700,
        })}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {title}
          {items.length > 0 && (
            <Box
              component='span'
              sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.secondary' }}
            >
              {items.length}
            </Box>
          )}
        </Box>
        {action}
      </Box>
      {items.length === 0 ? (
        <Box sx={{ px: 2, py: 3, color: 'text.disabled', fontSize: 13.5 }}>
          {emptyText}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {shown.map((item) => (
            <Row key={item.id}>{renderRow(item)}</Row>
          ))}
        </Box>
      )}
      {items.length > ROW_CAP && (
        <Box
          sx={(t) => ({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: 2,
            py: 1,
            borderTop: `1px solid ${t.palette.divider}`,
          })}
        >
          <Button
            size='small'
            variant='text'
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Show less' : `Show all ${items.length}`}
          </Button>
          {!expanded && hidden > 0 && (
            <Box
              component='span'
              sx={{ fontSize: 12.5, color: 'text.secondary' }}
            >
              {hidden} more
              {viewAllTable ? ' · ' : ''}
              {viewAllTable && (
                <RouterLink
                  to='/$table'
                  params={{ table: viewAllTable }}
                  sx={{ fontSize: 12.5 }}
                >
                  open full view
                </RouterLink>
              )}
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => (
  <Box
    sx={(t) => ({
      display: 'flex',
      flexWrap: { xs: 'wrap', sm: 'nowrap' },
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

const Cell = ({
  children,
  grow,
}: {
  children: React.ReactNode;
  grow?: boolean;
}) => (
  <Box
    sx={{ flex: grow ? 1 : 'none', fontSize: 13.5, color: 'text.secondary' }}
  >
    {children}
  </Box>
);

const Mono = ({ children }: { children: React.ReactNode }) => (
  <Box
    sx={{
      fontFamily: 'monospace',
      fontSize: 13,
      minWidth: { xs: 'auto', sm: 120 },
    }}
  >
    {children}
  </Box>
);
