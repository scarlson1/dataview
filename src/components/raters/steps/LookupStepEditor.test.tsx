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
import type { LookupStep } from '#/types/raters';
import { LookupStepEditor } from './LookupStepEditor';

const numberLookup = (): LookupStep => ({
  id: 'rate_table',
  type: 'lookup',
  columns: [{ name: 'rate', type: 'number' }],
  rows: [[null]], // one empty number cell
  match: [{ mode: 'exact', column: 'rate', value: '' }],
  onMiss: 'error',
});

// Controlled parent: mirrors how RaterBuilder re-renders with the new step on
// every edit (the round-trip only bites when the input is truly controlled).
const Harness = ({ onStep }: { onStep: (s: LookupStep) => void }) => {
  const [step, setStep] = useState<LookupStep>(numberLookup);
  return (
    <LookupStepEditor
      step={step}
      availableBindings={[]}
      onChange={(s) => {
        setStep(s as LookupStep);
        onStep(s as LookupStep);
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

describe('LookupStepEditor number cells', () => {
  it('lets you type a small decimal (0.0008) without stripping the point', () => {
    let latest: LookupStep | null = null;
    const { container } = render(<Harness onStep={(s) => (latest = s)} />);

    const cell = () =>
      container.querySelector('tbody input') as HTMLInputElement;
    fireEvent.focus(cell());
    typeChars(cell, '0.0008');
    fireEvent.blur(cell());

    // the input shows the full decimal, and the stored cell is the number
    expect(cell().value).toBe('0.0008');
    expect((latest as LookupStep | null)?.rows[0][0]).toBe(0.0008);
  });

  it('supports a trailing-zero decimal (1.50)', () => {
    let latest: LookupStep | null = null;
    const { container } = render(<Harness onStep={(s) => (latest = s)} />);

    const cell = () =>
      container.querySelector('tbody input') as HTMLInputElement;
    fireEvent.focus(cell());
    typeChars(cell, '1.50');

    // mid-edit the trailing zero is preserved for the user…
    expect(cell().value).toBe('1.50');
    // …and the committed numeric value is correct
    expect((latest as LookupStep | null)?.rows[0][0]).toBe(1.5);
  });

  it('treats a blank number cell as null (open-ended range bound)', () => {
    let latest: LookupStep | null = null;
    const { container } = render(<Harness onStep={(s) => (latest = s)} />);

    const cell = () =>
      container.querySelector('tbody input') as HTMLInputElement;
    fireEvent.focus(cell());
    typeChars(cell, '5');
    fireEvent.change(cell(), { target: { value: '' } });

    expect((latest as LookupStep | null)?.rows[0][0]).toBeNull();
  });
});
