// @vitest-environment jsdom
/**
 * Regression test for decimal entry in lookup number cells. The cells are
 * controlled inputs; before CellInput held a draft string, each keystroke
 * round-tripped through parseCell → the parsed number was reflected straight
 * back, so an in-progress "0." (or a trailing zero) was stripped and a decimal
 * like 0.0008 could never be typed. This types character-by-character against a
 * truly controlled parent to prove the decimal survives.
 */

import { fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { LookupColumn } from '#/types/raters';
import { type Cell, LookupTableGrid } from './LookupTableGrid';

const NUMBER_COLUMN: LookupColumn[] = [{ name: 'rate', type: 'number' }];

// Controlled parent: mirrors how the editor re-renders with new rows on every
// edit (the round-trip only bites when the input is truly controlled).
const Harness = ({ onRows }: { onRows: (rows: Cell[][]) => void }) => {
  const [rows, setRows] = useState<Cell[][]>([[null]]); // one empty number cell
  return (
    <LookupTableGrid
      columns={NUMBER_COLUMN}
      rows={rows}
      onChange={(_cols, next) => {
        setRows(next);
        onRows(next);
      }}
    />
  );
};

// Type onto whatever the input currently shows, one char at a time — this is
// what a real user does and what strips the decimal in the buggy version.
const typeChars = (getInput: () => HTMLInputElement, text: string): void => {
  for (const ch of text) {
    const input = getInput();
    fireEvent.change(input, { target: { value: input.value + ch } });
  }
};

describe('LookupTableGrid number cells', () => {
  const cellOf = (container: HTMLElement) => () =>
    container.querySelector('tbody input') as HTMLInputElement;

  it('lets you type a small decimal (0.0008) without stripping the point', () => {
    let latest: Cell[][] | null = null;
    const { container } = render(<Harness onRows={(r) => (latest = r)} />);
    const cell = cellOf(container);

    fireEvent.focus(cell());
    typeChars(cell, '0.0008');
    fireEvent.blur(cell());

    expect(cell().value).toBe('0.0008');
    expect((latest as Cell[][] | null)?.[0][0]).toBe(0.0008);
  });

  it('supports a trailing-zero decimal (1.50)', () => {
    let latest: Cell[][] | null = null;
    const { container } = render(<Harness onRows={(r) => (latest = r)} />);
    const cell = cellOf(container);

    fireEvent.focus(cell());
    typeChars(cell, '1.50');

    expect(cell().value).toBe('1.50'); // trailing zero preserved mid-edit
    expect((latest as Cell[][] | null)?.[0][0]).toBe(1.5);
  });

  it('treats a blank number cell as null (open-ended range bound)', () => {
    let latest: Cell[][] | null = null;
    const { container } = render(<Harness onRows={(r) => (latest = r)} />);
    const cell = cellOf(container);

    fireEvent.focus(cell());
    typeChars(cell, '5');
    fireEvent.change(cell(), { target: { value: '' } });

    expect((latest as Cell[][] | null)?.[0][0]).toBeNull();
  });
});
