/**
 * Client-side picker config for report `entity` params. MUST stay in sync with
 * the server allowlist in supabase/functions/_shared/reportParams.ts (same
 * convention as the type mirrors in #/types/reports). Only the table NAME
 * comes from the saved report config — search/label columns live here, so a
 * bad saved config can at worst degrade labels, and RLS still gates whatever
 * the picker queries.
 */

import type { EntityRow } from '#/components/forms/EntitySelect';
import type { ReportEntityTable } from '#/types/reports';

interface EntityPickerConfig {
  /** Relation the picker queries (may be a view, e.g. policies_computed). */
  queryTable: string;
  searchColumns: string[];
  getOptionLabel: (row: EntityRow) => string;
}

export const ENTITY_PICKERS: Record<ReportEntityTable, EntityPickerConfig> = {
  carriers: {
    queryTable: 'carriers',
    searchColumns: ['carrier_name'],
    getOptionLabel: (r) => (r.carrier_name as string) || `Carrier #${r.id}`,
  },
  agencies: {
    queryTable: 'agencies',
    searchColumns: ['entity_name', 'last_name', 'first_name'],
    getOptionLabel: (r) => (r.display_name as string) || `Agent #${r.id}`,
  },
  clients: {
    queryTable: 'clients',
    searchColumns: ['company_name', 'last_name', 'first_name'],
    getOptionLabel: (r) =>
      (r.company_name as string) ||
      [r.first_name, r.last_name].filter(Boolean).join(' ') ||
      `Client #${r.id}`,
  },
  policies: {
    // The picker searches the computed view (denormalized refs), but the row
    // ids are `policies` ids — exactly what the report SQL filters on.
    queryTable: 'policies_computed',
    searchColumns: ['pol_ref', 'policy_number'],
    getOptionLabel: (r) =>
      [r.pol_ref, r.policy_number].filter(Boolean).join(' · ') ||
      `Policy #${r.id}`,
  },
};
