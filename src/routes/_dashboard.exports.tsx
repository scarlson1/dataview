/**
 * Export center — download the QBO import CSVs and the Lloyd's bordereaux, plus
 * the aged-receivables and carrier premium/commission reports. Each pulls its
 * backing view on demand and streams a CSV to the browser.
 */

import { type CsvColumn, downloadCsv } from '#/lib/csv';
import { supabase } from '#/supabaseClient';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/_dashboard/exports')({
  component: ExportCenter,
  loader: () => ({ crumb: 'exports' }),
});

interface ExportDef {
  relation: string;
  filename: string;
  title: string;
  description: string;
  group: string;
  /**
   * Explicit field → header mapping so the CSV headers match the target import
   * template (e.g. QBO's `*InvoiceNo`) rather than the raw view column names.
   * Omit to fall back to the view's own column aliases as headers.
   */
  columns?: CsvColumn[];
}

const EXPORTS: ExportDef[] = [
  {
    relation: 'qbo_ar_invoices',
    filename: 'qbo-ar-invoices',
    title: 'QBO — Sales Invoices',
    description:
      'Customer premium invoices for QBO Sales → Import Invoices. Customer must match the QBO customer name.',
    group: 'QuickBooks Online',
    // Headers match QBO's native "Import Invoices" template (required fields
    // are prefixed with *). Item(Product/Service) must already exist in QBO.
    columns: [
      { field: 'invoice_no', label: '*InvoiceNo' },
      { field: 'customer', label: '*Customer' },
      { field: 'invoice_date', label: '*InvoiceDate' },
      { field: 'due_date', label: '*DueDate' },
      { field: 'item', label: 'Item(Product/Service)' },
      { field: 'item_quantity', label: 'ItemQuantity' },
      { field: 'item_rate', label: 'ItemRate' },
      { field: 'item_amount', label: '*ItemAmount' },
      { field: 'currency', label: 'Currency' },
    ],
  },
  {
    relation: 'qbo_ap_bills',
    filename: 'qbo-ap-bills',
    title: 'QBO — Carrier Bills',
    description:
      'Carrier vendor bills (net premium, Funds Held liability) for SaasAnt / QBO Advanced.',
    group: 'QuickBooks Online',
    // SaasAnt / QBO Advanced bill-import headers. Vendor must match the QBO
    // vendor name (= carriers.carrier_name).
    columns: [
      { field: 'bill_no', label: 'BillNo' },
      { field: 'vendor', label: 'Vendor' },
      { field: 'bill_date', label: 'BillDate' },
      { field: 'due_date', label: 'DueDate' },
      { field: 'line_account', label: 'Account' },
      { field: 'line_amount', label: 'LineAmount' },
      { field: 'currency', label: 'Currency' },
    ],
  },
  {
    relation: 'qbo_je_commission',
    filename: 'qbo-je-commission',
    title: 'QBO — Commission Journal Entries',
    description:
      'Balanced commission allocation JE per policy (DR Cash / CR MGA Net / CR Agency Payable / CR Funds Held / CR MGA Fee).',
    group: 'QuickBooks Online',
    // SaasAnt / QBO Advanced journal-entry headers. Rows sharing a JournalNo
    // are grouped into one entry; debits and credits must balance.
    columns: [
      { field: 'journal_no', label: '*JournalNo' },
      { field: 'journal_date', label: '*JournalDate' },
      { field: 'account', label: '*AccountName' },
      { field: 'debit', label: 'Debits' },
      { field: 'credit', label: 'Credits' },
    ],
  },
  {
    relation: 'lly_a_premium',
    filename: 'lloyds-premium-bordereau',
    title: "Lloyd's — Premium Bordereau (LLY-A)",
    description: "Premium/risk bordereau in the Lloyd's CRS layout.",
    group: "Lloyd's Bordereaux",
  },
  {
    relation: 'lly_b_claims',
    filename: 'lloyds-claims-bordereau',
    title: "Lloyd's — Claims Bordereau (LLY-B)",
    description: "Claims bordereau in the Lloyd's CRS layout.",
    group: "Lloyd's Bordereaux",
  },
  {
    relation: 'accounts_receivable_aging',
    filename: 'aged-receivables',
    title: 'Aged Receivables (AGD)',
    description:
      'Open AR balances bucketed Current / 1-30 / 31-60 / 61-90 / 90+.',
    group: 'Reports',
  },
  {
    relation: 'carrier_prem_com_report',
    filename: 'carrier-prem-com',
    title: 'Carrier Premium / Commission',
    description:
      'Premium & commission by carrier, combining single-carrier and subscription participation shares.',
    group: 'Reports',
  },
  {
    relation: 'air_exposure_computed',
    filename: 'air-exposure-extract',
    title: 'AIR Exposure Extract',
    description:
      'Location/building/TIV exposure records with rolled-up equipment TIV for cat modeling.',
    group: 'Reports',
  },
];

function ExportCenter() {
  const download = useMutation({
    mutationFn: async (def: ExportDef) => {
      const { data, error } = await supabase
        .from(def.relation as never)
        .select('*');
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      if (rows.length === 0) throw new Error('No rows to export');
      downloadCsv(def.filename, rows, def.columns);
      return rows.length;
    },
    onSuccess: (n) => toast.success(`Exported ${n} row(s)`),
    onError: (e: Error) => toast.error(e.message),
  });

  const groups = Array.from(new Set(EXPORTS.map((e) => e.group)));

  return (
    <Box
      sx={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 3 }}
    >
      <Box>
        <Typography sx={{ fontSize: 22, fontWeight: 700 }}>Exports</Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
          Download QBO import files, Lloyd's bordereaux, and reports as CSV.
        </Typography>
      </Box>

      {groups.map((group) => (
        <Box key={group}>
          <Typography
            sx={{
              fontSize: 12.5,
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              mb: 1,
            }}
          >
            {group}
          </Typography>
          <Paper
            variant='outlined'
            sx={{ borderRadius: 2, overflow: 'hidden' }}
          >
            {EXPORTS.filter((e) => e.group === group).map((def, i, arr) => (
              <Box
                key={def.relation}
                sx={(t) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  px: 2,
                  py: 1.75,
                  borderBottom:
                    i < arr.length - 1
                      ? `1px solid ${t.palette.divider}`
                      : 'none',
                })}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14.5, fontWeight: 600 }}>
                    {def.title}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                    {def.description}
                  </Typography>
                </Box>
                <Button
                  variant='outlined'
                  startIcon={<Download size={16} />}
                  disabled={download.isPending}
                  onClick={() => download.mutate(def)}
                >
                  CSV
                </Button>
              </Box>
            ))}
          </Paper>
        </Box>
      ))}
    </Box>
  );
}
