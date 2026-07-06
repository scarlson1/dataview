/**
 * Pinned sidebar tables, persisted to localStorage.
 *
 * Backed by a tiny external store so every mounted consumer (desktop rail and
 * the mobile Drawer both render a Sidebar) stays in sync and re-renders when a
 * table is pinned or unpinned. Order is preserved: newly pinned tables append
 * to the end of the list.
 */
import { useCallback, useSyncExternalStore } from 'react';
import type { TableName } from '../data/tables';

const STORAGE_KEY = 'dataview:pinnedTables';

const listeners = new Set<() => void>();
let pinned: readonly string[] = load();

function load(): readonly string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

function persist(next: readonly string[]): void {
  pinned = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / unavailable storage
  }
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = (): readonly string[] => pinned;
const getServerSnapshot = (): readonly string[] => [];

export interface UsePinnedTables {
  pinned: readonly TableName[];
  isPinned: (name: TableName) => boolean;
  togglePin: (name: TableName) => void;
}

export const usePinnedTables = (): UsePinnedTables => {
  const current = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const isPinned = useCallback(
    (name: TableName) => current.includes(name),
    [current],
  );

  const togglePin = useCallback((name: TableName) => {
    persist(
      pinned.includes(name)
        ? pinned.filter((n) => n !== name)
        : [...pinned, name],
    );
  }, []);

  return { pinned: current, isPinned, togglePin };
};
