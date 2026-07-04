import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/auth/password-reset')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/auth/password-reset"!</div>;
}
