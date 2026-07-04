/**
 * Mid-term policy actions surfaced on the policy detail page — Endorse, Cancel,
 * Reinstate — driven by the create_endorsement / cancel_policy / reinstate_policy
 * RPCs. Each books a new POL row linked to the head of the chain.
 */

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Stack,
  TextField,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { FilePlus2, RotateCcw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '#/context/AuthContext';
import { supabase } from '#/supabaseClient';

interface PolicyActionsProps {
  policyId: number;
  polRef: string;
  onDone: () => void;
}

type Mode = 'endorse' | 'cancel' | null;

export const PolicyActions = ({
  policyId,
  polRef,
  onDone,
}: PolicyActionsProps) => {
  const { can } = useAuth();
  const [mode, setMode] = useState<Mode>(null);
  const [txnEff, setTxnEff] = useState(dayjs().format('YYYY-MM-DD'));
  const [txnExp, setTxnExp] = useState('');
  const [premiumChange, setPremiumChange] = useState('');
  const [returnPremium, setReturnPremium] = useState('');
  const [reason, setReason] = useState('');

  const reset = () => {
    setTxnExp('');
    setPremiumChange('');
    setReturnPremium('');
    setReason('');
  };

  const endorse = useMutation({
    mutationFn: async () => {
      const change = Number(premiumChange);
      if (!Number.isFinite(change))
        throw new Error('Enter a premium change amount');
      const { data, error } = await supabase.rpc('create_endorsement', {
        p_policy_id: policyId,
        p_txn_eff_date: txnEff,
        p_premium_change: change,
        p_reason: reason || undefined,
        p_txn_exp_date: txnExp || undefined,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (id) => {
      toast.success(`Endorsement booked → policy #${id}`);
      setMode(null);
      reset();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('cancel_policy', {
        p_policy_id: policyId,
        p_txn_eff_date: txnEff,
        p_return_premium: Number(returnPremium) || 0,
        p_reason: reason || undefined,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (id) => {
      toast.success(`Cancellation booked → policy #${id}`);
      setMode(null);
      reset();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reinstate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('reinstate_policy', {
        p_policy_id: policyId,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (id) => {
      toast.success(`Reinstatement booked → policy #${id}`);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Endorse/cancel/reinstate all write policies — hide for non-writers (the
  // underlying RPCs are RLS-protected regardless).
  if (!can('policies', 'write')) return null;

  return (
    <>
      <Stack direction='row' spacing={1}>
        <Button
          size='small'
          variant='contained'
          startIcon={<FilePlus2 size={16} />}
          onClick={() => setMode('endorse')}
        >
          Endorse
        </Button>
        <Button
          size='small'
          variant='outlined'
          color='error'
          startIcon={<XCircle size={16} />}
          onClick={() => setMode('cancel')}
        >
          Cancel
        </Button>
        <Button
          size='small'
          variant='outlined'
          startIcon={<RotateCcw size={16} />}
          disabled={reinstate.isPending}
          onClick={() => reinstate.mutate()}
        >
          Reinstate
        </Button>
      </Stack>

      {/* Endorsement */}
      <Dialog
        open={mode === 'endorse'}
        onClose={() => setMode(null)}
        maxWidth='xs'
        fullWidth
      >
        <DialogTitle>Endorse {polRef}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label='Txn effective date'
              type='date'
              value={txnEff}
              onChange={(e) => setTxnEff(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label='Txn expiration date (optional)'
              type='date'
              value={txnExp}
              onChange={(e) => setTxnExp(e.target.value)}
              helperText='Defaults to policy expiration'
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label='Premium change'
              value={premiumChange}
              onChange={(e) => setPremiumChange(e.target.value)}
              helperText='Additional (+) or return (−) premium for the endorsement term'
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position='start'>$</InputAdornment>
                  ),
                },
                htmlInput: { inputMode: 'decimal' },
              }}
            />
            <TextField
              label='Reason / description'
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMode(null)}>Cancel</Button>
          <Button
            variant='contained'
            disabled={endorse.isPending}
            onClick={() => endorse.mutate()}
          >
            Book endorsement
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancellation */}
      <Dialog
        open={mode === 'cancel'}
        onClose={() => setMode(null)}
        maxWidth='xs'
        fullWidth
      >
        <DialogTitle>Cancel {polRef}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label='Cancellation effective date'
              type='date'
              value={txnEff}
              onChange={(e) => setTxnEff(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label='Return premium'
              value={returnPremium}
              onChange={(e) => setReturnPremium(e.target.value)}
              helperText='Amount returned to the insured for the unearned term'
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position='start'>$</InputAdornment>
                  ),
                },
                htmlInput: { inputMode: 'decimal' },
              }}
            />
            <TextField
              label='Reason / description'
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMode(null)}>Close</Button>
          <Button
            variant='contained'
            color='error'
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            Book cancellation
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
