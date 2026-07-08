// @vitest-environment node
/**
 * Renders InvoicePdf through the real @react-pdf/renderer layout engine and
 * checks a valid PDF comes out — the document tree is where runtime errors
 * (bad style values, null Text children) surface, not in typechecking.
 */

import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { InvoicePdf, type InvoicePdfInvoice } from './InvoicePdf';

const baseInvoice: InvoicePdfInvoice = {
  id: 42,
  inv_ref: 'INV-2026-0042',
  transaction_type: 'new_business',
  invoice_date: '2026-07-01',
  due_date: '2026-07-31',
  policy_eff_date: '2026-07-01',
  policy_exp_date: '2027-07-01',
  term_premium: 12500,
  term_terrorism_premium: 250,
  total_term_premium: 12750,
  policy_fee: 500,
  inspection_fee: 150,
  other_fees: 75,
  other_fee_description: 'Surplus lines tax',
  total_term_prem_fees: 13475,
  notes: 'Premium due within 30 days of invoice date.',
};

describe('InvoicePdf', () => {
  it('renders a populated invoice to a valid PDF', async () => {
    const buf = await renderToBuffer(
      <InvoicePdf
        inv={baseInvoice}
        agencyName='Acme Insurance Services'
        namedInsured='Globex Corporation'
        policyNumber='EVT-PROP-2026-001'
      />,
    );
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('renders with every nullable field null', async () => {
    const nulls = Object.fromEntries(
      Object.keys(baseInvoice).map((k) => [k, null]),
    ) as unknown as InvoicePdfInvoice;
    const buf = await renderToBuffer(
      <InvoicePdf
        inv={{ ...nulls, id: 1 }}
        agencyName={null}
        namedInsured={null}
        policyNumber={null}
      />,
    );
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
