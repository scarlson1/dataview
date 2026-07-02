/**
 * EntitySelect — a TanStack-Form field for picking an existing row from a
 * Supabase relation (server-side search) OR creating a new one inline.
 *
 * The field VALUE is the selected row's `id` (number | null) — i.e. the FK you
 * store on the parent record (e.g. new_business_submissions.client_id).
 *
 * Usage (as a registered field component):
 *
 *   <form.AppField name="client_id">
 *     {(field) => (
 *       <field.EntitySelect
 *         label="Client"
 *         table="clients"
 *         searchColumns={['company_name', 'last_name', 'first_name']}
 *         getOptionLabel={(r) =>
 *           (r.company_name as string) ??
 *           [r.first_name, r.last_name].filter(Boolean).join(' ')}
 *         renderCreateForm={({ defaultName, onCreated, onCancel }) => (
 *           <ClientCreateDialogBody
 *             defaultName={defaultName}
 *             onCreated={onCreated}   // <-- call with the freshly-inserted row
 *             onCancel={onCancel}
 *           />
 *         )}
 *       />
 *     )}
 *   </form.AppField>
 *
 * How the value gets set after a create: when `renderCreateForm`'s `onCreated`
 * is invoked with the new row, EntitySelect calls the field's `handleChange(id)`
 * internally and selects it in the input. So the create dialog only has to
 * insert the row and hand it back — it never touches the form directly.
 */
import { useFieldContext } from '#/hooks/formContext';
import { supabase } from '#/supabaseClient';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper, { type PaperProps } from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from '@tanstack/react-store';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface EntityRow {
  id: number;
  [key: string]: unknown;
}

export interface EntitySelectProps {
  label: string;
  /** Relation to query, e.g. 'clients' or 'agencies'. */
  table: string;
  /** Columns matched (ILIKE, OR'd) against the search text. */
  searchColumns: string[];
  /** Display text for a row. */
  getOptionLabel: (row: EntityRow) => string;
  /** Column to order the dropdown by (default 'id'). */
  orderBy?: string;
  /** Max rows fetched per search (default 20). */
  pageSize?: number;
  helperText?: string;
  /**
   * Called with the full selected row (or null when cleared) in addition to
   * writing its id into the field — lets a parent form auto-fill sibling
   * fields (e.g. pick a policy, auto-set its client/carrier).
   */
  onSelectRow?: (row: EntityRow | null) => void;
  /** Dialog title (default `New {label}`). */
  createTitle?: string;
  /**
   * Render the create form inside the dialog. Call `onCreated(row)` with the
   * inserted row (must include `id`) — EntitySelect then selects it and writes
   * its id into the form field. Omit to hide the "Create new…" affordance.
   */
  renderCreateForm?: (args: {
    defaultName: string;
    onCreated: (row: EntityRow) => void;
    onCancel: () => void;
  }) => React.ReactNode;
  size?: 'small' | 'medium';
}

// Loose PostgREST builder type (mirrors src/hooks/useTableData.ts) — `table` is
// a dynamic relation name not baked into the generated Database type.
type LooseQuery = ReturnType<ReturnType<typeof supabase.from>['select']>;

const dedupeById = (rows: EntityRow[]): EntityRow[] => {
  const seen = new Set<number>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
};

// PostgREST `or()` treats commas/parens as syntax — strip them from user input.
const sanitize = (s: string): string => s.replace(/[(),]/g, ' ').trim();

export function EntitySelect({
  label,
  table,
  searchColumns,
  getOptionLabel,
  orderBy = 'id',
  pageSize = 20,
  helperText,
  onSelectRow,
  createTitle,
  renderCreateForm,
  size = 'medium',
}: EntitySelectProps) {
  const { state, store, handleBlur, handleChange } = useFieldContext<
    number | null
  >();
  const errors = useSelector(store, (s) => s.meta.errors);
  const fieldId = state.value;

  const [inputValue, setInputValue] = useState('');
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState<EntityRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Debounce the search text feeding the options query.
  useEffect(() => {
    const t = setTimeout(() => setSearch(sanitize(inputValue)), 250);
    return () => clearTimeout(t);
  }, [inputValue]);

  // Options for the dropdown.
  const optionsQuery = useQuery({
    queryKey: ['entity-select', table, orderBy, pageSize, search],
    queryFn: async (): Promise<EntityRow[]> => {
      let query = supabase
        .from(table as never)
        .select('*')
        .order(orderBy)
        .limit(pageSize) as unknown as LooseQuery;
      if (search)
        query = query.or(
          searchColumns.map((c) => `${c}.ilike.%${search}%`).join(','),
        );
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as EntityRow[];
    },
  });

  // Hydrate the label for a preset field value (e.g. edit mode) not present in
  // the current search page.
  const byIdQuery = useQuery({
    queryKey: ['entity-select-by-id', table, fieldId],
    enabled: fieldId != null && selectedRow?.id !== fieldId,
    queryFn: async (): Promise<EntityRow | null> => {
      const { data, error } = await supabase
        .from(table as never)
        .select('*')
        .eq('id', fieldId as number)
        .single();
      if (error) throw error;
      return (data as unknown as EntityRow) ?? null;
    },
  });

  useEffect(() => {
    if (fieldId == null) {
      if (selectedRow !== null) setSelectedRow(null);
      return;
    }
    if (selectedRow?.id === fieldId) return;
    if (byIdQuery.data && byIdQuery.data.id === fieldId)
      setSelectedRow(byIdQuery.data);
  }, [fieldId, byIdQuery.data, selectedRow]);

  const options = dedupeById([
    ...(selectedRow ? [selectedRow] : []),
    ...(optionsQuery.data ?? []),
  ]);

  const select = (row: EntityRow | null) => {
    setSelectedRow(row);
    handleChange(row ? row.id : null);
    onSelectRow?.(row);
  };

  const CreatePaper = (paperProps: PaperProps) => (
    <Paper {...paperProps}>
      {paperProps.children}
      {renderCreateForm && (
        <Box sx={(t) => ({ borderTop: `1px solid ${t.palette.divider}` })}>
          <Button
            fullWidth
            startIcon={<Plus size={16} />}
            sx={{
              justifyContent: 'flex-start',
              px: 2,
              py: 1,
              textTransform: 'none',
            }}
            // preventDefault keeps the input focused so the click registers
            // before the Autocomplete's blur/close.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setDialogOpen(true)}
          >
            Create new {label.toLowerCase()}
            {inputValue ? ` “${inputValue}”` : ''}
          </Button>
        </Box>
      )}
    </Paper>
  );

  return (
    <>
      <Autocomplete<EntityRow, false, false, false>
        value={selectedRow}
        options={options}
        loading={optionsQuery.isFetching}
        getOptionLabel={getOptionLabel}
        isOptionEqualToValue={(o, v) => o.id === v.id}
        filterOptions={(x) => x} // server-side search; don't filter locally
        onChange={(_, row) => select(row)}
        onInputChange={(_, val, reason) => {
          if (reason === 'input') setInputValue(val);
          if (reason === 'clear') setInputValue('');
        }}
        blurOnSelect
        fullWidth
        size={size}
        slots={{ paper: CreatePaper }}
        renderInput={(params) => {
          const inputSlot = (params.slotProps?.input ?? {}) as {
            endAdornment?: React.ReactNode;
          };
          return (
            <TextField
              {...params}
              label={label}
              onBlur={handleBlur}
              error={state.meta.isTouched && !state.meta.isValid}
              helperText={
                errors.length && state.meta.isTouched
                  ? errors.map((e) => e?.message).join(', ')
                  : helperText
              }
              slotProps={{
                ...params.slotProps,
                input: {
                  ...inputSlot,
                  endAdornment: (
                    <>
                      {optionsQuery.isFetching ? (
                        <CircularProgress color='inherit' size={16} />
                      ) : null}
                      {inputSlot.endAdornment}
                    </>
                  ),
                },
              }}
            />
          );
        }}
      />

      {renderCreateForm && (
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          maxWidth='sm'
          fullWidth
        >
          <DialogTitle>{createTitle ?? `New ${label}`}</DialogTitle>
          <DialogContent>
            {renderCreateForm({
              defaultName: inputValue,
              onCreated: (row) => {
                select(row); // <-- writes row.id into the TanStack form field
                setInputValue(getOptionLabel(row));
                setDialogOpen(false);
              },
              onCancel: () => setDialogOpen(false),
            })}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export default EntitySelect;
