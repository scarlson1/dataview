import { createFileRoute, redirect } from '@tanstack/react-router';
import { TABLE_ORDER } from '../data/tables';

export const Route = createFileRoute('/_dashboard/')({
  beforeLoad: () => {
    throw redirect({ to: '/$table', params: { table: TABLE_ORDER[0] } });
  },
});
