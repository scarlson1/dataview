/**
 * Subscription builder — multi-carrier co-insurance (INPUT-CHECKOUT Section 5).
 * Name the market lead, add one carrier row per participant, and submit once the
 * participation balance reaches 100.00000%. Writes via the create_subscription
 * RPC (header + rows + flags the policy placement_type).
 *
 * Embedded on the policy detail page (via PolicyActions): the policy is already
 * in context, so it's passed in — no policy picker. Replaces the old standalone
 * /subscriptions page.
 */

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
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { money, pct as pctFmt } from '#/lib/money';
import { supabase } from '#/supabaseClient';

interface CarrierOpt {
  id: number;
  label: string;
}
interface ParticipantRow {
  uid: number;
  carrier: CarrierOpt | null;
  role: string;
  pctText: string;
}

let rowUid = 0;
const makeRow = (role: string): ParticipantRow => ({
  uid: ++rowUid,
  carrier: null,
  role,
  pctText: '',
});

const ROLES = [
  { value: 'lead', label: 'Lead (within our group)' },
  { value: 'following', label: 'Following' },
  { value: 'na', label: 'N/A' },
];

interface SubscriptionBuilderProps {
  policyId: number;
  polRef: string;
  onCreated: () => void;
  onClose: () => void;
}

export const SubscriptionBuilder = ({
  policyId,
  polRef,
  onCreated,
  onClose,
}: SubscriptionBuilderProps) => {
  const [marketLead, setMarketLead] = useState('');
  const [rows, setRows] = useState<ParticipantRow[]>([makeRow('lead')]);

  const policy = useQuery({
    queryKey: ['subs-policy-premium', policyId],
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from('policies_computed')
        .select('total_term_premium')
        .eq('id', policyId)
        .single();
      if (error) throw error;
      return (data as { total_term_premium: number | null }).total_term_premium;
    },
  });

  const carriers = useQuery({
    queryKey: ['subs-opts', 'carriers'],
    queryFn: async (): Promise<CarrierOpt[]> => {
      const { data, error } = await supabase
        .from('carriers')
        .select('id, carrier_name')
        .limit(200);
      if (error) throw error;
      return (data as unknown as Record<string, unknown>[]).map((r) => ({
        id: r.id as number,
        label: (r.carrier_name as string) || `Carrier #${r.id}`,
      }));
    },
  });

  const termPremium = policy.data ?? null;
  const totalPct = rows.reduce((a, r) => a + (Number(r.pctText) || 0) / 100, 0);
  const balanced = Math.abs(totalPct - 1) < 0.0000001;

  const setRow = (i: number, patch: Partial<ParticipantRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, makeRow('following')]);
  const removeRow = (i: number) =>
    setRows((rs) => rs.filter((_, idx) => idx !== i));

  const submit = useMutation({
    mutationFn: async () => {
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
        p_policy_id: policyId,
        p_market_lead_carrier: marketLead || 'Unknown',
        p_participants: participants,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (id) => {
      toast.success(`Subscription created (#${id})`);
      onCreated();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
        Multi-carrier co-insurance (quota share) for {polRef}. Participation
        must total 100.00000%.
      </Typography>

      <Paper variant='outlined' sx={{ p: 3, borderRadius: 2 }}>
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
              key={r.uid}
              sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}
            >
              <Autocomplete<CarrierOpt>
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
            <Button
              startIcon={<Plus size={16} />}
              onClick={addRow}
              size='small'
            >
              Add carrier
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
        <Button color='inherit' onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant='contained'
          disabled={!balanced || submit.isPending}
          onClick={() => submit.mutate()}
        >
          Create subscription
        </Button>
      </Box>
      {!balanced && (
        <Typography
          sx={{ fontSize: 13, color: 'text.secondary', textAlign: 'right' }}
        >
          Participation must total 100% to submit.
        </Typography>
      )}
    </Box>
  );
};

export default SubscriptionBuilder;
