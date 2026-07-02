import { useTableData } from '#/hooks/useTableData';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import {
  DataGrid,
  type GridFilterModel,
  type GridPaginationModel,
  type GridSortModel,
} from '@mui/x-data-grid';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { toGridColumns } from '../../data/columns';
import type { TableDef } from '../../data/tables';
import { MONO_FONT } from '../../theme/tokens';

interface DataTabProps {
  table: TableDef;
}

const PAGE_SIZES = [10, 25, 50, 100];

export const DataTab = ({ table }: DataTabProps) => {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const [filterModel, setFilterModel] = useState<GridFilterModel>({
    items: [],
  });

  const columns = useMemo(() => toGridColumns(table), [table]);
  const navigate = useNavigate();

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
          height: 'calc(100vh - 300px)',
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
