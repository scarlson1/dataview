/**
 * Registry mapping a table name -> extra "view" tabs shown on its list page,
 * alongside the built-in Data and Schema tabs in TableViewer.
 *
 * This is where entity-scoped reports live: a report that is really just a
 * filtered/aggregated view of one table (e.g. AR aging) belongs on that table
 * rather than in a standalone footer route. Mirrors the entityForms registry —
 * register a lazy component here and TableViewer renders it as a tab; no per
 * table route required. Tables without an entry simply show Data/Schema only.
 */
import { type ComponentType, type LazyExoticComponent, lazy } from 'react';
import { Receipt } from 'lucide-react';
import type { TableName } from '#/data/tables';

export interface TableViewEntry {
  /** Stable tab id; must be unique within a table and not 'data'/'schema'. */
  id: string;
  label: string;
  /** lucide-react icon component. */
  icon: ComponentType<{ size?: number }>;
  component: LazyExoticComponent<ComponentType>;
}

const lazyView = (
  loader: () => Promise<{ default: ComponentType }>,
): LazyExoticComponent<ComponentType> => lazy(loader);

const TABLE_VIEWS: Partial<Record<TableName, TableViewEntry[]>> = {
  accounts_receivable: [
    {
      id: 'aging',
      label: 'Aging',
      icon: Receipt,
      component: lazyView(
        () => import('#/components/reports/AgedReceivablesReport'),
      ),
    },
  ],
};

export const getTableViews = (name: TableName): TableViewEntry[] =>
  TABLE_VIEWS[name] ?? [];
