import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import {
  ColumnsPanelTrigger,
  DataGrid,
  FilterPanelTrigger,
  type GridColDef,
  type GridFilterModel,
  type GridPaginationModel,
  type GridRenderCellParams,
  type GridSortModel,
  QuickFilter,
  QuickFilterClear,
  QuickFilterControl,
  Toolbar,
  ToolbarButton,
  useGridRootProps,
} from '@mui/x-data-grid';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '#/context/AuthContext';
import { fetchAllRows, useTableData } from '#/hooks/useTableData';
import { downloadCsv } from '#/lib/csv';
import { toGridColumns } from '../../data/columns';
import { getTableActions, type RowAction } from '../../data/tableActions';
import type { TableDef } from '../../data/tables';
import { MONO_FONT } from '../../theme/tokens';

interface DataTabProps {
  table: TableDef;
}

const PAGE_SIZES = [10, 25, 50, 100];

// Custom props passed to the toolbar slot via `slotProps.toolbar`. Declaring
// them here makes them type-safe on both the `slotProps.toolbar` object and the
// `TableToolbar` component below.
declare module '@mui/x-data-grid' {
  interface ToolbarPropsOverrides {
    onExport: () => void;
    exporting: boolean;
    exportDisabled: boolean;
  }
}

interface TableToolbarProps {
  onExport: () => void;
  exporting: boolean;
  exportDisabled: boolean;
}

/**
 * Grid toolbar built from the composable toolbar primitives
 * (https://mui.com/x/react-data-grid/components/toolbar). Mirrors the default
 * toolbar's columns/filter/quick-filter controls, but its Export button runs a
 * server-side CSV export of every matching row — the built-in export only sees
 * the loaded page. Icons and tooltips are pulled from the grid's own root slots
 * so it matches the default look without an extra icon dependency.
 */
const TableToolbar = ({
  onExport,
  exporting,
  exportDisabled,
}: TableToolbarProps) => {
  const { slots, slotProps } = useGridRootProps();
  const Tooltip = slots.baseTooltip;
  const Badge = slots.baseBadge;
  const BaseTextField = slots.baseTextField;
  const BaseIconButton = slots.baseIconButton;
  const ColumnsIcon = slots.columnSelectorIcon;
  const FilterIcon = slots.openFilterButtonIcon;
  const ExportIcon = slots.exportIcon;
  const SearchIcon = slots.quickFilterIcon;
  const ClearIcon = slots.quickFilterClearIcon;

  return (
    <Toolbar>
      <Tooltip title='Columns'>
        <ColumnsPanelTrigger render={<ToolbarButton />}>
          <ColumnsIcon fontSize='small' />
        </ColumnsPanelTrigger>
      </Tooltip>

      <Tooltip title='Filters'>
        <FilterPanelTrigger
          render={(triggerProps, state) => (
            <ToolbarButton
              {...triggerProps}
              color={state.filterCount > 0 ? 'primary' : 'default'}
            >
              <Badge
                badgeContent={state.filterCount}
                color='primary'
                variant='dot'
              >
                <FilterIcon fontSize='small' />
              </Badge>
            </ToolbarButton>
          )}
        />
      </Tooltip>

      <Tooltip title='Export all matching rows to CSV'>
        <ToolbarButton onClick={onExport} disabled={exportDisabled}>
          <ExportIcon fontSize='small' />
        </ToolbarButton>
      </Tooltip>

      <Box sx={{ flex: 1 }} />

      {exporting && (
        <Box sx={{ fontSize: 12, color: 'text.secondary', mr: 1 }}>
          Exporting…
        </Box>
      )}

      <QuickFilter>
        <QuickFilterControl
          render={({ ref, slotProps: controlSlotProps, ...controlProps }) => (
            <BaseTextField
              {...controlProps}
              inputRef={ref}
              aria-label='Search'
              placeholder='Search…'
              size='small'
              slotProps={{
                input: {
                  startAdornment: <SearchIcon fontSize='small' />,
                  endAdornment: controlProps.value ? (
                    <QuickFilterClear
                      render={
                        <BaseIconButton
                          size='small'
                          edge='end'
                          aria-label='Clear search'
                        >
                          <ClearIcon fontSize='small' />
                        </BaseIconButton>
                      }
                    />
                  ) : null,
                  ...controlSlotProps?.input,
                },
                ...controlSlotProps,
              }}
              {...slotProps?.baseTextField}
            />
          )}
        />
      </QuickFilter>
    </Toolbar>
  );
};

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

  // Server-side CSV export. The grid's built-in export only sees the current
  // page, so re-query every row matching the active sort/filter and stream it
  // to a download. Headers/order mirror the visible (non-hidden) columns.
  const [exporting, setExporting] = useState(false);
  const rowCount = data?.rowCount ?? 0;

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchAllRows(table, { sortModel, filterModel });
      const csvColumns = table.columns
        .filter((c) => !table.hidden.includes(c.field))
        .map((c) => ({ field: c.field, label: c.label }));
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`${table.name}-${stamp}`, rows, csvColumns);
      toast.success(`Exported ${rows.length.toLocaleString()} rows`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

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
        getRowId={(row) =>
          table.primaryKeys.length === 1
            ? (row[table.primaryKey] as string | number)
            : table.primaryKeys.map((k) => row[k]).join('␟')
        }
        loading={isFetching}
        showToolbar
        // Custom toolbar: the built-in CSV export only sees the loaded page, so
        // its Export control is replaced by a server-side one (see TableToolbar).
        slots={{ toolbar: TableToolbar }}
        slotProps={{
          toolbar: {
            onExport: handleExport,
            exporting,
            exportDisabled: exporting || isError || rowCount === 0,
          },
        }}
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
