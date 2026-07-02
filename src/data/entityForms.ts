/**
 * Registry mapping a relation name -> the create/edit form for that entity.
 *
 * Drives the generic "New {entity}" drawer on list pages and the Edit drawer on
 * detail pages, so entities get dedicated create/edit UX without a hand-written
 * route per table. Entities without an entry simply don't show New/Edit
 * affordances (they remain browsable via the generic TableViewer).
 *
 * Every registered form implements EntityFormProps: it handles both create
 * (recordId undefined) and edit (recordId + initialRow provided) internally,
 * and calls onSaved(row) with the inserted/updated row. The same component is
 * reused for FK inline-create inside EntitySelect (pass onSaved={onCreated}).
 */
import { type ComponentType, lazy, type LazyExoticComponent } from 'react';

export interface EntityFormProps {
  /** Present when editing an existing row; undefined when creating. */
  recordId?: number;
  /** The fetched row (base table shape) used to pre-fill an edit. */
  initialRow?: Record<string, unknown> | null;
  /** Seed values for a fresh create (e.g. a name typed into EntitySelect). */
  defaultValues?: Record<string, unknown>;
  /** Called with the inserted/updated row on success. */
  onSaved?: (row: { id: number } & Record<string, unknown>) => void;
  onCancel?: () => void;
}

export interface EntityFormEntry {
  /** Relation to write to / read a row from. */
  relation: string;
  createTitle: string;
  editTitle: string;
  component: LazyExoticComponent<ComponentType<EntityFormProps>>;
}

const lazyForm = (
  loader: () => Promise<{ default: ComponentType<EntityFormProps> }>,
): LazyExoticComponent<ComponentType<EntityFormProps>> => lazy(loader);

export const ENTITY_FORMS: Record<string, EntityFormEntry> = {
  clients: {
    relation: 'clients',
    createTitle: 'New Client',
    editTitle: 'Edit Client',
    component: lazyForm(() => import('#/components/NewClientForm')),
  },
  agencies: {
    relation: 'agencies',
    createTitle: 'New Agency',
    editTitle: 'Edit Agency',
    component: lazyForm(() => import('#/components/NewAgencyForm')),
  },
  carriers: {
    relation: 'carriers',
    createTitle: 'New Carrier',
    editTitle: 'Edit Carrier',
    component: lazyForm(() => import('#/components/NewCarrierForm')),
  },
  underwriters: {
    relation: 'underwriters',
    createTitle: 'New Underwriter',
    editTitle: 'Edit Underwriter',
    component: lazyForm(() => import('#/components/NewUnderwriterForm')),
  },
  license: {
    relation: 'license',
    createTitle: 'New License',
    editTitle: 'Edit License',
    component: lazyForm(() => import('#/components/NewLicenseForm')),
  },
  claims: {
    relation: 'claims',
    createTitle: 'New Claim',
    editTitle: 'Edit Claim',
    component: lazyForm(() => import('#/components/NewClaimForm')),
  },
  binder: {
    relation: 'binder',
    createTitle: 'New Binder',
    editTitle: 'Edit Binder',
    component: lazyForm(() => import('#/components/NewBinderForm')),
  },
  binder_section: {
    relation: 'binder_section',
    createTitle: 'New Binder Section',
    editTitle: 'Edit Binder Section',
    component: lazyForm(() => import('#/components/NewBinderSectionForm')),
  },
  binder_part: {
    relation: 'binder_part',
    createTitle: 'New Participant',
    editTitle: 'Edit Participant',
    component: lazyForm(() => import('#/components/NewBinderPartForm')),
  },
  payments: {
    relation: 'payments',
    createTitle: 'New Payment',
    editTitle: 'Edit Payment',
    component: lazyForm(() => import('#/components/NewPaymentForm')),
  },
  budget_targets: {
    relation: 'budget_targets',
    createTitle: 'New Budget Target',
    editTitle: 'Edit Budget Target',
    component: lazyForm(() => import('#/components/NewBudgetTargetForm')),
  },
};

export const getEntityForm = (relation: string): EntityFormEntry | undefined =>
  ENTITY_FORMS[relation];
