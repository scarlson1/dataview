/**
 * Edit a shared lookup table. Write-gated in the UI; RLS is the real boundary.
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LookupTableEditor } from '#/components/raters/LookupTableEditor';
import type { Cell } from '#/components/raters/steps/LookupTableGrid';
import { useAuth } from '#/context/AuthContext';
import { supabase } from '#/supabaseClient';
import { type LookupColumn, lookupTableContentSchema } from '#/types/raters';

export const Route = createFileRoute('/_dashboard/lookup-tables/$id/edit')({
  component: EditLookupTable,
  loader: () => ({ crumb: 'edit' }),
});

interface LookupTableRow {
  id: string;
  name: string;
  description: string | null;
  columns: unknown;
  rows: unknown;
}

function EditLookupTable() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { can } = useAuth();

  const table = useQuery({
    queryKey: ['rater_lookup_tables', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rater_lookup_tables')
        .select('id, name, description, columns, rows')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Lookup table not found');
      return data as unknown as LookupTableRow;
    },
  });

  if (!can('rater_lookup_tables', 'write')) {
    return (
      <Alert severity='warning'>
        You don't have permission to edit lookup tables.
      </Alert>
    );
  }
  if (table.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress size={26} />
      </Box>
    );
  }
  if (table.isError) {
    return <Alert severity='error'>{(table.error as Error).message}</Alert>;
  }

  const row = table.data as LookupTableRow;
  const parsed = lookupTableContentSchema.safeParse({
    columns: row.columns,
    rows: row.rows,
  });
  if (!parsed.success) {
    return (
      <Alert severity='error'>
        This table's saved data is invalid and can't be edited here.
      </Alert>
    );
  }

  return (
    <Box
      sx={{
        maxWidth: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
      }}
    >
      <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
        Edit lookup table
      </Typography>
      <LookupTableEditor
        tableId={row.id}
        initial={{
          name: row.name,
          description: row.description ?? '',
          columns: parsed.data.columns as LookupColumn[],
          rows: parsed.data.rows as Cell[][],
        }}
        onSaved={() => navigate({ to: '/lookup-tables' })}
        onCancel={() => navigate({ to: '/lookup-tables' })}
      />
    </Box>
  );
}
