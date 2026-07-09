import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/raters')({
  component: RouteComponent,
  loader: () => ({
    crumb: 'raters',
  }),
});

function RouteComponent() {
  return <Outlet />;
}
