import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/gen-reports')({
  component: RouteComponent,
  loader: () => ({
    crumb: 'reports',
  }),
});

function RouteComponent() {
  return <Outlet />;
}
