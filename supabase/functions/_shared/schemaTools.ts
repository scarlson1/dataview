import { executeReportSql, runIntrospectionQuery } from './reportExecutor.ts';

// export async function listTables(dbClient: Client) {
//   const res = await dbClient.queryObject<{ table_name: string }>`
//     SELECT table_name::text FROM information_schema.tables
//     WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
//   `;
//   return { tables: res.rows.map((r) => r.table_name) };
// }

export async function listTables() {
  return await runIntrospectionQuery(`
        SELECT
          table_name,
          CASE
            WHEN table_type = 'VIEW' THEN 'view'
            ELSE 'table'
          END AS kind
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY
          CASE WHEN table_type = 'VIEW' THEN 0 ELSE 1 END,
          table_name;
      `);
}

export async function getTableSchema(tables: string[]) {
  if (tables.length === 0) {
    return [];
  }

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
    [tables],
  );

  return rows;
}

export async function sampleRows(table: string, limit = 5) {
  const safeLimit = Math.max(1, Math.min(limit, 20));

  const result = await executeReportSql({
    sql: `SELECT * FROM public."${table}" LIMIT ${safeLimit}`,
    claims: {}, // or omit claims if you add an introspection mode
    rowCap: safeLimit,
  });

  return result;
}

// export async function sampleRows(
//   dbClient: Client,
//   tableName: string,
//   limitArg?: number,
// ) {
//   try {
//     const limit = Math.min(limitArg || 5, 20); // Strict safety cap on LLM context token inflation

//     if (!tableName) return { error: 'Missing tableName' };

//     // CRITICAL SECURITY GUARDRAIL: Format identifier safely to stop SQL injections from LLM prompts
//     const checkTable = await dbClient.queryObject(
//       `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1;`,
//       [tableName],
//     );
//     if (checkTable.rows.length === 0) {
//       return { error: 'Table malicious or non-existent' };
//     }

//     // Safe interpolation using explicitly verified identifier structure
//     const res = await dbClient.queryObject(
//       `SELECT * FROM public."${tableName}" LIMIT ${limit};`,
//     );
//     return { tableName, rows: res.rows };
//   } catch (err) {
//     return { error: err.message };
//   }
// }
