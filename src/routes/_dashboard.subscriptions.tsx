/**
 * Subscription builder — multi-carrier co-insurance (INPUT-CHECKOUT Section 5).
 * Pick a policy, name the market lead, add one carrier row per participant, and
 * submit once the participation balance reaches 100.00000%. Writes via the
 * create_subscription RPC (header + rows + flags the policy placement_type).
 */
import { money, pct as pctFmt } from '#/lib/money';
import { useAuth } from '#/context/AuthContext';
import { supabase } from '#/supabaseClient';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export const Route = createFileRoute('/_dashboard/subscriptions')({
  component: SubscriptionBuilder,
});

interface Opt {
  id: number;
  label: string;
  total_term_premium?: number | null;
}
interface ParticipantRow {
  carrier: Opt | null;
  role: string;
  pctText: string;
}

const ROLES = [
  { value: 'lead', label: 'Lead (within our group)' },
  { value: 'following', label: 'Following' },
  { value: 'na', label: 'N/A' },
];

const useOptions = (
  table: string,
  columns: string,
  toLabel: (r: Record<string, unknown>) => string,
) =>
  useQuery({
    queryKey: ['subs-opts', table],
    queryFn: async (): Promise<Opt[]> => {
      const { data, error } = await supabase
        .from(table as never)
        .select(columns)
        .limit(200);
      if (error) throw error;
      return (data as unknown as Record<string, unknown>[]).map((r) => ({
        id: r.id as number,
        label: toLabel(r),
        total_term_premium: r.total_term_premium as number | undefined,
      }));
    },
  });

function SubscriptionBuilder() {
  const { can } = useAuth();
  const canWrite = can('subscription', 'write');
  const [policy, setPolicy] = useState<Opt | null>(null);
  const [marketLead, setMarketLead] = useState('');
  const [rows, setRows] = useState<ParticipantRow[]>([
    { carrier: null, role: 'lead', pctText: '' },
  ]);

  const policies = useOptions(
    'policies_computed',
    'id, pol_ref, policy_number, total_term_premium',
    (r) =>
      [r.pol_ref, r.policy_number].filter(Boolean).join(' · ') ||
      `Policy #${r.id}`,
  );
  const carriers = useOptions('carriers', 'id, carrier_name', (r) =>
    (r.carrier_name as string) || `Carrier #${r.id}`,
  );

  const totalPct = rows.reduce((a, r) => a + (Number(r.pctText) || 0) / 100, 0);
  const balanced = Math.abs(totalPct - 1) < 0.0000001;
  const termPremium = policy?.total_term_premium ?? null;

  const setRow = (i: number, patch: Partial<ParticipantRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () =>
    setRows((rs) => [...rs, { carrier: null, role: 'following', pctText: '' }]);
  const removeRow = (i: number) =>
    setRows((rs) => rs.filter((_, idx) => idx !== i));

  const submit = useMutation({
    mutationFn: async () => {
      if (!policy) throw new Error('Select a policy');
      const participants = rows
        .filter((r) => r.carrier)
        .map((r) => ({
          carrier_id: r.carrier?.id,
          role: r.role,
          participation_pct: (Number(r.pctText) || 0) / 100,
        }));
      if (participants.length === 0)
        throw new Error('Add at least one participant');
      const { data, error } = await supabase.rpc('create_subscription', {
        p_policy_id: policy.id,
        p_market_lead_carrier: marketLead || 'Unknown',
        p_participants: participants,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (id) => {
      toast.success(`Subscription created (#${id})`);
      setPolicy(null);
      setMarketLead('');
      setRows([{ carrier: null, role: 'lead', pctText: '' }]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Box sx={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
          Subscription builder
        </Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
          Multi-carrier co-insurance (quota share). Participation must total
          100.00000%.
        </Typography>
      </Box>

      <Paper variant='outlined' sx={{ p: 3, borderRadius: 2 }}>
        <Stack spacing={2}>
          <Autocomplete<Opt>
            options={policies.data ?? []}
            value={policy}
            onChange={(_, v) => setPolicy(v)}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(p) => <TextField {...p} label='Policy' />}
          />
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              label='Market lead carrier'
              helperText='Who set terms for the whole placement (may not be a participant)'
              value={marketLead}
              onChange={(e) => setMarketLead(e.target.value)}
              fullWidth
            />
            <Box sx={{ minWidth: 180, textAlign: 'right' }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                Total term premium
              </Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 700 }}>
                {money(termPremium)}
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Paper>

      <Paper variant='outlined' sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box
          sx={(t) => ({
            px: 2,
            py: 1.5,
            borderBottom: `1px solid ${t.palette.divider}`,
            fontWeight: 700,
            fontSize: 14,
            display: 'flex',
            justifyContent: 'space-between',
          })}
        >
          Carrier participation
          <Box
            component='span'
            sx={{ color: balanced ? 'success.main' : 'error.main' }}
          >
            {balanced ? '✓ ' : '✗ '}
            {pctFmt(totalPct, 5)}
          </Box>
        </Box>
        <Stack sx={{ p: 2 }} spacing={1.5}>
          {rows.map((r, i) => (
            <Box
              key={i}
              sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}
            >
              <Autocomplete<Opt>
                sx={{ flex: 1 }}
                options={carriers.data ?? []}
                value={r.carrier}
                onChange={(_, v) => setRow(i, { carrier: v })}
                getOptionLabel={(o) => o.label}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                renderInput={(p) => <TextField {...p} label='Carrier' />}
              />
              <TextField
                label='Role'
                select
                value={r.role}
                onChange={(e) => setRow(i, { role: e.target.value })}
                sx={{ minWidth: 200 }}
              >
                {ROLES.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label='Share'
                value={r.pctText}
                onChange={(e) => setRow(i, { pctText: e.target.value })}
                sx={{ width: 120 }}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position='end'>%</InputAdornment>
                    ),
                  },
                  htmlInput: { inputMode: 'decimal' },
                }}
              />
              <Box sx={{ width: 110, textAlign: 'right', fontSize: 13 }}>
                {termPremium != null
                  ? money(((Number(r.pctText) || 0) / 100) * termPremium)
                  : '—'}
              </Box>
              <IconButton
                size='small'
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
              >
                <Trash2 size={16} />
              </IconButton>
            </Box>
          ))}
          <Box>
            <Button startIcon={<Plus size={16} />} onClick={addRow} size='small'>
              Add carrier
            </Button>
          </Box>
        </Stack>
      </Paper>

      {canWrite && (
        <Box>
          <Button
            variant='contained'
            disabled={!policy || !balanced || submit.isPending}
            onClick={() => submit.mutate()}
          >
            Create subscription
          </Button>
          {!balanced && (
            <Typography
              component='span'
              sx={{ ml: 2, fontSize: 13, color: 'text.secondary' }}
            >
              Participation must total 100% to submit.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
