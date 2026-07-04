/**
 * Hand overlay on top of the auto-generated schema manifest.
 *
 * The generator (`scripts/gen-schema.mjs`) knows structure — types, keys,
 * nullability — but not *intent*: a friendly icon, a one-line description, or
 * that a base table's display columns actually live in a companion `_computed`
 * view. Everything here is optional; tables without an entry fall back to sane
 * defaults, so newly-migrated tables appear with zero edits.
 */

export interface TableOverlay {
  /** Icon key resolved by `TableIcon` (see components/TableIcon.tsx). */
  icon?: string;
  /** Short human description shown in the page header. */
  description?: string;
  /** Display label; defaults to the relation name. */
  label?: string;
  /**
   * Relation to actually query/display. Point a base table at its
   * `security_invoker` computed view so derived columns show up. Defaults to
   * the table itself.
   */
  source?: string;
  /** Columns to hide from the data grid (still visible in the Schema tab). */
  hidden?: string[];
}

/**
 * Domain sort order for the sidebar. Tables not listed here are appended
 * alphabetically. Safe to list tables that don't exist yet.
 */
export const PREFERRED_ORDER = [
  'agencies',
  'clients',
  'carriers',
  'underwriters',
  'policies',
  'new_business_submissions',
  'renewals',
  'binder_section',
  'binder_part',
  'claims',
  'invoices',
  'payments',
  'accounts_receivable',
  'license',
  'surplus_lines_state_rules',
] as const;

export const TABLE_META: Record<string, TableOverlay> = {
  agencies: {
    icon: 'agencies',
    source: 'agencies_with_status',
    description:
      'Agencies and licensees in the distribution hierarchy, including billing rollup and D&O status.',
  },
  clients: {
    icon: 'clients',
    source: 'clients_computed',
    description: 'Insured entities and individuals across all policies.',
  },
  carriers: {
    icon: 'carriers',
    description: 'Insurance carriers and markets used for placement.',
  },
  underwriters: {
    icon: 'underwriters',
    description: 'Underwriters available for assignment on submissions and renewals.',
  },
  policies: {
    icon: 'policies',
    source: 'policies_computed',
    description: 'Bound policies and endorsements with premium and commission detail.',
  },
  new_business_submissions: {
    icon: 'new_business',
    label: 'new_business_submissions',
    description: 'New-business submissions moving through the underwriting pipeline.',
  },
  renewals: {
    icon: 'renewals',
    source: 'renewals_computed',
    description: 'Renewal transactions with retention probability and expected GWP.',
  },
  binder_section: {
    icon: 'binder',
    description: 'Binder sections defining layered limits and participation.',
  },
  binder_part: {
    icon: 'binder',
    source: 'binder_part_computed',
    description: 'Carrier participations within each binder section.',
  },
  claims: {
    icon: 'claims',
    description: 'Claims with reserve and paid amounts by policy.',
  },
  invoices: {
    icon: 'invoices',
    description: 'Point-in-time invoice snapshots issued to agencies.',
  },
  payments: {
    icon: 'payments',
    description: 'Scheduled policy payments and their running balance.',
  },
  accounts_receivable: {
    icon: 'receivable',
    source: 'accounts_receivable_computed',
    description: 'Outstanding receivables with aging and balance due.',
  },
  license: {
    icon: 'license',
    source: 'license_computed',
    description: 'Surplus-lines licenses with expiration and eligibility status.',
  },
  surplus_lines_state_rules: {
    icon: 'rules',
    label: 'surplus_lines_state_rules',
    description: 'Per-state surplus-lines rules and entity-license acceptance.',
  },
  capacity: {
    icon: 'receivable',
    source: 'capacity_computed',
    description:
      'Carrier payable / fiduciary funds held, with live funding status and available-for-remittance math.',
  },
  lob_defaults: {
    icon: 'rules',
    label: 'lob_defaults',
    description: 'Per-line-of-business default renewal probability used by the renewal pipeline.',
  },
  subscription: {
    icon: 'binder',
    description:
      'Multi-carrier co-insurance headers. Build new ones from the Subscriptions page.',
  },
  subscription_participant: {
    icon: 'binder',
    source: 'subscription_participant_computed',
    description:
      'Per-carrier participation shares with participation $ and the 100% balance check.',
  },
  air_exposure: {
    icon: 'exposure',
    source: 'air_exposure_computed',
    description:
      'AIR cat-modeling exposure records: location/building/unit detail, TIV, and rolled-up equipment TIV.',
  },
  air_equipment: {
    icon: 'equipment',
    description:
      'AI/GPU & server equipment schedule per exposure, with computed GPU / server / total equipment TIV.',
  },
};

/** Relations that are companion computed views — hidden from the sidebar. */
export const COMPUTED_VIEW_SUFFIXES = ['_computed', '_with_status'];
