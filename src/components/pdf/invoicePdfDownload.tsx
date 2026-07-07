/**
 * Orchestrates an invoice PDF download: resolves the display names the document
 * needs (billing agency, named insured, policy number) from an invoice row,
 * then renders and downloads InvoicePdf. Shared by the invoice detail page and
 * the invoices grid's row action.
 *
 * Lives apart from the pure InvoicePdf component so that (a) the component's
 * render test stays free of the Supabase client, and (b) call sites can
 * `import()` this module to keep @react-pdf/renderer code-split out of the main
 * bundle — importing it here statically is what pulls the renderer into this
 * lazily-loaded chunk.
 */

import { downloadPdf } from '#/lib/pdf';
import { supabase } from '#/supabaseClient';
import { InvoicePdf, type InvoicePdfInvoice } from './InvoicePdf';

/** Invoice fields the document needs, plus the FKs used to resolve names. */
export interface InvoicePdfSource extends InvoicePdfInvoice {
  policy_id: number | null;
  agent_id: number | null;
}

export const downloadInvoicePdf = async (
  inv: InvoicePdfSource,
): Promise<void> => {
  // Header display names; degrade to '—' rather than failing the download.
  const [policy, agency] = await Promise.all([
    inv.policy_id != null
      ? supabase
          .from('policies')
          .select('policy_number, common_named_insured')
          .eq('id', inv.policy_id)
          .maybeSingle()
      : null,
    inv.agent_id != null
      ? supabase
          .from('agencies')
          .select('display_name, entity_name, first_name, last_name')
          .eq('id', inv.agent_id)
          .maybeSingle()
      : null,
  ]);

  const agencyName =
    agency?.data?.display_name ??
    agency?.data?.entity_name ??
    ([agency?.data?.first_name, agency?.data?.last_name]
      .filter(Boolean)
      .join(' ') ||
      null);

  await downloadPdf(
    inv.inv_ref ?? `invoice-${inv.id}`,
    <InvoicePdf
      inv={inv}
      agencyName={agencyName}
      namedInsured={policy?.data?.common_named_insured ?? null}
      policyNumber={policy?.data?.policy_number ?? null}
    />,
  );
};
