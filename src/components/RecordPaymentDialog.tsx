/**
 * Records a client payment against an AR row via the `record_ar_payment` RPC
 * (inserts an accounts_receivable_payments child + refreshes AR status).
 * Replaces the old window.prompt on the workflow board.
 */
import { money } from '#/lib/money';
import { supabase } from '#/supabaseClient';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useState } from 'react';
import { toast } from 'sonner';

export interface ArTarget {
  id: number;
  ar_ref: string;
  balance_due: number | null;
}

interface RecordPaymentDialogProps {
  ar: ArTarget | null;
  open: boolean;
  onClose: () => void;
  onRecorded: () => void;
}

const METHODS = ['ach', 'check', 'wire', 'credit_card', 'other'];

export const RecordPaymentDialog = ({
  ar,
  open,
  onClose,
  onRecorded,
}: RecordPaymentDialogProps) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [method, setMethod] = useState('ach');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const suggested = Math.max(Number(ar?.balance_due) || 0, 0);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!ar) throw new Error('No receivable selected');
      const amt = Number(amount || suggested);
      if (!Number.isFinite(amt) || amt <= 0)
        throw new Error('Enter a positive amount');
      const { error } = await supabase.rpc('record_ar_payment', {
        p_ar_id: ar.id,
        p_amount: amt,
        p_date: date,
        p_method: method,
        p_reference: reference || undefined,
        p_notes: notes || undefined,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Payment recorded');
      setAmount('');
      setReference('');
      setNotes('');
      onRecorded();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='xs'
      fullWidth
      fullScreen={fullScreen}
    >
      <DialogTitle>
        Record payment {ar ? `— ${ar.ar_ref}` : ''}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label='Amount'
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(suggested)}
            helperText={`Balance due ${money(ar?.balance_due)}`}
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
            label='Payment date'
            type='date'
            value={date}
            onChange={(e) => setDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label='Method'
            select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {METHODS.map((m) => (
              <MenuItem key={m} value={m}>
                {m.replace(/_/g, ' ')}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label='Reference'
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <TextField
            label='Notes'
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant='contained'
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Record
        </Button>
      </DialogActions>
    </Dialog>
  );
};
