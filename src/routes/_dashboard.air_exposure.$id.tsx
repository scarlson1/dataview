/**
 * Bespoke AIR exposure detail — an exposure record (location/building/unit +
 * insured values) plus its nested AI/GPU equipment schedule. The generic flat
 * detail page can't express the 1-to-many equipment relationship or the TIV
 * rollup (property TIV + equipment TIV = total exposure TIV), so this page shows
 * the exposure header, the property/insured-value breakdown, and an equipment
 * table with add/edit that reuses the registered entity forms in a drawer,
 * seeded with the parent exposure key.
 */

import { EntityDrawer } from '#/components/EntityDrawer';
import { StatusChip } from '#/components/StatusChip';
import { useAuth } from '#/context/AuthContext';
import { getEntityForm } from '#/data/entityForms';
import { labelize, money } from '#/lib/money';
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

export const Route = createFileRoute('/_dashboard/air_exposure/$id')({
  component: AirExposureDetail,
  loader: ({ params }) => ({ crumb: params.id }),
});

interface ExposureRow {
  id: number;
  air_ref: string | null;
  policy_id: number | null;
  client_id: number | null;
  certificate_ref: string | null;
  location_id: string | null;
  location_name: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal: string | null;
  building_id: string | null;
  year_built: number | null;
  gross_floor_area: number | null;
  building_replacement_value: number | null;
  contents_value: number | null;
  business_interruption_value: number | null;
  tiv: number | null;
  equipment_count: number | null;
  equipment_tiv: number | null;
  total_exposure_tiv: number | null;
  status: string | null;
  notes: string | null;
}
interface EquipmentRow {
  id: number;
  eqp_ref: string | null;
  equipment_category: string | null;
  gpu_manufacturer: string | null;
  gpu_model: string | null;
  gpu_count: number | null;
  total_gpu_value: number | null;
  total_server_value: number | null;
  supporting_infra_value: number | null;
  total_ai_equipment_tiv: number | null;
}

type Relation = 'air_exposure' | 'air_equipment';
interface DrawerState {
  relation: Relation;
  recordId?: number;
  initialRow?: Record<string, unknown>;
  defaultValues?: Record<string, unknown>;
}

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

function AirExposureDetail() {
  const { id } = Route.useParams();
  const exposureId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const canWriteExposure = can('air_exposure', 'write');
  const canWriteEquipment = can('air_equipment', 'write');
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  const exposureQuery = useQuery({
    queryKey: ['air-exposure-detail', exposureId],
    queryFn: async () => {
      const res = await supabase
        .from('air_exposure_computed')
        .select('*')
        .eq('id', exposureId)
        .single();
      if (res.error) throw res.error;
      const exposure = res.data as unknown as ExposureRow;

      let policyRef: string | null = null;
      if (exposure.policy_id != null) {
        const { data } = await supabase
          .from('policies')
          .select('pol_ref, policy_number')
          .eq('id', exposure.policy_id)
          .single();
        const p = data as {
          pol_ref: string;
          policy_number: string | null;
        } | null;
        policyRef = p
          ? [p.pol_ref, p.policy_number].filter(Boolean).join(' · ')
          : null;
      }
      let clientName: string | null = null;
      if (exposure.client_id != null) {
        const { data } = await supabase
          .from('clients')
          .select('company_name, first_name, last_name')
          .eq('id', exposure.client_id)
          .single();
        const c = data as {
          company_name: string | null;
          first_name: string | null;
          last_name: string | null;
        } | null;
        clientName = c
          ? c.company_name ||
            [c.first_name, c.last_name].filter(Boolean).join(' ') ||
            null
          : null;
      }
      return { exposure, policyRef, clientName };
    },
  });

  const equipmentQuery = useQuery({
    queryKey: ['air-equipment', exposureId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('air_equipment')
        .select(
          'id, eqp_ref, equipment_category, gpu_manufacturer, gpu_model, gpu_count, total_gpu_value, total_server_value, supporting_infra_value, total_ai_equipment_tiv',
        )
        .eq('exposure_id', exposureId)
        .order('id');
      if (error) throw error;
      return data as unknown as EquipmentRow[];
    },
  });

  const refresh = () => {
    setDrawer(null);
    qc.invalidateQueries({ queryKey: ['air-exposure-detail', exposureId] });
    qc.invalidateQueries({ queryKey: ['air-equipment', exposureId] });
    qc.invalidateQueries({ queryKey: ['table-data'] });
  };

  const exposure = exposureQuery.data?.exposure;
  const equipment = equipmentQuery.data ?? [];
  const title = exposure?.air_ref ?? `Exposure #${id}`;

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
        onClick={() =>
          navigate({ to: '/$table', params: { table: 'air_exposure' } })
        }
        sx={{ mb: 2 }}
      >
        AIR Exposure
      </Button>

      {exposureQuery.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : exposureQuery.isError ? (
        <Typography color='error'>
          {(exposureQuery.error as Error)?.message ??
            'Failed to load exposure.'}
        </Typography>
      ) : exposure ? (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography
                sx={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace' }}
              >
                {title}
              </Typography>
              {exposure.status && (
                <StatusChip
                  label={labelize(exposure.status)}
                  tone={valueTone(exposure.status)}
                />
              )}
            </Box>
            {canWriteExposure && (
              <Button
                variant='contained'
                startIcon={<Pencil size={16} />}
                onClick={() =>
                  setDrawer({
                    relation: 'air_exposure',
                    recordId: exposure.id,
                    initialRow: exposure as unknown as Record<string, unknown>,
                  })
                }
              >
                Edit
              </Button>
            )}
          </Box>

          {/* Location & policy linkage */}
          <Paper variant='outlined' sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 2.5,
              }}
            >
              <HeaderField
                label='Location'
                value={exposure.location_name ?? exposure.location_id ?? '—'}
              />
              <HeaderField
                label='Address'
                value={
                  [exposure.street_address, exposure.city, exposure.state]
                    .filter(Boolean)
                    .join(', ') || '—'
                }
              />
              <HeaderField
                label='Policy'
                value={exposureQuery.data?.policyRef ?? '—'}
              />
              <HeaderField
                label='Client'
                value={exposureQuery.data?.clientName ?? '—'}
              />
              <HeaderField
                label='Building'
                value={exposure.building_id ?? '—'}
              />
              <HeaderField
                label='Year built'
                value={exposure.year_built ? String(exposure.year_built) : '—'}
              />
            </Box>
            {exposure.notes && (
              <Typography
                sx={{ fontSize: 13.5, color: 'text.secondary', mt: 2 }}
              >
                {exposure.notes}
              </Typography>
            )}
          </Paper>

          {/* Insured values / TIV rollup */}
          <Paper variant='outlined' sx={{ p: 3, borderRadius: 2, mb: 3 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 2 }}>
              Insured values (TIV)
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 2.5,
              }}
            >
              <HeaderField
                label='Building'
                value={money(exposure.building_replacement_value)}
              />
              <HeaderField
                label='Contents'
                value={money(exposure.contents_value)}
              />
              <HeaderField
                label='Business interruption'
                value={money(exposure.business_interruption_value)}
              />
              <HeaderField label='Property TIV' value={money(exposure.tiv)} />
              <HeaderField
                label='Equipment TIV'
                value={money(exposure.equipment_tiv)}
              />
            </Box>
            <Box
              sx={(t) => ({
                mt: 2,
                pt: 2,
                borderTop: `1px solid ${t.palette.divider}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              })}
            >
              <Typography
                sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 600 }}
              >
                Total exposure TIV (property + equipment)
              </Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
                {money(exposure.total_exposure_tiv)}
              </Typography>
            </Box>
          </Paper>

          {/* Equipment schedule */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1.5,
            }}
          >
            <Typography sx={{ fontSize: 16, fontWeight: 700 }}>
              Equipment schedule ({equipment.length})
            </Typography>
            {canWriteEquipment && (
              <Button
                size='small'
                variant='outlined'
                startIcon={<Plus size={15} />}
                onClick={() =>
                  setDrawer({
                    relation: 'air_equipment',
                    defaultValues: { exposureId: exposure.id },
                  })
                }
              >
                Add equipment
              </Button>
            )}
          </Box>

          <Paper variant='outlined' sx={{ borderRadius: 2, overflow: 'auto' }}>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Ref</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>GPU</TableCell>
                  <TableCell align='right'>GPU $</TableCell>
                  <TableCell align='right'>Server $</TableCell>
                  <TableCell align='right'>Infra $</TableCell>
                  <TableCell align='right'>Equipment TIV</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {equipment.map((e) => (
                  <TableRow
                    key={e.id}
                    hover={canWriteEquipment}
                    sx={{ cursor: canWriteEquipment ? 'pointer' : 'default' }}
                    onClick={
                      canWriteEquipment
                        ? () =>
                            setDrawer({
                              relation: 'air_equipment',
                              recordId: e.id,
                              initialRow: e as unknown as Record<
                                string,
                                unknown
                              >,
                            })
                        : undefined
                    }
                  >
                    <TableCell sx={{ fontFamily: 'monospace' }}>
                      {e.eqp_ref ?? '—'}
                    </TableCell>
                    <TableCell>{e.equipment_category ?? '—'}</TableCell>
                    <TableCell>
                      {[
                        e.gpu_count ? `${e.gpu_count}×` : '',
                        e.gpu_manufacturer,
                        e.gpu_model,
                      ]
                        .filter(Boolean)
                        .join(' ') || '—'}
                    </TableCell>
                    <TableCell align='right'>
                      {money(e.total_gpu_value)}
                    </TableCell>
                    <TableCell align='right'>
                      {money(e.total_server_value)}
                    </TableCell>
                    <TableCell align='right'>
                      {money(e.supporting_infra_value)}
                    </TableCell>
                    <TableCell align='right'>
                      {money(e.total_ai_equipment_tiv)}
                    </TableCell>
                  </TableRow>
                ))}
                {equipment.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ color: 'text.disabled' }}>
                      No equipment scheduled for this exposure.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
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
