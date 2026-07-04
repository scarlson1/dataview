/**
 * Server-side data source for the DataGrid.
 *
 * Pagination, sorting and filtering all run in Postgres via PostgREST — the
 * grid never holds more than one page, so million-row tables stay responsive.
 * DataGrid must be in `paginationMode/sortingMode/filterMode="server"` for the
 * models passed here to be authoritative.
 */

import type {
  GridFilterItem,
  GridFilterModel,
  GridPaginationModel,
  GridSortModel,
} from '@mui/x-data-grid';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { TableDef } from '#/data/tables';
import { supabase } from '#/supabaseClient';

export interface TableQueryState {
  paginationModel: GridPaginationModel;
  sortModel: GridSortModel;
  filterModel: GridFilterModel;
}

export interface TablePage {
  rows: Record<string, unknown>[];
  rowCount: number;
}

/** Column kinds worth matching against a free-text quick search. */
const SEARCHABLE = new Set(['text', 'mono', 'chip', 'json']);

// `ilike` (`~~*`) only has a text overload — running it against a bigint,
// numeric or enum column raises `operator does not exist: <type> ~~* unknown`.
// A column's `kind` (e.g. `mono`) doesn't tell us the underlying Postgres type,
// so the quick search partitions searchable columns by `type` instead.
const TEXT_TYPE = /^(text|varchar|char|character|bpchar|citext|name)/i;
const NUMERIC_TYPE =
  /^(bigint|int|integer|int2|int4|int8|smallint|numeric|decimal|real|double|money|serial)/i;
const isNumericTerm = (t: string): boolean => /^\d+(\.\d+)?$/.test(t);

// PostgREST `or()` treats commas and parens as syntax — strip them from
// user-supplied terms rather than trying to escape.
const sanitize = (term: string): string => term.replace(/[(),]/g, ' ').trim();

type PostgresFilter = ReturnType<ReturnType<typeof supabase.from>['select']>;

const applyFilterItem = (
  query: PostgresFilter,
  item: GridFilterItem,
): PostgresFilter => {
  const { field, operator, value } = item;
  if (!field) return query;
  const empty = value === undefined || value === '' || value === null;

  switch (operator) {
    case 'isEmpty':
      return query.is(field, null);
    case 'isNotEmpty':
      return query.not(field, 'is', null);
    case 'isAnyOf':
      return Array.isArray(value) && value.length
        ? query.in(field, value)
        : query;
  }
  if (empty) return query;

  switch (operator) {
    case 'contains':
      return query.ilike(field, `%${value}%`);
    case 'doesNotContain':
      return query.not(field, 'ilike', `%${value}%`);
    case 'startsWith':
      return query.ilike(field, `${value}%`);
    case 'endsWith':
      return query.ilike(field, `%${value}`);
    case 'equals':
    case 'is':
    case '=':
      return query.eq(field, value);
    case 'not':
    case '!=':
      return query.neq(field, value);
    case '>':
    case 'after':
      return query.gt(field, value);
    case '>=':
    case 'onOrAfter':
      return query.gte(field, value);
    case '<':
    case 'before':
      return query.lt(field, value);
    case '<=':
    case 'onOrBefore':
      return query.lte(field, value);
    default:
      return query;
  }
};

const fetchPage = async (
  table: TableDef,
  state: TableQueryState,
): Promise<TablePage> => {
  const { paginationModel, sortModel, filterModel } = state;
  const from = paginationModel.page * paginationModel.pageSize;
  const to = from + paginationModel.pageSize - 1;

  // `table.source` is a dynamic, schema-driven relation name that isn't
  // necessarily one of the literal tables/views baked into the generated
  // `Database` type (e.g. migrations not yet reflected in `gen:types`).
  let query = supabase
    .from(table.source as never)
    .select('*', { count: 'exact' })
    .range(from, to) as unknown as PostgresFilter;

  for (const s of sortModel) {
    query = query.order(s.field, { ascending: s.sort !== 'desc' });
  }

  for (const item of filterModel.items ?? []) {
    query = applyFilterItem(query, item);
  }

  // Quick-filter search box → OR across searchable columns. Text columns match
  // with `ilike`; numeric columns can only be compared with `eq`, and only when
  // the term is itself numeric (otherwise they're skipped, not crashed on).
  const terms = (filterModel.quickFilterValues ?? [])
    .map((t) => sanitize(String(t)))
    .filter(Boolean);
  const searchCols = table.columns.filter((c) => SEARCHABLE.has(c.kind));
  const textCols = searchCols
    .filter((c) => TEXT_TYPE.test(c.type))
    .map((c) => c.field);
  const numCols = searchCols
    .filter((c) => NUMERIC_TYPE.test(c.type))
    .map((c) => c.field);
  for (const term of terms) {
    const ors = textCols.map((c) => `${c}.ilike.%${term}%`);
    if (isNumericTerm(term)) {
      ors.push(...numCols.map((c) => `${c}.eq.${term}`));
    }
    if (ors.length) query = query.or(ors.join(','));
  }

  const { data, count, error } = await query;
  if (error) throw error;
  return {
    rows: (data ?? []) as Record<string, unknown>[],
    rowCount: count ?? 0,
  };
};

export const useTableData = (table: TableDef, state: TableQueryState) =>
  useQuery({
    queryKey: ['table-data', table.source, state],
    queryFn: () => fetchPage(table, state),
    placeholderData: keepPreviousData,
  });
