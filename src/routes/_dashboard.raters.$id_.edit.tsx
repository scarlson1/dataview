/**
 * Edit a saved rater's definition in the builder. Write-gated in the UI;
 * RLS is the real boundary.
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { RaterBuilder } from '#/components/raters/RaterBuilder';
import { useAuth } from '#/context/AuthContext';
import { supabase } from '#/supabaseClient';
import {
  type RaterDefinition,
  type RecordMapping,
  raterDefinitionSchema,
} from '#/types/raters';

export const Route = createFileRoute('/_dashboard/raters/$id_/edit')({
  component: EditRater,
  loader: () => ({ crumb: 'edit' }),
});

interface RaterRow {
  id: string;
  name: string;
  description: string | null;
  definition: unknown;
  record_mapping: RecordMapping | null;
  archived_at: string | null;
}

function EditRater() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();

  const rater = useQuery({
    queryKey: ['raters', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raters')
        .select(
          'id, name, description, definition, record_mapping, archived_at',
        )
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Rater not found');
      return data as unknown as RaterRow;
    },
  });

  if (!can('raters', 'write')) {
    return (
      <Alert severity='warning'>
        You don't have permission to edit raters.
      </Alert>
    );
  }
  if (rater.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress size={26} />
      </Box>
    );
  }
  if (rater.isError) {
    return <Alert severity='error'>{(rater.error as Error).message}</Alert>;
  }

  const row = rater.data as RaterRow;
  const parsed = raterDefinitionSchema.safeParse(row.definition);
  if (!parsed.success) {
    return (
      <Alert severity='error'>
        This rater's saved definition is invalid and can't be edited here.
      </Alert>
    );
  }
  const definition: RaterDefinition = parsed.data;

  return (
    <Box
      sx={{
        maxWidth: 1400,
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
      }}
    >
      <Typography sx={{ fontSize: 22, fontWeight: 700 }}>Edit rater</Typography>
      <RaterBuilder
        raterId={row.id}
        initialName={row.name}
        initialDescription={row.description ?? ''}
        initialDefinition={definition}
        initialRecordMapping={row.record_mapping}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['raters'] });
          navigate({ to: '/raters/$id', params: { id: row.id } });
        }}
        onCancel={() => navigate({ to: '/raters/$id', params: { id: row.id } })}
      />
    </Box>
  );
}
