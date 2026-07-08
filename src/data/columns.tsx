/**
 * Derives MUI X DataGrid column definitions from the schema registry.
 *
 * Each `TableColumn.kind` (assigned by the schema generator from the Postgres
 * type + constraints) maps to DataGrid rendering: chips for enum/status
 * columns, monospace for ids, right-aligned numbers, formatted timestamps, etc.
 * This is the single place that decides how a Postgres column looks in the grid.
 */

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { StatusChip } from '../components/StatusChip';
import { MONO_FONT, valueTone } from '../theme/tokens';
import { type ColumnKind, capitalize, type TableDef } from './tables';

const isEmpty = (v: unknown): boolean =>
  v === undefined || v === null || v === '';

const Empty = () => (
  <Box component='span' sx={{ color: 'text.disabled' }}>
    —
  </Box>
);

const Mono = ({ children }: { children: React.ReactNode }) => (
  <Typography
    component='span'
    sx={{ fontFamily: MONO_FONT, fontSize: 13, color: 'text.primary' }}
  >
    {children}
  </Typography>
);

const dtFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const formatDateTime = (value: unknown): string => {
  if (isEmpty(value)) return '';
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : dtFormat.format(d);
};

/** Base width hints per kind — the grid still flexes to fill. */
const MIN_WIDTH: Record<string, number> = {
  mono: 110,
  number: 110,
  bool: 90,
  chip: 130,
  datetime: 170,
  json: 200,
  text: 150,
};

const renderCellFor = (column: {
  kind: ColumnKind;
}): ((params: GridRenderCellParams) => React.ReactNode) | undefined => {
  switch (column.kind) {
    case 'chip':
      return ({ value }) =>
        isEmpty(value) ? (
          <Empty />
        ) : (
          <StatusChip
            label={capitalize(String(value).replace(/_/g, ' '))}
            tone={valueTone(value)}
          />
        );
    case 'mono':
      return ({ value }) =>
        isEmpty(value) ? <Empty /> : <Mono>{String(value)}</Mono>;
    case 'bool':
      return ({ value }) =>
        isEmpty(value) ? (
          <Empty />
        ) : (
          <StatusChip
            label={value ? 'true' : 'false'}
            tone={value ? 'green' : 'grey'}
            variant='badge'
          />
        );
    case 'json':
      return ({ value }) =>
        isEmpty(value) ? (
          <Empty />
        ) : (
          <Mono>
            {typeof value === 'string' ? value : JSON.stringify(value)}
          </Mono>
        );
    case 'datetime':
      return ({ value }) =>
        isEmpty(value) ? <Empty /> : <Mono>{formatDateTime(value)}</Mono>;
    default:
      return undefined; // plain string cell
  }
};

const gridType = (kind: string): GridColDef['type'] =>
  kind === 'number' ? 'number' : 'string';

/** The minimum column shape needed to render a kind-driven grid column. */
interface ColumnMeta {
  field: string;
  label: string;
  kind: ColumnKind;
}

/**
 * Build a single kind-driven DataGrid column. Shared by `toGridColumns` (schema
 * tables) and the saved-report grid, which renders stored `{field,label,kind}`
 * meta through the exact same rendering.
 */
const toGridColumn = (c: ColumnMeta): GridColDef => ({
  field: c.field,
  headerName: c.label,
  type: gridType(c.kind),
  flex: 1,
  minWidth: MIN_WIDTH[c.kind] ?? 140,
  headerAlign: c.kind === 'number' ? 'right' : 'left',
  align: c.kind === 'number' ? 'right' : 'left',
  renderCell: renderCellFor(c),
});

/** Build DataGrid columns from a plain column-meta list (e.g. a saved report). */
export const columnsFromMeta = (columns: ColumnMeta[]): GridColDef[] =>
  columns.map(toGridColumn);

/** Build DataGrid columns for a table's display source, honoring hidden cols. */
export const toGridColumns = (table: TableDef): GridColDef[] =>
  table.columns
    .filter((c) => !table.hidden.includes(c.field))
    .map(toGridColumn);
