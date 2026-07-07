// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { anthropic } from '@ai-sdk/anthropic';
// import { Pool } from '@db/postgres';
import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase, type SupabaseContext } from '@supabase/server';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { Database } from '../_shared/database.types.ts';
import { executeReportSql, ROW_CAPS } from '../_shared/reportExecutor.ts';
import {
  getTableSchema,
  listTables,
  sampleRows,
} from '../_shared/schemaTools.ts';

// const pool = new Pool(Deno.env.get('SUPABASE_DB_URL'), 2);

// This endpoint uses 'publishable' | 'secret' access, apiKey is required.
// Use publishable for Client-facing, key-validated endpoints
// Use secret for Server-to-server, internal calls
export default {
  fetch: withSupabase<Database>(
    { auth: ['user'] }, // 'secret'
    async (req, ctx) => {
      // Called by another service with a secret key
      // ctx.supabaseAdmin bypasses RLS — use for privileged operations
      /*
    if (ctx.authMode === "secret") {
      const { user_id } = await req.json();
      const { data } = await ctx.supabaseAdmin.auth.admin.getUserById(user_id);

      return Response.json({
        email: data?.user?.email,
      });
    }
    */

      const {
        prompt,
        mode = 'create',
        reportId,
        // existingSql, // TODO: what is this for ?? delete ??
      } = await req.json();

      // TODO: CHECK QUOTA
      // await checkQuota(ctx);

      // const dbClient = await pool.connect();

      const result = streamText({
        model: anthropic('claude-opus-4-8'),

        // maxSteps: 12,

        system: buildSystemPrompt(mode),

        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],

        tools: {
          list_tables: tool({
            description:
              'List all available tables and views in the public schema.',
            inputSchema: z.object({}),
            execute: listTables,
          }),

          get_table_schema: tool({
            description: 'Return column information for one or more tables.',
            inputSchema: z.object({
              tables: z.array(z.string()),
            }),
            execute: ({ tables }) => getTableSchema(tables),
          }),

          sample_rows: tool({
            description:
              'Preview a few rows from a table so value formats are visible.',
            inputSchema: z.object({
              table: z.string(),
              limit: z.int().optional().default(5),
            }),
            execute: ({ table, limit }) => sampleRows(table, limit),
          }),

          run_sql: tool({
            description: 'Execute SQL through the guarded report executor.',
            inputSchema: z.object({
              sql: z.string(),
            }),
            execute: ({ sql }) =>
              executeReportSql({
                sql,
                claims: ctx.jwtClaims ?? {},
                rowCap: ROW_CAPS.agentPreview,
              }),
          }),

          submit_report: tool({
            description: 'Finish generation and save the completed report.',
            inputSchema: z.object({
              name: z.string(),
              description: z.string(),
              sql: z.string(),
              columns: z.array(
                z.object({
                  field: z.string(),
                  label: z.string(),
                  kind: z.string(),
                }),
              ),
            }),

            execute: async (report) => {
              const saved = await saveReport(ctx, {
                ...report,
                prompt,
                reportId,
                // existingSql,
              });

              return {
                reportId: saved.id,
              };
            },
          }),
        },

        // onStepFinish(step) {
        //   console.log(step.usage);
        // },

        onFinish: async ({ usage, steps }) => {
          // await logGeneration(ctx, {
          //   prompt,
          //   reportId,
          //   inputTokens: usage.promptTokens,
          //   outputTokens: usage.completionTokens,
          //   steps: steps.length,
          //   outcome: 'succeeded',
          // });
        },
      });

      return result.toUIMessageStreamResponse();
    },
  ),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/generate-report' \
    --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
    --data '{"name":"Functions"}'

*/

// TODO: IMPROVE SYSTEM PROMPT
function buildSystemPrompt(mode: string) {
  return `
You generate SQL reports.

Rules:

- Prefer views over raw tables.
- Only query the public schema.
- Never guess column names.
- Always inspect schema first.
- Run queries until they succeed.
- If PostgreSQL returns an error, fix the SQL.
- Stop only after submit_report().
- Return concise report names.
- Include all output columns.
`;
}

export async function saveReport(
  ctx: SupabaseContext<Database>,
  report: {
    name: string;
    description: string;
    prompt: string;
    sql: string;
    columns: { field: string; label: string; kind: string }[]; // jsonb
    reportId?: string;
  },
) {
  if (report.reportId) {
    const { data, error } = await ctx.supabase
      .from('reports')
      .update({
        name: report.name,
        description: report.description,
        prompt: report.prompt,
        sql: report.sql,
        columns: report.columns,
      })
      .eq('id', report.reportId)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  const { data, error } = await ctx.supabase
    .from('reports')
    .insert({
      name: report.name,
      description: report.description,
      prompt: report.prompt,
      sql: report.sql,
      columns: report.columns,
      created_by: ctx.userClaims?.id, // ALREADY VALIDATED IF { auth: ['user'] } ??
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}
