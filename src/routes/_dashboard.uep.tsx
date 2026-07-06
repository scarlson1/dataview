/**
 * Legacy /uep route — the Net-Commission UEP reserve report now lives as the
 * "UEP reserve" view tab on the policies table (see components/reports/
 * UepReserveReport and data/tableViews). Kept as a redirect so old bookmarks/
 * links still resolve.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/uep')({
  beforeLoad: () => {
    throw redirect({ to: '/$table', params: { table: 'policies' } });
  },
});
