/**
 * Standalone record picker for the run page's pre-fill (EntitySelect is a
 * TanStack-Form field and needs field context; this is a plain controlled
 * Autocomplete with the same server-side search behavior).
 */

import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { EntityRow } from '#/components/forms/EntitySelect';
import { supabase } from '#/supabaseClient';

interface RecordPickerProps {
  label: string;
  table: string;
  searchColumns: string[];
  getOptionLabel: (row: EntityRow) => string;
  onSelect: (row: EntityRow | null) => void;
}

const sanitize = (s: string): string => s.replace(/[(),]/g, ' ').trim();

export const RecordPicker = ({
  label,
  table,
  searchColumns,
  getOptionLabel,
  onSelect,
}: RecordPickerProps) => {
  const [inputValue, setInputValue] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<EntityRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(sanitize(inputValue)), 250);
    return () => clearTimeout(t);
  }, [inputValue]);

  const options = useQuery({
    queryKey: ['rater-record-picker', table, search],
    queryFn: async (): Promise<EntityRow[]> => {
      let query = supabase
        .from(table as never)
        .select('*')
        .order('id')
        .limit(20);
      if (search) {
        query = query.or(
          searchColumns.map((c) => `${c}.ilike.%${search}%`).join(','),
        ) as typeof query;
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as EntityRow[];
    },
  });

  return (
    <Autocomplete<EntityRow, false, false, false>
      value={selected}
      options={options.data ?? []}
      loading={options.isFetching}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      filterOptions={(x) => x}
      onChange={(_e, row) => {
        setSelected(row);
        onSelect(row);
      }}
      onInputChange={(_e, val, reason) => {
        if (reason === 'input') setInputValue(val);
        if (reason === 'clear') setInputValue('');
      }}
      size='small'
      fullWidth
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          slotProps={{
            ...params.slotProps,
            input: {
              ...(params.slotProps?.input ?? {}),
              endAdornment: (
                <>
                  {options.isFetching ? (
                    <CircularProgress color='inherit' size={16} />
                  ) : null}
                  {
                    (
                      params.slotProps?.input as {
                        endAdornment?: React.ReactNode;
                      }
                    )?.endAdornment
                  }
                </>
              ),
            },
          }}
        />
      )}
    />
  );
};
