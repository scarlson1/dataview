/**
 * Bespoke binder detail — a binder is a 3-level structure (binder → sections →
 * participants) that the generic flat detail page renders poorly. This page
 * shows the binder header, each section with its stated participation and LOB,
 * and the section's participants with a live balance check (participants' shares
 * must foot to the section's stated participation). Add/edit anywhere reuses the
 * registered entity forms in a drawer, seeded with the parent key.
 */
import { EntityDrawer } from '#/components/EntityDrawer';
import { StatusChip } from '#/components/StatusChip';
import { useAuth } from '#/context/AuthContext';
import { getEntityForm } from '#/data/entityForms';
import { labelize, money, pct } from '#/lib/money';
import { supabase } from '#/supabaseClient';
import { valueTone } from '#/theme/tokens';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { Suspense, useState } from 'react';

export const Route = createFileRoute('/_dashboard/binder/$id')({
  component: BinderDetail,
});

interface BinderRow {
  id: number;
  carrier_id: number | null;
  bdr_ref: string | null;
  binder_number: string | null;
  yoa: number | null;
  eff_date: string | null;
  exp_date: string | null;
  gross_com_pct: number | null;
  notes: string | null;
}
interface SectionRow {
  id: number;
  sect_ref: string | null;
  section_number: string | null;
  section_display_name: string | null;
  section_limit: number | null;
  section_attachment: number | null;
  lob_codes: string | null;
  participation_pct: number | null;
  status: string | null;
}
interface PartRow {
  id: number;
  sect_id: number;
  participant_name: string | null;
  participant_type: string | null;
  syndicate_entity_number: string | null;
  participation_pct: number | null;
  section_total_pct: number | null;
  status: string | null;
}

type Relation = 'binder' | 'binder_section' | 'binder_part';
interface DrawerState {
  relation: Relation;
  recordId?: number;
  initialRow?: Record<string, unknown>;
  defaultValues?: Record<string, unknown>;
}

const PCT_TOL = 0.0000001;

const HeaderField = ({ label, value }: { label: string; value: string }) => (
  <Box>
    <Typography
      sx={{
        fontSize: 11.5,
        fontWeight: 600,
        color: 'text.secondary',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </Typography>
    <Typography sx={{ fontSize: 14, mt: 0.25 }}>{value}</Typography>
  </Box>
);

function BinderDetail() {
  const { id } = Route.useParams();
  const binderId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const canWriteBinder = can('binder', 'write');
  const canWriteSection = can('binder_section', 'write');
  const canWritePart = can('binder_part', 'write');
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  const binderQuery = useQuery({
    queryKey: ['binder-detail', binderId],
    queryFn: async () => {
      const binderRes = await supabase
        .from('binder')
        .select('*')
        .eq('id', binderId)
        .single();
      if (binderRes.error) throw binderRes.error;
      const binder = binderRes.data as unknown as BinderRow;
      let carrierName: string | null = null;
      if (binder.carrier_id != null) {
        const { data } = await supabase
          .from('carriers')
          .select('carrier_name')
          .eq('id', binder.carrier_id)
          .single();
        carrierName = (data as { carrier_name: string } | null)?.carrier_name ?? null;
      }
      return { binder, carrierName };
    },
  });

  const sectionsQuery = useQuery({
    queryKey: ['binder-sections', binderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('binder_section')
        .select('*')
        .eq('binder_id', binderId)
        .order('section_number');
      if (error) throw error;
      return data as unknown as SectionRow[];
    },
  });

  const sections = sectionsQuery.data ?? [];
  const sectionIds = sections.map((s) => s.id);

  const partsQuery = useQuery({
    queryKey: ['binder-parts', binderId, sectionIds],
    enabled: sectionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('binder_part_computed')
        .select(
          'id, sect_id, participant_name, participant_type, syndicate_entity_number, participation_pct, section_total_pct, status',
        )
        .in('sect_id', sectionIds);
      if (error) throw error;
      return data as unknown as PartRow[];
    },
  });

  const partsBySection = new Map<number, PartRow[]>();
  for (const p of partsQuery.data ?? []) {
    const arr = partsBySection.get(p.sect_id) ?? [];
    arr.push(p);
    partsBySection.set(p.sect_id, arr);
  }

  const refresh = () => {
    setDrawer(null);
    qc.invalidateQueries({ queryKey: ['binder-detail', binderId] });
    qc.invalidateQueries({ queryKey: ['binder-sections', binderId] });
    qc.invalidateQueries({ queryKey: ['binder-parts', binderId] });
    qc.invalidateQueries({ queryKey: ['table-data'] });
  };

  const binder = binderQuery.data?.binder;
  const carrierName = binderQuery.data?.carrierName;
  const title = binder?.bdr_ref ?? `Binder #${id}`;

  const drawerCfg = drawer ? getEntityForm(drawer.relation) : null;
  const DrawerForm = drawerCfg?.component;
  const drawerTitle = drawer
    ? drawer.recordId != null
      ? drawerCfg?.editTitle
      : drawerCfg?.createTitle
    : '';

  return (
    <Box sx={{ maxWidth: 1000 }}>
      <Button
        size='small'
        startIcon={<ArrowLeft size={16} />}
        onClick={() => navigate({ to: '/$table', params: { table: 'binder' } })}
        sx={{ mb: 2 }}
      >
        Binders
      </Button>

      {binderQuery.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : binderQuery.isError ? (
        <Typography color='error'>
          {(binderQuery.error as Error)?.message ?? 'Failed to load binder.'}
        </Typography>
      ) : binder ? (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Typography
              sx={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace' }}
            >
              {title}
            </Typography>
            {canWriteBinder && (
              <Button
                variant='contained'
                startIcon={<Pencil size={16} />}
                onClick={() =>
                  setDrawer({
                    relation: 'binder',
                    recordId: binder.id,
                    initialRow: binder as unknown as Record<string, unknown>,
                  })
                }
              >
                Edit
              </Button>
            )}
          </Box>

          <Paper variant='outlined' sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 2.5,
              }}
            >
              <HeaderField label='Carrier' value={carrierName ?? '—'} />
              <HeaderField label='Binder number' value={binder.binder_number ?? '—'} />
              <HeaderField label='Year of account' value={binder.yoa ? String(binder.yoa) : '—'} />
              <HeaderField label='Effective' value={binder.eff_date ?? '—'} />
              <HeaderField label='Expiry' value={binder.exp_date ?? '—'} />
              <HeaderField label='Gross commission' value={pct(binder.gross_com_pct)} />
            </Box>
            {binder.notes && (
              <Typography sx={{ fontSize: 13.5, color: 'text.secondary', mt: 2 }}>
                {binder.notes}
              </Typography>
            )}
          </Paper>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1.5,
            }}
          >
            <Typography sx={{ fontSize: 16, fontWeight: 700 }}>
              Sections ({sections.length})
            </Typography>
            {canWriteSection && (
              <Button
                size='small'
                variant='outlined'
                startIcon={<Plus size={15} />}
                onClick={() =>
                  setDrawer({
                    relation: 'binder_section',
                    defaultValues: { binderId: binder.id },
                  })
                }
              >
                Add section
              </Button>
            )}
          </Box>

          {sectionsQuery.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress size={22} />
            </Box>
          ) : sections.length === 0 ? (
            <Paper variant='outlined' sx={{ p: 3, borderRadius: 2 }}>
              <Typography sx={{ color: 'text.disabled' }}>
                No sections on this binder yet.
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {sections.map((s) => {
                const parts = partsBySection.get(s.id) ?? [];
                const stated = Number(s.participation_pct) || 0;
                const summed = Number(parts[0]?.section_total_pct) || 0;
                const balanced = Math.abs(summed - stated) < PCT_TOL;
                return (
                  <Paper key={s.id} variant='outlined' sx={{ borderRadius: 2, p: 2.5 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 2,
                        mb: 1.5,
                      }}
                    >
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            sx={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace' }}
                          >
                            {s.sect_ref ?? `Section ${s.section_number ?? s.id}`}
                          </Typography>
                          {s.status && (
                            <StatusChip
                              label={labelize(s.status)}
                              tone={valueTone(s.status)}
                            />
                          )}
                        </Box>
                        <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>
                          {s.section_display_name ?? '—'}
                          {s.lob_codes ? ` · ${s.lob_codes}` : ''}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {canWriteSection && (
                          <Button
                            size='small'
                            startIcon={<Pencil size={14} />}
                            onClick={() =>
                              setDrawer({
                                relation: 'binder_section',
                                recordId: s.id,
                                initialRow: s as unknown as Record<
                                  string,
                                  unknown
                                >,
                              })
                            }
                          >
                            Edit
                          </Button>
                        )}
                        {canWritePart && (
                          <Button
                            size='small'
                            startIcon={<Plus size={14} />}
                            onClick={() =>
                              setDrawer({
                                relation: 'binder_part',
                                defaultValues: { sectId: s.id },
                              })
                            }
                          >
                            Participant
                          </Button>
                        )}
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 3, mb: 1.5, flexWrap: 'wrap' }}>
                      <HeaderField label='Limit' value={money(s.section_limit)} />
                      <HeaderField label='Attachment' value={money(s.section_attachment)} />
                      <HeaderField label='Stated participation' value={pct(stated, 5)} />
                    </Box>

                    <Table size='small'>
                      <TableHead>
                        <TableRow>
                          <TableCell>Participant</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Syndicate / Entity #</TableCell>
                          <TableCell align='right'>Participation %</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {parts.map((p) => (
                          <TableRow
                            key={p.id}
                            hover={canWritePart}
                            sx={{ cursor: canWritePart ? 'pointer' : 'default' }}
                            onClick={
                              canWritePart
                                ? () =>
                                    setDrawer({
                                      relation: 'binder_part',
                                      recordId: p.id,
                                      initialRow: p as unknown as Record<
                                        string,
                                        unknown
                                      >,
                                    })
                                : undefined
                            }
                          >
                            <TableCell>{p.participant_name ?? '—'}</TableCell>
                            <TableCell>{labelize(p.participant_type)}</TableCell>
                            <TableCell>{p.syndicate_entity_number ?? '—'}</TableCell>
                            <TableCell align='right'>{pct(p.participation_pct, 5)}</TableCell>
                          </TableRow>
                        ))}
                        {parts.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} sx={{ color: 'text.disabled' }}>
                              No participants on this section.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>

                    <Box
                      sx={{
                        mt: 1.5,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 1,
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: balanced ? 'success.main' : 'error.main',
                      }}
                    >
                      {parts.length > 0 && (
                        <span>
                          {balanced ? '✓' : '✗'} Participants total {pct(summed, 5)} of{' '}
                          {pct(stated, 5)} stated
                        </span>
                      )}
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}
        </>
      ) : null}

      {drawer && DrawerForm && (
        <EntityDrawer
          open
          title={drawerTitle ?? ''}
          onClose={() => setDrawer(null)}
        >
          <Suspense
            fallback={
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={24} />
              </Box>
            }
          >
            <DrawerForm
              recordId={drawer.recordId}
              initialRow={drawer.initialRow}
              defaultValues={drawer.defaultValues}
              onSaved={refresh}
              onCancel={() => setDrawer(null)}
            />
          </Suspense>
        </EntityDrawer>
      )}
    </Box>
  );
}
