import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/lookup-tables')({
  component: RouteComponent,
  loader: () => ({ crumb: 'lookup tables' }),
});

function RouteComponent() {
  return <Outlet />;
}
