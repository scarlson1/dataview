import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  emptyLookupTable,
  LookupTableEditor,
} from '#/components/raters/LookupTableEditor';

export const Route = createFileRoute('/_dashboard/lookup-tables/new')({
  component: NewLookupTable,
  loader: () => ({ crumb: 'new' }),
});

function NewLookupTable() {
  const navigate = useNavigate();

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
        New lookup table
      </Typography>
      <LookupTableEditor
        initial={emptyLookupTable()}
        onSaved={() => navigate({ to: '/lookup-tables' })}
        onCancel={() => navigate({ to: '/lookup-tables' })}
      />
    </Box>
  );
}
