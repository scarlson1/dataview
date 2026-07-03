/**
 * Generates `src/data/schema.generated.ts` from the live Postgres schema.
 *
 * Reads `information_schema` + `pg_catalog` (via psql) for every base table and
 * view in the `public` schema and emits a runtime manifest — column types,
 * nullability, defaults, PK/FK/UNIQUE keys, and a UI `kind` per column. The app
 * turns this manifest into MUI DataGrid column definitions, so new tables show
 * up automatically after a migration + re-run.
 *
 * Usage: `pnpm gen:schema` (DB url from $SUPABASE_DB or VITE_SUPABASE_DB, else
 * the default local Supabase url).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/data/schema.generated.ts');
const DEFAULT_DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const readEnvDb = () => {
  try {
    const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
    const line = env.split('\n').find((l) => l.startsWith('VITE_SUPABASE_DB='));
    return line?.slice('VITE_SUPABASE_DB='.length).trim();
  } catch {
    return undefined;
  }
};

const DB_URL = process.env.SUPABASE_DB || readEnvDb() || DEFAULT_DB;

/** Run a query that returns a single JSON aggregate and parse it. */
const queryJson = (sql) => {
  const out = execFileSync('psql', [DB_URL, '-Atc', sql], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(out.trim() || '[]');
};

const COLUMNS_SQL = `
  select coalesce(json_agg(row_to_json(x)), '[]') from (
    select c.table_name, tb.table_type,
           c.column_name, c.ordinal_position,
           c.data_type, c.udt_name,
           c.character_maximum_length as char_len,
           c.numeric_precision as num_prec, c.numeric_scale as num_scale,
           (c.is_nullable = 'YES') as nullable, c.column_default as col_default
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and tb.table_type in ('BASE TABLE', 'VIEW')
    order by c.table_name, c.ordinal_position
  ) x;`;

const KEYS_SQL = `
  select coalesce(json_agg(row_to_json(x)), '[]') from (
    select tc.table_name, tc.constraint_type, kcu.column_name,
           ccu.table_name as ref_table
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
     and kcu.table_schema = tc.table_schema
    left join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
     and tc.constraint_type = 'FOREIGN KEY'
    where tc.table_schema = 'public'
      and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY')
  ) x;`;

// Columns referenced by a CHECK constraint — a strong hint the column is an
// enum-like status/stage field that should render as a chip.
const CHECKS_SQL = `
  select coalesce(json_agg(row_to_json(x)), '[]') from (
    select rel.relname as table_name, att.attname as column_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    join lateral unnest(con.conkey) as k(attnum) on true
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = k.attnum
    where con.contype = 'c' and ns.nspname = 'public'
  ) x;`;

const ACRONYMS = new Set([
  'id', 'sl', 'do', 'ip', 'ar', 'uw', 'nbs', 'rnw', 'pol', 'clt', 'agt',
  'car', 'naic', 'sku', 'qbo', 'url', 'lob', 'gwp', 'ev', 'pct', 'amt',
]);

const humanize = (name) =>
  name
    .split('_')
    .map((w) =>
      ACRONYMS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(' ');

/** Compact Postgres type label, e.g. `varchar(255)`, `numeric(10,2)`. */
const typeLabel = (c) => {
  const base = {
    int2: 'smallint', int4: 'integer', int8: 'bigint',
    float4: 'real', float8: 'double precision',
    bool: 'boolean', timestamptz: 'timestamptz', timestamp: 'timestamp',
    varchar: 'varchar', bpchar: 'char', numeric: 'numeric',
  }[c.udt_name] ?? c.udt_name;

  if ((base === 'varchar' || base === 'char') && c.char_len)
    return `${base}(${c.char_len})`;
  if (base === 'numeric' && c.num_prec)
    return `numeric(${c.num_prec},${c.num_scale ?? 0})`;
  return base;
};

const CHIP_NAME = /(^|_)(status|stage|state|priority|role|type|kind|tone|level)$/;

const kindOf = (c, { key, isCheck }) => {
  const name = c.column_name;
  if (key === 'PK' || key === 'FK' || name === 'id' || name.endsWith('_id'))
    return 'mono';
  if (isCheck || CHIP_NAME.test(name)) return 'chip';
  if (/^(int|float|numeric|double|real|serial)/.test(c.udt_name) || c.udt_name.startsWith('int'))
    return 'number';
  if (c.udt_name.startsWith('timestamp') || c.udt_name === 'date') return 'datetime';
  if (c.udt_name === 'bool') return 'bool';
  if (c.udt_name === 'json' || c.udt_name === 'jsonb') return 'json';
  return 'text';
};

const main = () => {
  const cols = queryJson(COLUMNS_SQL);
  const keys = queryJson(KEYS_SQL);
  const checks = queryJson(CHECKS_SQL);

  // key/check lookups: `${table}.${column}` → value
  const keyMap = new Map();
  const refMap = new Map();
  const PRIORITY = { 'PRIMARY KEY': 3, UNIQUE: 2, 'FOREIGN KEY': 1 };
  for (const k of keys) {
    const id = `${k.table_name}.${k.column_name}`;
    const label =
      k.constraint_type === 'PRIMARY KEY' ? 'PK'
      : k.constraint_type === 'FOREIGN KEY' ? 'FK'
      : 'UNIQUE';
    // keep the strongest key label if a column has several constraints
    const prev = keyMap.get(id);
    if (!prev || PRIORITY[k.constraint_type] > PRIORITY[prev.type])
      keyMap.set(id, { label, type: k.constraint_type });
    if (label === 'FK' && k.ref_table) refMap.set(id, k.ref_table);
  }
  const checkSet = new Set(checks.map((c) => `${c.table_name}.${c.column_name}`));

  /** @type {Record<string, any>} */
  const tables = {};
  for (const c of cols) {
    const t = (tables[c.table_name] ??= {
      name: c.table_name,
      kind: c.table_type === 'VIEW' ? 'view' : 'table',
      columns: [],
    });
    const id = `${c.table_name}.${c.column_name}`;
    const key = keyMap.get(id)?.label;
    t.columns.push({
      field: c.column_name,
      label: humanize(c.column_name),
      type: typeLabel(c),
      nullable: c.nullable,
      def: c.col_default ?? undefined,
      key,
      references: refMap.get(id),
      kind: kindOf(c, { key, isCheck: checkSet.has(id) }),
    });
  }

  const body = `// AUTO-GENERATED by scripts/gen-schema.mjs — do not edit by hand.
// Regenerate with \`pnpm gen:schema\` after applying migrations.

export type ColumnKind =
  | 'mono'
  | 'text'
  | 'chip'
  | 'number'
  | 'datetime'
  | 'bool'
  | 'json';

export interface SchemaColumn {
  field: string;
  label: string;
  /** Compact Postgres type, e.g. \`varchar(255)\`. */
  type: string;
  nullable: boolean;
  def?: string;
  key?: 'PK' | 'FK' | 'UNIQUE';
  /** Referenced table name when \`key === 'FK'\`. */
  references?: string;
  kind: ColumnKind;
}

export interface SchemaTable {
  name: string;
  kind: 'table' | 'view';
  columns: SchemaColumn[];
}

export const SCHEMA = ${JSON.stringify(tables, null, 2)} as const satisfies Record<
  string,
  SchemaTable
>;

export type SchemaTableName = keyof typeof SCHEMA;
`;

  writeFileSync(OUT, body);
  const names = Object.keys(tables);
  console.log(
    `Wrote ${OUT}\n  ${names.length} relations: ${names.join(', ')}`,
  );
};

main();
