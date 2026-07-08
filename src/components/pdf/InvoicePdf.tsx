/**
 * Printable invoice document rendered with @react-pdf/renderer. This is a
 * separate render tree from the app — no MUI, no DOM elements — so the
 * component takes plain data props and must stay importable without touching
 * app state. Always load this module with a dynamic `import()` so the renderer
 * stays code-split out of the main bundle (see src/lib/pdf.ts).
 *
 * Mirrors the premium & fees build-up on the invoice detail page
 * (_dashboard.invoices.$id.tsx), minus MGA commission — that is an internal
 * figure and this document is the outward-facing bill.
 */

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import dayjs from 'dayjs';
import { labelize, money } from '#/lib/money';

// TODO: confirm the MGA's legal billing entity + remittance details.
const SELLER = {
  name: 'Evertas',
  lines: ['Managing General Agency'],
};

export interface InvoicePdfInvoice {
  id: number;
  inv_ref: string | null;
  transaction_type: string | null;
  invoice_date: string | null;
  due_date: string | null;
  policy_eff_date: string | null;
  policy_exp_date: string | null;
  term_premium: number | null;
  term_terrorism_premium: number | null;
  total_term_premium: number | null;
  policy_fee: number | null;
  inspection_fee: number | null;
  other_fees: number | null;
  other_fee_description: string | null;
  total_term_prem_fees: number | null;
  notes: string | null;
}

export interface InvoicePdfProps {
  inv: InvoicePdfInvoice;
  /** Retail agency the invoice bills (invoices.agent_id → agencies). */
  agencyName: string | null;
  namedInsured: string | null;
  policyNumber: string | null;
}

const fmtDate = (d: string | null): string =>
  d && dayjs(d).isValid() ? dayjs(d).format('MMM D, YYYY') : '—';

const s = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 54,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
  },
  bold: { fontFamily: 'Helvetica-Bold' },
  muted: { color: '#666666' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  sellerName: { fontFamily: 'Helvetica-Bold', fontSize: 16 },
  docTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 20,
    textAlign: 'right',
  },
  invRef: { fontSize: 11, textAlign: 'right', marginTop: 4 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  metaLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaBlock: { marginBottom: 10 },
  metaCol: { maxWidth: '48%' },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  lineIndent: { paddingLeft: 20 },
  lineTotal: { borderTopWidth: 1.5, borderTopColor: '#1a1a1a' },
  tableHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  balanceBand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f2f2f2',
    borderRadius: 3,
  },
  balanceAmt: { fontFamily: 'Helvetica-Bold', fontSize: 14 },
  notes: { marginTop: 24, fontSize: 9, color: '#666666' },
  footer: {
    position: 'absolute',
    left: 54,
    right: 54,
    bottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#999999',
  },
});

const Meta = ({ label, value }: { label: string; value: string }) => (
  <View style={s.metaBlock}>
    <Text style={s.metaLabel}>{label}</Text>
    <Text>{value}</Text>
  </View>
);

const Line = ({
  label,
  value,
  bold,
  indent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  indent?: boolean;
}) => (
  <View
    style={[
      s.line,
      ...(bold ? [s.lineTotal] : []),
      ...(indent ? [s.lineIndent] : []),
    ]}
  >
    <Text style={bold ? s.bold : indent ? s.muted : undefined}>{label}</Text>
    <Text style={bold ? s.bold : undefined}>{value}</Text>
  </View>
);

export const InvoicePdf = ({
  inv,
  agencyName,
  namedInsured,
  policyNumber,
}: InvoicePdfProps) => {
  const hasOther = Number(inv.other_fees) > 0;
  const term = `${fmtDate(inv.policy_eff_date)} – ${fmtDate(inv.policy_exp_date)}`;

  return (
    <Document>
      <Page size='LETTER' style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.sellerName}>{SELLER.name}</Text>
            {SELLER.lines.map((l) => (
              <Text key={l} style={s.muted}>
                {l}
              </Text>
            ))}
          </View>
          <View>
            <Text style={s.docTitle}>INVOICE</Text>
            <Text style={s.invRef}>{inv.inv_ref ?? `#${inv.id}`}</Text>
          </View>
        </View>

        <View style={s.metaRow}>
          <View style={s.metaCol}>
            <Meta label='Bill to' value={agencyName ?? '—'} />
            <Meta label='Insured' value={namedInsured ?? '—'} />
            <Meta label='Policy number' value={policyNumber ?? '—'} />
          </View>
          <View style={s.metaCol}>
            <Meta label='Invoice date' value={fmtDate(inv.invoice_date)} />
            <Meta label='Due date' value={fmtDate(inv.due_date)} />
            <Meta label='Transaction' value={labelize(inv.transaction_type)} />
            <Meta label='Policy term' value={term} />
          </View>
        </View>

        <View style={s.tableHead}>
          <Text style={s.bold}>Description</Text>
          <Text style={s.bold}>Amount</Text>
        </View>
        <Line label='Term premium' value={money(inv.term_premium, 2)} />
        {Number(inv.term_terrorism_premium) > 0 && (
          <Line
            label='Terrorism premium'
            value={money(inv.term_terrorism_premium, 2)}
            indent
          />
        )}
        <Line
          label='Total term premium'
          value={money(inv.total_term_premium, 2)}
          bold
        />
        <Line label='Policy fee' value={money(inv.policy_fee, 2)} indent />
        <Line
          label='Inspection fee'
          value={money(inv.inspection_fee, 2)}
          indent
        />
        {hasOther && (
          <Line
            label={inv.other_fee_description || 'Other fees'}
            value={money(inv.other_fees, 2)}
            indent
          />
        )}
        <Line
          label='Total premium + fees'
          value={money(inv.total_term_prem_fees, 2)}
          bold
        />

        <View style={s.balanceBand}>
          <Text style={s.bold}>
            Balance due {inv.due_date ? `by ${fmtDate(inv.due_date)}` : ''}
          </Text>
          <Text style={s.balanceAmt}>{money(inv.total_term_prem_fees, 2)}</Text>
        </View>

        {inv.notes && <Text style={s.notes}>{inv.notes}</Text>}

        <View style={s.footer} fixed>
          <Text>Generated {dayjs().format('MMM D, YYYY')}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
};
