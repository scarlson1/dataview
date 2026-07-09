/**
 * Client-side picker config for rater `entity` inputs and record-mapping
 * source tables. Same convention as ENTITY_PICKERS in #/lib/reportParams —
 * only the table NAME lives in the saved definition; search/label columns
 * live here, and RLS gates whatever the picker queries.
 */

import type { EntityRow } from '#/components/forms/EntitySelect';
import type { RATER_ENTITY_TABLES } from '#/types/raters';

export type RaterEntityTable = (typeof RATER_ENTITY_TABLES)[number];

interface EntityPickerConfig {
  /** Relation the picker queries (may be a view, e.g. policies_computed). */
  queryTable: string;
  searchColumns: string[];
  getOptionLabel: (row: EntityRow) => string;
}

export const RATER_ENTITY_PICKERS: Record<
  RaterEntityTable,
  EntityPickerConfig
> = {
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
    queryTable: 'policies_computed',
    searchColumns: ['pol_ref', 'policy_number'],
    getOptionLabel: (r) =>
      [r.pol_ref, r.policy_number].filter(Boolean).join(' · ') ||
      `Policy #${r.id}`,
  },
  new_business_submissions: {
    queryTable: 'new_business_submissions',
    searchColumns: ['nbs_ref', 'submission_number', 'policy_number'],
    getOptionLabel: (r) =>
      [r.nbs_ref, r.policy_number].filter(Boolean).join(' · ') ||
      `Submission #${r.id}`,
  },
};
