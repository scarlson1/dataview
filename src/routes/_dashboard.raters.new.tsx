import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { RaterBuilder } from '#/components/raters/RaterBuilder';
import { emptyRaterDefinition } from '#/types/raters';

export const Route = createFileRoute('/_dashboard/raters/new')({
  component: NewRater,
  loader: () => ({ crumb: 'new' }),
});

function NewRater() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        maxWidth: 1400,
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
      }}
    >
      <Typography sx={{ fontSize: 22, fontWeight: 700 }}>New rater</Typography>
      <RaterBuilder
        initialDefinition={emptyRaterDefinition()}
        onSaved={(id) => navigate({ to: '/raters/$id/edit', params: { id } })}
        onCancel={() => navigate({ to: '/raters' })}
      />
    </Box>
  );
}
