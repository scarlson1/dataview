/**
 * Runs a rater against a record inside the generic entity drawer (side sheet on
 * desktop, bottom sheet on mobile). Loads the rater by id, then hands the fixed
 * source row to RaterRunPanel for auto pre-fill. Launched from a record's
 * "Rate" action (see RateActionButton).
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useQuery } from '@tanstack/react-query';
import { EntityDrawer } from '#/components/EntityDrawer';
import { supabase } from '#/supabaseClient';
import { type RecordMapping, raterDefinitionSchema } from '#/types/raters';
import { RaterRunPanel } from './RaterRunPanel';

interface RaterRunDrawerProps {
  open: boolean;
  onClose: () => void;
  raterId: string | null;
  raterName?: string;
  sourceRow?: Record<string, unknown> | null;
}

interface RaterRow {
  id: string;
  name: string;
  definition: unknown;
  record_mapping: RecordMapping | null;
  archived_at: string | null;
}

export const RaterRunDrawer = ({
  open,
  onClose,
  raterId,
  raterName,
  sourceRow,
}: RaterRunDrawerProps) => {
  const rater = useQuery({
    queryKey: ['rater-run-drawer', raterId],
    enabled: open && Boolean(raterId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raters')
        .select('id, name, definition, record_mapping, archived_at')
        .eq('id', raterId as string)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Rater not found');
      return data as unknown as RaterRow;
    },
  });

  const parsed = rater.data
    ? raterDefinitionSchema.safeParse(rater.data.definition)
    : null;

  return (
    <EntityDrawer
      open={open}
      onClose={onClose}
      title={raterName ? `Rate · ${raterName}` : 'Rate'}
    >
      {rater.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : rater.isError ? (
        <Alert severity='error'>{(rater.error as Error).message}</Alert>
      ) : parsed && !parsed.success ? (
        <Alert severity='error'>This rater's saved definition is invalid.</Alert>
      ) : rater.data && parsed?.success ? (
        <RaterRunPanel
          key={rater.data.id}
          raterId={rater.data.id}
          definition={parsed.data}
          recordMapping={rater.data.record_mapping}
          archived={Boolean(rater.data.archived_at)}
          sourceRow={sourceRow}
        />
      ) : null}
    </EntityDrawer>
  );
};
