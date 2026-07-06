/**
 * Modal preview of a binder section's participation schedule ("stamp") with a
 * Print / PDF action. Replaces the old standalone /stamp page: the section is
 * already in context on the binder detail page, so there's no picker — the
 * caller passes the section label and its participants straight in.
 *
 * Printing: we tag <body> with `printing-stamp` around window.print(); the
 * matching @media print rules in styles.css hide the app shell and expand this
 * dialog so only the schedule reaches the page.
 */

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import { Printer, X } from 'lucide-react';
import { type StampPart, StampSchedule } from '#/components/StampSchedule';

interface StampPrintDialogProps {
  open: boolean;
  onClose: () => void;
  label: string;
  statedPct: number;
  parts: StampPart[];
  totalPct: number;
}

const printStamp = () => {
  document.body.classList.add('printing-stamp');
  const cleanup = () => {
    document.body.classList.remove('printing-stamp');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  // Fallback for browsers that don't fire afterprint reliably.
  setTimeout(cleanup, 1000);
};

export const StampPrintDialog = ({
  open,
  onClose,
  label,
  statedPct,
  parts,
  totalPct,
}: StampPrintDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth='md'
    fullWidth
    slotProps={{ paper: { className: 'stamp-print-paper' } }}
  >
    <Box
      className='no-print'
      sx={(t) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        px: 2,
        py: 1.5,
        borderBottom: `1px solid ${t.palette.divider}`,
      })}
    >
      <Button
        variant='contained'
        startIcon={<Printer size={16} />}
        onClick={printStamp}
      >
        Print / PDF
      </Button>
      <Button color='inherit' startIcon={<X size={16} />} onClick={onClose}>
        Close
      </Button>
    </Box>
    <DialogContent>
      <StampSchedule
        label={label}
        statedPct={statedPct}
        parts={parts}
        totalPct={totalPct}
      />
    </DialogContent>
  </Dialog>
);

export default StampPrintDialog;
