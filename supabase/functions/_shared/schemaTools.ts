// Schema-introspection tools for the generate-report agent.
//
// list_tables / get_table_schema hit information_schema/pg_catalog, which is
// identical for every user and changes only on migration — results are cached
// in a module-scope Map (edge-function isolates stay warm across invocations)
// with a short TTL. Repair mode busts the cache via bustSchemaCache().
// sample_rows is NEVER cached: its results are user-specific (RLS) and caching
// would leak rows across users sharing a warm isolate.

import {
  executeReportSql,
  type ReportSqlResult,
  runIntrospectionQuery,
} from './reportExecutor.ts';

const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  value: unknown;
  expires: number;
}

const schemaCache = new Map<string, CacheEntry>();

const cacheGet = <T>(key: string): T | undefined => {
  const entry = schemaCache.get(key);
  if (!entry) return undefined;
  if (entry.expires < Date.now()) {
    schemaCache.delete(key);
    return undefined;
  }
  return entry.value as T;
};

const cacheSet = (key: string, value: unknown): void => {
  schemaCache.set(key, { value, expires: Date.now() + SCHEMA_CACHE_TTL_MS });
};

export const bustSchemaCache = (): void => {
  schemaCache.clear();
};

export interface RelationInfo {
  name: string;
  kind: 'table' | 'view';
  comment: string | null;
}

export const listTables = async (): Promise<RelationInfo[]> => {
  const cached = cacheGet<RelationInfo[]>('list_tables');
  if (cached) return cached;

  const rows = await runIntrospectionQuery(`
    SELECT
      c.relname AS name,
      CASE WHEN c.relkind IN ('v', 'm') THEN 'view' ELSE 'table' END AS kind,
      obj_description(c.oid, 'pg_class') AS comment
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm')
    ORDER BY
      CASE WHEN c.relkind IN ('v', 'm') THEN 0 ELSE 1 END,
      c.relname
  `);

  const relations = rows as unknown as RelationInfo[];
  cacheSet('list_tables', relations);
  return relations;
};

export const getTableSchema = async (
  tables: string[],
): Promise<Record<string, unknown>[]> => {
  const unique = [...new Set(tables)];
  const results: Record<string, unknown>[] = [];
  const misses: string[] = [];

  for (const table of unique) {
    const hit = cacheGet<Record<string, unknown>>(`schema:${table}`);
    if (hit) {
      results.push(hit);
    } else {
      misses.push(table);
    }
  }

  if (misses.length === 0) return results;

  const rows = await runIntrospectionQuery(
    `
  WITH requested AS (
      SELECT unnest($1::text[]) AS table_name
  ),

  columns AS (
      SELECT
          c.table_name,
          c.column_name,
          c.data_type,
          c.udt_name,
          c.is_nullable,
          c.column_default,
          c.ordinal_position
      FROM information_schema.columns c
      JOIN requested r
        ON r.table_name = c.table_name
      WHERE c.table_schema = 'public'
  ),

  primary_keys AS (
      SELECT
          tc.table_name,
          kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
  ),

  foreign_keys AS (
      SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table,
          ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
  ),

  checks AS (
      SELECT
          tc.table_name,
          cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON cc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'CHECK'
        AND tc.table_schema = 'public'
  )

  SELECT
      t.table_name,
      t.table_type,

      (
          SELECT json_agg(
              json_build_object(
                  'name', c.column_name,
                  'type', c.data_type,
                  'udt', c.udt_name,
                  'nullable', c.is_nullable = 'YES',
                  'default', c.column_default,
                  'primaryKey', EXISTS (
                      SELECT 1
                      FROM primary_keys pk
                      WHERE pk.table_name = c.table_name
                        AND pk.column_name = c.column_name
                  )
              )
              ORDER BY c.ordinal_position
          )
          FROM columns c
          WHERE c.table_name = t.table_name
      ) AS columns,

      (
          SELECT json_agg(
              json_build_object(
                  'column', fk.column_name,
                  'referencesTable', fk.foreign_table,
                  'referencesColumn', fk.foreign_column
              )
          )
          FROM foreign_keys fk
          WHERE fk.table_name = t.table_name
      ) AS foreign_keys,

      (
          SELECT json_agg(check_clause)
          FROM checks c
          WHERE c.table_name = t.table_name
      ) AS checks

  FROM information_schema.tables t
  JOIN requested r
    ON r.table_name = t.table_name
  WHERE t.table_schema = 'public'
  ORDER BY t.table_name;
  `,
    [misses],
  );

  const found = new Set<string>();
  for (const row of rows) {
    found.add(String(row.table_name));
    cacheSet(`schema:${row.table_name}`, row);
    results.push(row);
  }

  // Tell the model about names it guessed wrong instead of silently omitting.
  for (const table of misses) {
    if (!found.has(table)) {
      results.push({
        table_name: table,
        error: 'not found in the public schema — check list_tables',
      });
    }
  }

  return results;
};

export const sampleRows = async (
  table: string,
  claims: Record<string, unknown>,
): Promise<ReportSqlResult> => {
  // The table arg is model-controlled: validate against the live catalog so it
  // can't smuggle SQL through the identifier position.
  const relations = await listTables();
  if (!relations.some((r) => r.name === table)) {
    return {
      ok: false,
      code: 'unknown_table',
      message: `"${table}" is not a table or view in the public schema — check list_tables`,
    };
  }

  const ident = `"${table.replaceAll('"', '""')}"`;
  return await executeReportSql({
    sql: `select * from public.${ident} limit 5`,
    claims,
    rowCap: 5,
  });
};
