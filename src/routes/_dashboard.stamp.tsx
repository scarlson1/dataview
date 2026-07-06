/**
 * Legacy /stamp route — the Lloyd's participation schedule ("stamp") now prints
 * per section from the binder detail page (each section has a "Stamp" action
 * that opens StampPrintDialog). Kept as a redirect so old bookmarks/links still
 * resolve to the binder list.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/stamp')({
  beforeLoad: () => {
    throw redirect({ to: '/$table', params: { table: 'binder' } });
  },
});
