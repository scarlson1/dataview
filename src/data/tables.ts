/**
 * Table registry — the single source of truth the dashboard UI reads.
 *
 * Built at module load from the auto-generated schema manifest
 * (`schema.generated.ts`) merged with the hand overlay (`tableMeta.ts`). No
 * table data lives here anymore; rows are fetched on demand from Supabase
 * (see hooks/useTableData.ts). Re-run `pnpm gen:schema` after a migration to
 * refresh the manifest.
 */
import {
  SCHEMA,
  type ColumnKind,
  type SchemaColumn,
  type SchemaTable,
} from './schema.generated';
import { COMPUTED_VIEW_SUFFIXES, PREFERRED_ORDER, TABLE_META } from './tableMeta';

export type { ColumnKind };
export type TableColumn = SchemaColumn;

export interface TableDef {
  /** Base table name — the route param and sidebar key. */
  name: string;
  label: string;
  /** Icon key for `TableIcon`. */
  icon: string;
  description: string;
  /** Relation actually queried for rows (a computed view, or the table). */
  source: string;
  kind: 'table' | 'view';
  /** Columns of the `source` relation, in ordinal order. */
  columns: TableColumn[];
  /** Column used as the DataGrid row id. */
  primaryKey: string;
  /** Columns hidden from the data grid (still shown in the Schema tab). */
  hidden: string[];
}

/** Dynamic since tables come from the live schema. */
export type TableName = string;

const isComputedView = (name: string): boolean =>
  COMPUTED_VIEW_SUFFIXES.some((suffix) => name.endsWith(suffix));

const pickPrimaryKey = (base: SchemaTable, columns: TableColumn[]): string => {
  const pk = base.columns.find((c) => c.key === 'PK');
  if (pk) return pk.field;
  if (columns.some((c) => c.field === 'id')) return 'id';
  return columns[0]?.field ?? 'id';
};

const buildTable = (base: SchemaTable): TableDef => {
  const overlay = TABLE_META[base.name] ?? {};
  const source =
    overlay.source && SCHEMA[overlay.source as keyof typeof SCHEMA]
      ? overlay.source
      : base.name;
  const sourceSchema = SCHEMA[source as keyof typeof SCHEMA] as SchemaTable;

  return {
    name: base.name,
    label: overlay.label ?? base.name,
    icon: overlay.icon ?? base.name,
    description: overlay.description ?? `The public.${base.name} table.`,
    source,
    kind: base.kind,
    columns: sourceSchema.columns,
    primaryKey: pickPrimaryKey(base, sourceSchema.columns),
    hidden: overlay.hidden ?? [],
  };
};

const allRelations = Object.values(SCHEMA) as SchemaTable[];

/** Base tables only — companion computed views are queried, never listed. */
export const TABLES: Record<string, TableDef> = Object.fromEntries(
  allRelations
    .filter((r) => r.kind === 'table' && !isComputedView(r.name))
    .map((r) => [r.name, buildTable(r)]),
);

const orderIndex = (name: string): number => {
  const i = (PREFERRED_ORDER as readonly string[]).indexOf(name);
  return i === -1 ? PREFERRED_ORDER.length : i;
};

export const TABLE_ORDER: string[] = Object.keys(TABLES).sort((a, b) => {
  const d = orderIndex(a) - orderIndex(b);
  return d !== 0 ? d : a.localeCompare(b);
});

export const getTable = (name: string): TableDef | undefined => TABLES[name];

export const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);
