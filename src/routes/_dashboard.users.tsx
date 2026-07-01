import { InviteUserForm } from '#/components/auth/InviteUserForm';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/users')({
  component: RouteComponent,
});

// TODO: move invite to dialog / drawer (mobile)

function RouteComponent() {
  return <InviteUserForm />;
}
