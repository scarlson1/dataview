/**
 * "Rate" action for a record row. On click it loads the full record and asks
 * the resolver (fetchMatchingRaters) which raters apply to it, then offers the
 * matches in a menu. Picking one opens the rater in a drawer, pre-filled from
 * the record. All matches are offered — there's no single "winner".
 */

import { fetchMatchingRaters } from '#/lib/raterMatching';
import { supabase } from '#/supabaseClient';
import type { RaterListRow } from '#/types/raters';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useMutation } from '@tanstack/react-query';
import { Calculator } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { RaterRunDrawer } from './RaterRunDrawer';

// The record's table is a runtime string, not a literal from the generated
// Database type, so the typed query builder narrows the column arg to `never`.
// Loosen just the two calls we make (same spirit as useTableData's cast).
interface LooseFilter {
  eq: (column: string, value: unknown) => LooseFilter;
  maybeSingle: () => Promise<{
    data: Record<string, unknown> | null;
    error: { message: string } | null;
  }>;
}

interface RateActionButtonProps {
  /** Source table name (must have a picker/columns config for pre-fill). */
  table: string;
  recordId: number;
  disabled?: boolean;
  size?: 'small' | 'medium';
  variant?: 'text' | 'outlined' | 'contained';
}

export const RateActionButton = ({
  table,
  recordId,
  disabled,
  size = 'small',
  variant = 'outlined',
}: RateActionButtonProps) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // const [loading, setLoading] = useState(false);
  // const [matches, setMatches] = useState<RaterListRow[]>([]);
  const [sourceRow, setSourceRow] = useState<Record<string, unknown> | null>(
    null,
  );
  const [selected, setSelected] = useState<RaterListRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    mutate,
    data: matches,
    isPending,
  } = useMutation({
    mutationFn: async () => {
      const query = supabase
        .from(table as never)
        .select('*') as unknown as LooseFilter;
      const { data, error } = await query.eq('id', recordId).maybeSingle();

      if (error) throw new Error(error.message);
      const row = (data ?? {}) as Record<string, unknown>;
      setSourceRow(row);

      return fetchMatchingRaters(table, row);
      // setMatches(await fetchMatchingRaters(table, row));
    },
    onError: (err) => {
      toast.error((err as Error).message);
    },
  });

  const openMenu = async (e: React.MouseEvent<HTMLElement>) => {
    setAnchor(e.currentTarget);
    mutate();
    // setLoading(true);
    // try {
    //   const query = supabase
    //     .from(table as never)
    //     .select('*') as unknown as LooseFilter;
    //   const { data, error } = await query.eq('id', recordId).maybeSingle();
    //   if (error) throw new Error(error.message);
    //   const row = (data ?? {}) as Record<string, unknown>;
    //   setSourceRow(row);
    //   setMatches(await fetchMatchingRaters(table, row));
    // } catch (err) {
    //   toast.error((err as Error).message);
    //   setMatches([]);
    // } finally {
    //   setLoading(false);
    // }
  };

  const pick = (rater: RaterListRow) => {
    setSelected(rater);
    setAnchor(null);
    setDrawerOpen(true);
  };

  return (
    <>
      <Button
        size={size}
        variant={variant}
        startIcon={<Calculator size={16} />}
        disabled={disabled}
        onClick={openMenu}
      >
        Rate
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
      >
        {isPending ? (
          <MenuItem disabled sx={{ gap: 1 }}>
            <CircularProgress size={16} /> Finding raters…
          </MenuItem>
        ) : matches?.length === 0 ? (
          <MenuItem disabled>No matching raters</MenuItem>
        ) : (
          matches?.map((rater) => (
            <MenuItem key={rater.id} onClick={() => pick(rater)}>
              {rater.name}
            </MenuItem>
          ))
        )}
      </Menu>
      <RaterRunDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        raterId={selected?.id ?? null}
        raterName={selected?.name}
        sourceRow={sourceRow}
      />
    </>
  );
};
