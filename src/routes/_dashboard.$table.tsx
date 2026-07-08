import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/$table')({
  component: TableLayout,
  loader: () => ({
    crumb: 'tables',
  }),
});

// Layout for a table's pages: the list lives in `$table.index`, the record
// detail/edit in `$table.$id`. This just renders whichever child matches.
function TableLayout() {
  return <Outlet />;
}
