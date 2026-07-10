/**
 * Create/edit a shared lookup table (rater_lookup_tables). A saved table is
 * just a named grid — typed columns × cell rows — that rater lookup steps
 * reference by id (see LookupStepEditor "Saved table" mode). Match config lives
 * on each referencing step, not here, so one grid can be probed different ways.
 */

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { csvToLookupTable } from '#/lib/csv';
import { supabase } from '#/supabaseClient';
import type { LookupColumn } from '#/types/raters';
import { lookupTableContentSchema } from '#/types/raters';
import { type Cell, LookupTableGrid } from './steps/LookupTableGrid';

export interface LookupTableEditorInitial {
  name: string;
  description: string;
  columns: LookupColumn[];
  rows: Cell[][];
}

export const emptyLookupTable = (): LookupTableEditorInitial => ({
  name: '',
  description: '',
  columns: [
    { name: 'key', type: 'text' },
    { name: 'value', type: 'number' },
  ],
  rows: [['', 0]],
});

interface LookupTableEditorProps {
  tableId?: string;
  initial: LookupTableEditorInitial;
  onSaved: (id: string) => void;
  onCancel: () => void;
}

export const LookupTableEditor = ({
  tableId,
  initial,
  onSaved,
  onCancel,
}: LookupTableEditorProps) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [columns, setColumns] = useState<LookupColumn[]>(initial.columns);
  const [rows, setRows] = useState<Cell[][]>(initial.rows);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importCsv = async (file: File) => {
    try {
      const { columns: cols, rows: nextRows } = csvToLookupTable(
        await file.text(),
      );
      setColumns(cols);
      setRows(nextRows);
      // Seed the name from the file only when the user hasn't typed one.
      if (!name.trim()) {
        setName(file.name.replace(/\.csv$/i, ''));
      }
      toast.success(
        `Imported ${nextRows.length} row${nextRows.length === 1 ? '' : 's'} × ${cols.length} column${cols.length === 1 ? '' : 's'}`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Validate the grid shape (unique columns, uniform row width, caps) the same
  // way the run path will.
  const contentIssue = (() => {
    const parsed = lookupTableContentSchema.safeParse({ columns, rows });
    return parsed.success
      ? null
      : (parsed.error.issues[0]?.message ?? 'Invalid table');
  })();

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Give the table a name');
      if (contentIssue) throw new Error(contentIssue);

      const row = {
        name: name.trim(),
        description: description.trim() || null,
        columns: columns as never,
        rows: rows as never,
      };
      if (tableId) {
        const { error } = await supabase
          .from('rater_lookup_tables')
          .update(row)
          .eq('id', tableId);
        if (error) throw new Error(error.message);
        return tableId;
      }
      const { data, error } = await supabase
        .from('rater_lookup_tables')
        .insert(row)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      return (data as { id: string }).id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['rater_lookup_tables'] });
      toast.success(tableId ? 'Table saved' : 'Table created');
      onSaved(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 1000 }}>
      <Paper variant='outlined' sx={{ borderRadius: 2, p: 2.5 }}>
        <Stack spacing={2}>
          <TextField
            label='Name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            size='small'
            required
            sx={{ maxWidth: 420 }}
          />
          <TextField
            label='Description'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            size='small'
            multiline
            minRows={1}
            placeholder='What this grid is for (optional)'
          />
        </Stack>
      </Paper>

      <Paper variant='outlined' sx={{ borderRadius: 2, p: 2.5 }}>
        <Stack
          direction='row'
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.5,
          }}
        >
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Grid</Typography>
          <Button
            size='small'
            startIcon={<FileUp size={14} />}
            onClick={() => fileInputRef.current?.click()}
          >
            Import CSV
          </Button>
          <input
            ref={fileInputRef}
            type='file'
            accept='.csv,text/csv'
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importCsv(file);
              e.target.value = ''; // allow re-picking the same file
            }}
          />
        </Stack>
        <LookupTableGrid
          columns={columns}
          rows={rows}
          onChange={(cols, nextRows) => {
            setColumns(cols);
            setRows(nextRows);
          }}
        />
      </Paper>

      {contentIssue && (
        <Alert severity='warning' sx={{ fontSize: 12.5 }}>
          {contentIssue}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Button
          variant='contained'
          onClick={() => save.mutate()}
          disabled={save.isPending || !name.trim() || Boolean(contentIssue)}
        >
          {tableId ? 'Save table' : 'Create table'}
        </Button>
        <Button onClick={onCancel} disabled={save.isPending}>
          Cancel
        </Button>
      </Box>
    </Stack>
  );
};
