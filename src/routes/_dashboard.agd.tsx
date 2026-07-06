/**
 * Legacy /agd route — the aged-receivables report now lives as the "Aging" view
 * tab on the accounts_receivable table (see components/reports/AgedReceivablesReport
 * and data/tableViews). Kept as a redirect so old bookmarks/links still resolve.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/agd')({
  beforeLoad: () => {
    throw redirect({ to: '/$table', params: { table: 'accounts_receivable' } });
  },
});
