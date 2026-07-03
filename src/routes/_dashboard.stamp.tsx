/**
 * Stamp generator — Lloyd's syndicate participation schedule for a binder
 * section (SECT). Pick a section; its participants (binder_part_computed) and a
 * balance check render as a printable stamp. Use the browser Print action to
 * produce a PDF to attach to the policy file.
 */
import { pct } from '#/lib/money';
import { supabase } from '#/supabaseClient';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Printer } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_dashboard/stamp')({
  component: StampGenerator,
});

interface SectionOpt {
  id: number;
  label: string;
  section_display_name: string | null;
  participation_pct: number | null;
}
interface PartRow {
  id: number;
  participant_name: string | null;
  participant_type: string | null;
  syndicate_entity_number: string | null;
  participation_pct: number | null;
  section_total_pct: number | null;
}

function StampGenerator() {
  const [section, setSection] = useState<SectionOpt | null>(null);

  const sections = useQuery({
    queryKey: ['stamp-sections'],
    queryFn: async (): Promise<SectionOpt[]> => {
      const { data, error } = await supabase
        .from('binder_section')
        .select('id, sect_ref, section_number, section_display_name, participation_pct')
        .limit(200);
      if (error) throw error;
      return (data as unknown as Record<string, unknown>[]).map((r) => ({
        id: r.id as number,
        label:
          [r.sect_ref, r.section_display_name].filter(Boolean).join(' · ') ||
          `Section #${r.id}`,
        section_display_name: r.section_display_name as string | null,
        participation_pct: r.participation_pct as number | null,
      }));
    },
  });

  const parts = useQuery({
    queryKey: ['stamp-parts', section?.id],
    enabled: section != null,
    queryFn: async (): Promise<PartRow[]> => {
      const { data, error } = await supabase
        .from('binder_part_computed')
        .select(
          'id, participant_name, participant_type, syndicate_entity_number, participation_pct, section_total_pct',
        )
        .eq('sect_id', section?.id as number);
      if (error) throw error;
      return data as unknown as PartRow[];
    },
  });

  const rows = parts.data ?? [];
  const total = rows[0]?.section_total_pct ?? 0;
  const sectionPct = section?.participation_pct ?? 0;
  const balanced = Math.abs(Number(total) - Number(sectionPct)) < 0.0000001;

  return (
    <Box sx={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box
        className='no-print'
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 700 }}>
            Stamp generator
          </Typography>
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
            Syndicate participation schedule for a binder section.
          </Typography>
        </Box>
        <Button
          variant='outlined'
          startIcon={<Printer size={16} />}
          disabled={!section}
          onClick={() => window.print()}
        >
          Print / PDF
        </Button>
      </Box>

      <Autocomplete<SectionOpt>
        className='no-print'
        options={sections.data ?? []}
        value={section}
        onChange={(_, v) => setSection(v)}
        getOptionLabel={(o) => o.label}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        renderInput={(p) => <TextField {...p} label='Binder section' />}
      />

      {section && (
        <Paper variant='outlined' sx={{ p: { xs: 2, sm: 4 }, borderRadius: 2 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, textAlign: 'center' }}>
            Participation Schedule
          </Typography>
          <Typography
            sx={{ fontSize: 14, color: 'text.secondary', textAlign: 'center', mb: 3 }}
          >
            {section.label}
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
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
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.participant_name}</TableCell>
                  <TableCell>{r.participant_type?.replace(/_/g, ' ')}</TableCell>
                  <TableCell>{r.syndicate_entity_number ?? '—'}</TableCell>
                  <TableCell align='right'>{pct(r.participation_pct, 5)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} sx={{ color: 'text.disabled' }}>
                    No participants for this section.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </Box>
          <Box
            sx={{
              mt: 2,
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
            }}
          >
            <Box component='span'>
              Section stated: {pct(sectionPct, 5)}
            </Box>
            <Box
              component='span'
              sx={{ color: balanced ? 'success.main' : 'error.main' }}
            >
              {balanced ? '✓' : '✗'} Participants total {pct(total, 5)}
            </Box>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
