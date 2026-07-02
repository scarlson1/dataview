/**
 * Budget proforma — forward GWP targets vs bound premium vs renewal-pipeline
 * weighted premium, by line of business for a chosen year. Targets are entered
 * on the budget_targets table (New Budget Target form); this page rolls them up
 * against actuals from policies_computed and renewals_computed.
 */
import { money } from '#/lib/money';
import { supabase } from '#/supabaseClient';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
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
import { useState } from 'react';

export const Route = createFileRoute('/_dashboard/budget')({
  component: BudgetProforma,
});

interface LobAgg {
  lob: string;
  budget: number;
  bound: number;
  pipeline: number;
}

const yearOf = (d: string | null | undefined): number | null =>
  d ? Number(d.slice(0, 4)) : null;

function BudgetProforma() {
  const now = new Date().getFullYear();
  const [year, setYear] = useState(now);

  const query = useQuery({
    queryKey: ['budget-proforma', year],
    queryFn: async () => {
      const [targets, policies, renewals] = await Promise.all([
        supabase
          .from('budget_targets')
          .select('line_of_business, gwp_target, year')
          .eq('year', year),
        supabase
          .from('policies_computed')
          .select('id, line_of_business, total_term_premium, policy_eff_date, transaction_type'),
        supabase.from('renewals_computed').select('policy_id, ev_rnw_gwp'),
      ]);
      if (targets.error) throw targets.error;
      if (policies.error) throw policies.error;
      if (renewals.error) throw renewals.error;

      // Renewals carry their LOB via the (expiring) policy, not on the view.
      const lobByPolicy = new Map<number, string | null>();
      for (const p of policies.data ?? [])
        lobByPolicy.set(p.id as number, p.line_of_business);

      const map = new Map<string, LobAgg>();
      const get = (lob: string | null): LobAgg => {
        const key = lob || '—';
        let a = map.get(key);
        if (!a) {
          a = { lob: key, budget: 0, bound: 0, pipeline: 0 };
          map.set(key, a);
        }
        return a;
      };

      for (const t of targets.data ?? [])
        get(t.line_of_business).budget += Number(t.gwp_target) || 0;
      for (const p of policies.data ?? []) {
        if (yearOf(p.policy_eff_date) !== year) continue;
        get(p.line_of_business).bound += Number(p.total_term_premium) || 0;
      }
      for (const r of renewals.data ?? []) {
        const lob = r.policy_id != null ? lobByPolicy.get(r.policy_id) ?? null : null;
        get(lob).pipeline += Number(r.ev_rnw_gwp) || 0;
      }

      return Array.from(map.values()).sort((a, b) => b.budget - a.budget);
    },
  });

  const rows = query.data ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      budget: acc.budget + r.budget,
      bound: acc.bound + r.bound,
      pipeline: acc.pipeline + r.pipeline,
    }),
    { budget: 0, bound: 0, pipeline: 0 },
  );

  const years = [now - 1, now, now + 1, now + 2];

  return (
    <Box sx={{ maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 3 }}>
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
            Budget proforma
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
            Target GWP vs bound premium vs renewal-pipeline weighted, by line of
            business.
          </Typography>
        </Box>
        <TextField
          label='Year'
          select
          size='small'
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          sx={{ minWidth: 120 }}
        >
          {years.map((y) => (
            <MenuItem key={y} value={y}>
              {y}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
        <Kpi label='Budget target' value={money(totals.budget)} />
        <Kpi label='Bound (actual)' value={money(totals.bound)} />
        <Kpi label='Renewal pipeline (weighted)' value={money(totals.pipeline)} />
      </Box>

      <Paper variant='outlined' sx={{ borderRadius: 2, overflow: 'auto' }}>
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>Line of business</TableCell>
              <TableCell align='right'>Budget</TableCell>
              <TableCell align='right'>Bound</TableCell>
              <TableCell align='right'>Pipeline (wtd)</TableCell>
              <TableCell align='right'>Total proforma</TableCell>
              <TableCell align='right'>vs Budget</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => {
              const proforma = r.bound + r.pipeline;
              const variance = proforma - r.budget;
              return (
                <TableRow key={r.lob}>
                  <TableCell>{r.lob}</TableCell>
                  <TableCell align='right'>{money(r.budget)}</TableCell>
                  <TableCell align='right'>{money(r.bound)}</TableCell>
                  <TableCell align='right'>{money(r.pipeline)}</TableCell>
                  <TableCell align='right'>{money(proforma)}</TableCell>
                  <TableCell
                    align='right'
                    sx={{ color: variance >= 0 ? 'success.main' : 'error.main' }}
                  >
                    {money(variance)}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} sx={{ color: 'text.disabled' }}>
                  {query.isLoading
                    ? 'Loading…'
                    : 'No budget targets or activity for this year.'}
                </TableCell>
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
