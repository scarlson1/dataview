/**
 * Legacy /subscriptions route — the co-insurance subscription builder now opens
 * from the policy detail page (PolicyActions → "Subscription"), with the policy
 * already in context. Kept as a redirect so old bookmarks/links resolve to the
 * policies list.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/subscriptions')({
  beforeLoad: () => {
    throw redirect({ to: '/$table', params: { table: 'policies' } });
  },
});
