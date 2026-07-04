/**
 * Records a carrier remittance against a CAP row via the `record_cap_remittance`
 * RPC (inserts a capacity_remittance child, bounded by available-for-payment).
 */
import { money } from '#/lib/money';
import { supabase } from '#/supabaseClient';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useState } from 'react';
import { toast } from 'sonner';

export interface CapTarget {
  id: number;
  cap_ref: string;
  available_for_payment: number | null;
  balance_owing: number | null;
}

interface RecordRemittanceDialogProps {
  cap: CapTarget | null;
  open: boolean;
  onClose: () => void;
  onRecorded: () => void;
}

export const RecordRemittanceDialog = ({
  cap,
  open,
  onClose,
  onRecorded,
}: RecordRemittanceDialogProps) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const available = Math.max(Number(cap?.available_for_payment) || 0, 0);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!cap) throw new Error('No carrier payable selected');
      const amt = Number(amount || available);
      if (!Number.isFinite(amt) || amt <= 0)
        throw new Error('Enter a positive amount');
      const { error } = await supabase.rpc('record_cap_remittance', {
        p_cap_id: cap.id,
        p_amount: amt,
        p_date: date,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Remittance recorded');
      setAmount('');
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
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        Record remittance {cap ? `— ${cap.cap_ref}` : ''}
        <IconButton onClick={onClose} edge='end' aria-label='Close'>
          <X size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label='Amount'
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(available)}
            helperText={`Available ${money(cap?.available_for_payment)} · owing ${money(
              cap?.balance_owing,
            )}`}
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
            label='Remittance date'
            type='date'
            value={date}
            onChange={(e) => setDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
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
