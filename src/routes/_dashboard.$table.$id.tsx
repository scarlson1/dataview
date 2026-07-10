/**
 * Generic entity detail + edit page.
 *
 * Reads a single row from the table's display relation (its computed view when
 * one exists, otherwise the base table), renders a labeled field view, and — if
 * the relation has a registered form — offers an Edit drawer that reuses the
 * same create form pre-filled with the row.
 */

import { EntityDrawer } from '#/components/EntityDrawer';
import { PolicyActions } from '#/components/PolicyActions';
import { StatusChip } from '#/components/StatusChip';
import { useAuth } from '#/context/AuthContext';
import { getEntityForm } from '#/data/entityForms';
import { getTable } from '#/data/tables';
import { labelize, money } from '#/lib/money';
import { supabase } from '#/supabaseClient';
import { valueTone } from '#/theme/tokens';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Pencil } from 'lucide-react';
import { Suspense, useState } from 'react';

export const Route = createFileRoute('/_dashboard/$table/$id')({
  component: DetailRoute,
  loader: ({ params }) => ({ crumb: params.id }),
});

const MONEY_HINT =
  /(amt|amount|premium|fee|fees|total|balance|paid|com_\$|_usd)/i;
const isMoneyField = (field: string): boolean => MONEY_HINT.test(field);
const isStatusField = (field: string): boolean => /status$/.test(field);

const formatValue = (field: string, v: unknown): string => {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number' && isMoneyField(field)) return money(v);
  return String(v);
};

function DetailRoute() {
  const { table: tableName, id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

  const table = getTable(tableName);
  const entityForm = getEntityForm(tableName);
  const FormComponent = entityForm?.component;
  // Hide edit UI for roles that can't write this table (RLS enforces it too).
  const canEdit = can(tableName, 'write');

  const rowQuery = useQuery({
    queryKey: ['entity-detail', tableName, id],
    enabled: !!table,
    queryFn: async () => {
      const source = table?.source ?? tableName;
      // Pass the raw param string, not Number(id): PostgREST casts the filter
      // value to the column type server-side, so a string works for both
      // integer and uuid PKs. Number('<uuid>') is NaN, which Postgres rejects
      // with `invalid input syntax for type uuid: "NaN"`.
      const { data, error } = await supabase
        .from(source as never)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Record<string, unknown>;
    },
  });

  if (!table) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 600 }}>
          Unknown table "{tableName}"
        </Typography>
      </Box>
    );
  }

  const row = rowQuery.data;
  const refField = table.columns.find((c) => /_ref$/.test(c.field))?.field;
  const refVal = refField ? row?.[refField] : undefined;
  const title = refVal ? String(refVal) : `${table.label} #${id}`;

  return (
    <Box sx={{ maxWidth: 1000 }}>
      <Button
        size='small'
        startIcon={<ArrowLeft size={16} />}
        onClick={() =>
          navigate({ to: '/$table', params: { table: tableName } })
        }
        sx={{ mb: 2 }}
      >
        {table.label}
      </Button>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
          mb: 2,
        }}
      >
        <Typography
          sx={{
            fontSize: 22,
            fontWeight: 700,
            fontFamily: 'monospace',
            wordBreak: 'break-word',
          }}
        >
          {title}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {tableName === 'policies' && (
            <PolicyActions
              policyId={Number(id)}
              polRef={title}
              onDone={() => {
                qc.invalidateQueries({
                  queryKey: ['entity-detail', tableName, id],
                });
                qc.invalidateQueries({ queryKey: ['table-data'] });
                qc.invalidateQueries({ queryKey: ['wf'] });
              }}
            />
          )}
          {entityForm && canEdit && (
            <Button
              variant='contained'
              startIcon={<Pencil size={16} />}
              onClick={() => setEditOpen(true)}
            >
              Edit
            </Button>
          )}
        </Box>
      </Box>

      {rowQuery.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : rowQuery.isError ? (
        <Typography color='error'>
          {(rowQuery.error as Error)?.message ?? 'Failed to load record.'}
        </Typography>
      ) : (
        <Paper variant='outlined' sx={{ p: 3, borderRadius: 2 }}>
          <Grid container spacing={2.5}>
            {table.columns
              .filter((c) => !table.hidden.includes(c.field))
              .map((c) => {
                const v = row?.[c.field];
                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={c.field}>
                    <Typography
                      sx={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {labelize(c.field)}
                    </Typography>
                    {isStatusField(c.field) && v ? (
                      <StatusChip
                        label={labelize(String(v))}
                        tone={valueTone(String(v))}
                      />
                    ) : (
                      <Typography sx={{ fontSize: 14, mt: 0.25 }}>
                        {formatValue(c.field, v)}
                      </Typography>
                    )}
                  </Grid>
                );
              })}
          </Grid>
        </Paper>
      )}

      {entityForm && FormComponent && canEdit && (
        <EntityDrawer
          open={editOpen}
          title={entityForm.editTitle}
          onClose={() => setEditOpen(false)}
        >
          <Suspense
            fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={24} />
              </Box>
            }
          >
            <FormComponent
              recordId={Number(id)}
              initialRow={row}
              onSaved={() => {
                setEditOpen(false);
                qc.invalidateQueries({
                  queryKey: ['entity-detail', tableName, id],
                });
                qc.invalidateQueries({ queryKey: ['table-data'] });
              }}
              onCancel={() => setEditOpen(false)}
            />
          </Suspense>
        </EntityDrawer>
      )}
    </Box>
  );
}
