/**
 * Legacy /carrier-prem-com route — the carrier premium/commission report now
 * lives as the "Prem / Com" view tab on the carriers table (see components/
 * reports/CarrierPremComReport and data/tableViews). Kept as a redirect so old
 * bookmarks/links still resolve.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/carrier-prem-com')({
  beforeLoad: () => {
    throw redirect({ to: '/$table', params: { table: 'carriers' } });
  },
});
