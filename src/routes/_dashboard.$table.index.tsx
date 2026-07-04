import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { TableViewer } from '../components/dashboard/TableViewer';
import { getTable } from '../data/tables';

export const Route = createFileRoute('/_dashboard/$table/')({
  component: TableIndexRoute,
});

function TableIndexRoute() {
  const { table: tableName } = Route.useParams();
  const queryClient = useQueryClient();
  const table = getTable(tableName);

  if (!table) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 18, fontWeight: 600 }}>
          Unknown table "{tableName}"
        </Typography>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 1 }}>
          This table doesn't exist in the schema.
        </Typography>
      </Box>
    );
  }

  return (
    <TableViewer
      key={table.name}
      table={table}
      onRefresh={() =>
        queryClient.invalidateQueries({
          queryKey: ['table-data', table.source],
        })
      }
    />
  );
}
