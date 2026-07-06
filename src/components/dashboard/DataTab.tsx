import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import {
  DataGrid,
  type GridColDef,
  type GridFilterModel,
  type GridPaginationModel,
  type GridRenderCellParams,
  type GridSortModel,
} from '@mui/x-data-grid';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '#/context/AuthContext';
import { useTableData } from '#/hooks/useTableData';
import { toGridColumns } from '../../data/columns';
import { getTableActions, type RowAction } from '../../data/tableActions';
import type { TableDef } from '../../data/tables';
import { MONO_FONT } from '../../theme/tokens';

interface DataTabProps {
  table: TableDef;
}

const PAGE_SIZES = [10, 25, 50, 100];

/**
 * Trailing "actions" cell — renders the table's row-action buttons (e.g. Bind).
 * Owns per-row pending state and error toasts; each action's `run` handles its
 * own success toast + cache invalidation. Stops click propagation so pressing a
 * button doesn't also trigger the row's navigate-to-detail handler.
 */
const RowActionsCell = ({
  row,
  actions,
}: {
  row: Record<string, unknown>;
  actions: RowAction[];
}) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);

  const visible = actions.filter((a) => !a.isAvailable || a.isAvailable(row));
  if (visible.length === 0) return null;

  const run = async (action: RowAction) => {
    setPending(action.id);
    try {
      await action.run(row, { queryClient, navigate });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
    }
  };

  return (
    <Box
      sx={{ display: 'flex', gap: 1, alignItems: 'center', height: '100%' }}
      onClick={(e) => e.stopPropagation()}
    >
      {visible.map((action) => (
        <Button
          key={action.id}
          size='small'
          variant={action.variant ?? 'contained'}
          disabled={pending !== null}
          onClick={() => run(action)}
        >
          {action.label}
        </Button>
      ))}
    </Box>
  );
};

export const DataTab = ({ table }: DataTabProps) => {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const [filterModel, setFilterModel] = useState<GridFilterModel>({
    items: [],
  });

  const { can } = useAuth();
  const navigate = useNavigate();

  const columns = useMemo<GridColDef[]>(() => {
    const base = toGridColumns(table);
    const actions = getTableActions(table.name).filter(
      (a) =>
        !a.permission || can(a.permissionResource ?? table.name, a.permission),
    );
    if (actions.length === 0) return base;

    const actionsCol: GridColDef = {
      field: '__actions',
      headerName: '',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: 'left',
      headerAlign: 'left',
      minWidth: 120,
      renderCell: (params: GridRenderCellParams) => (
        <RowActionsCell row={params.row} actions={actions} />
      ),
    };
    return [actionsCol, ...base];
  }, [table, can]);

  const { data, isFetching, isError, error } = useTableData(table, {
    paginationModel,
    sortModel,
    filterModel,
  });

  return (
    <Box>
      {isError && (
        <Alert
          severity='error'
          sx={{ m: 2, fontFamily: MONO_FONT, fontSize: 13 }}
        >
          {(error as Error)?.message ?? 'Failed to load rows.'}
        </Alert>
      )}
      <DataGrid
        rows={data?.rows ?? []}
        columns={columns}
        rowCount={data?.rowCount ?? 0}
        getRowId={(row) => row[table.primaryKey] as string | number}
        loading={isFetching}
        showToolbar
        onRowClick={(params) =>
          navigate({
            to: '/$table/$id',
            params: { table: table.name, id: String(params.id) },
          })
        }
        paginationMode='server'
        sortingMode='server'
        filterMode='server'
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        sortModel={sortModel}
        onSortModelChange={setSortModel}
        filterModel={filterModel}
        onFilterModelChange={setFilterModel}
        pageSizeOptions={PAGE_SIZES}
        disableRowSelectionOnClick
        sx={(theme) => ({
          border: 0,
          height: { xs: 'calc(100vh - 220px)', md: 'calc(100vh - 300px)' },
          minHeight: 420,
          '--DataGrid-containerBackground': 'transparent',
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: theme.vars.palette.paper2,
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 600,
            fontSize: 13,
          },
          '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
            outline: 'none',
          },
          '& .MuiDataGrid-row': {
            cursor: 'pointer',
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: theme.vars.palette.primaryHover,
          },
        })}
      />
    </Box>
  );
};
