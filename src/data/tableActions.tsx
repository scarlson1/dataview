/**
 * Registry mapping a table name -> per-row action buttons shown in a trailing
 * "actions" column on that table's Data grid (see DataTab). Mirrors the
 * `entityForms` and `tableViews` registries: register a declarative action here
 * and the grid renders it; tables without an entry get no actions column.
 *
 * Actions are the grid-embedded equivalent of the buttons on the Workflow board
 * (`_dashboard.workflow.tsx`) — e.g. "Bind" drives the same `bind_new_business`
 * RPC. Keep the RPC/side-effect logic in `run`; the grid handles gating
 * (`permission`), row-level visibility (`isAvailable`), pending state and error
 * toasts.
 */

import type { QueryClient } from '@tanstack/react-query';
import type { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import type { InvoicePdfSource } from '#/components/pdf/invoicePdfDownload';
import type { PermAction } from '#/context/AuthContext';
import type { TableName } from '#/data/tables';
import { supabase } from '#/supabaseClient';

export interface RowActionContext {
  queryClient: QueryClient;
  navigate: ReturnType<typeof useNavigate>;
}

export interface RowAction {
  /** Stable id, unique within a table. */
  id: string;
  label: string;
  /** Button style; defaults to 'contained'. */
  variant?: 'contained' | 'outlined';
  /** Permission required to see/use the action; hidden when the user lacks it. */
  permission?: PermAction;
  /**
   * Resource the `permission` is checked against. Defaults to the grid's own
   * table. Set when the action mutates a different table — e.g. Bind creates a
   * policy, so it's gated on `policies` write, matching the Workflow board.
   */
  permissionResource?: TableName;
  /** Row-level gate — e.g. only unbound submissions. Defaults to always. */
  isAvailable?: (row: Record<string, unknown>) => boolean;
  /**
   * Perform the side effect. Should throw on failure (the grid shows an error
   * toast) and is responsible for its own success toast + cache invalidation.
   */
  run: (row: Record<string, unknown>, ctx: RowActionContext) => Promise<void>;
}

const TABLE_ACTIONS: Partial<Record<TableName, RowAction[]>> = {
  invoices: [
    {
      id: 'download-pdf',
      label: 'PDF',
      variant: 'outlined',
      permission: 'read',
      run: async (row) => {
        // Dynamic import keeps @react-pdf/renderer code-split out of the main
        // bundle until a PDF is actually requested. The grid queries the base
        // invoices table with select('*'), so the row carries every field the
        // document + its name lookups need.
        const { downloadInvoicePdf } = await import(
          '#/components/pdf/invoicePdfDownload'
        );
        await downloadInvoicePdf(row as unknown as InvoicePdfSource);
        toast.success('Invoice PDF downloaded');
      },
    },
  ],
  new_business_submissions: [
    {
      id: 'bind',
      label: 'Bind',
      // Binding creates a policy, so it's gated on policy write — same as the
      // Workflow board's Bind button.
      permission: 'write',
      permissionResource: 'policies',
      isAvailable: (row) => row.policy_id == null,
      run: async (row, { queryClient }) => {
        const { data, error } = await supabase.rpc('bind_new_business', {
          p_nbs_id: Number(row.id),
        });
        if (error) throw error;
        toast.success(`Bound → policy #${data}`);
        // Broad prefix invalidation refreshes every table grid + the workflow
        // board's queries in one shot.
        queryClient.invalidateQueries({ queryKey: ['table-data'] });
        queryClient.invalidateQueries({ queryKey: ['wf'] });
      },
    },
  ],
};

export const getTableActions = (name: TableName): RowAction[] =>
  TABLE_ACTIONS[name] ?? [];
