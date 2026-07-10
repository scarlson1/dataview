import { describe, expect, it } from 'vitest';
import type { RaterDefinition, TraceStep } from '#/types/raters';
import { definitionToFlow } from './flowGraph';

const definition: RaterDefinition = {
  schema_version: 1,
  inputs: [{ name: 'x', label: 'X', type: 'number', required: true }],
  steps: [
    { id: 'base', type: 'calc', expr: 'inputs.x * 2' },
    {
      id: 'br',
      type: 'branch',
      cases: [
        {
          label: 'big',
          when: 'inputs.x > 10',
          steps: [{ id: 'factor', type: 'calc', expr: '2' }],
        },
        {
          label: 'small',
          when: 'inputs.x <= 10',
          steps: [{ id: 'factor', type: 'calc', expr: '1' }],
        },
      ],
      else: [{ id: 'factor', type: 'calc', expr: '0' }],
    },
    {
      id: 'out',
      type: 'output',
      label: 'Out',
      expr: 'base * factor',
      format: 'number',
    },
  ],
};

describe('definitionToFlow', () => {
  it('chains inputs → steps and fans out branch cases with labeled edges', () => {
    const { nodes, edges } = definitionToFlow(definition);

    // inputs + base + branch + 3× factor (one per path) + out
    expect(nodes).toHaveLength(7);
    expect(nodes[0].data.stepType).toBe('inputs');

    const labels = edges
      .map((e) => e.label)
      .filter(Boolean)
      .sort();
    expect(labels).toEqual(['big', 'else', 'small']);

    // all three factor nodes merge into the single out node
    const outNode = nodes.find((n) => n.data.title === 'out');
    expect(outNode).toBeDefined();
    const intoOut = edges.filter((e) => e.target === outNode?.id);
    expect(intoOut).toHaveLength(3);

    // no trace → neutral status everywhere
    expect(new Set(nodes.map((n) => n.data.status))).toEqual(new Set(['none']));
  });

  it('highlights the executed path and dims untaken cases from a trace', () => {
    const trace: TraceStep[] = [
      { id: 'base', type: 'calc', status: 'ok', value: 24 },
      {
        id: 'br',
        type: 'branch',
        status: 'ok',
        detail: { caseTaken: 0, caseLabel: 'big' },
      },
      { id: 'factor', type: 'calc', status: 'skipped' }, // small case
      { id: 'factor', type: 'calc', status: 'skipped' }, // else
      { id: 'factor', type: 'calc', status: 'ok', value: 2 },
      { id: 'out', type: 'output', status: 'ok', value: 48 },
    ];

    const { nodes, edges } = definitionToFlow(definition, trace);

    const factorNodes = nodes.filter((n) => n.data.title === 'factor');
    expect(factorNodes.map((n) => n.data.status).sort()).toEqual([
      'ok',
      'skipped',
      'skipped',
    ]);
    // the executed factor node carries the value badge
    expect(factorNodes.find((n) => n.data.status === 'ok')?.data.badge).toBe(
      '2',
    );

    // untaken case edges are dimmed; the taken one is not
    const bigEdge = edges.find((e) => e.label === 'big');
    const smallEdge = edges.find((e) => e.label === 'small');
    const elseEdge = edges.find((e) => e.label === 'else');
    expect(bigEdge?.dimmed).toBeFalsy();
    expect(smallEdge?.dimmed).toBe(true);
    expect(elseEdge?.dimmed).toBe(true);

    expect(nodes.find((n) => n.data.title === 'out')?.data.status).toBe('ok');
  });

  it('marks the failing step red and downstream steps skipped', () => {
    const trace: TraceStep[] = [
      { id: 'base', type: 'calc', status: 'error', error: 'division by zero' },
      { id: 'br', type: 'branch', status: 'skipped' },
      { id: 'factor', type: 'calc', status: 'skipped' },
      { id: 'factor', type: 'calc', status: 'skipped' },
      { id: 'factor', type: 'calc', status: 'skipped' },
      { id: 'out', type: 'output', status: 'skipped' },
    ];

    const { nodes } = definitionToFlow(definition, trace);
    expect(nodes.find((n) => n.data.title === 'base')?.data.status).toBe(
      'error',
    );
    expect(nodes.find((n) => n.data.title === 'out')?.data.status).toBe(
      'skipped',
    );
  });

  it('badges a fired decision with its outcome and marks it a terminal', () => {
    const withDecision: RaterDefinition = {
      schema_version: 1,
      inputs: [
        { name: 'score', label: 'Score', type: 'number', required: true },
      ],
      steps: [
        {
          id: 'decline_low',
          type: 'decision',
          outcome: 'decline',
          when: 'inputs.score < 600',
        },
        { id: 'premium', type: 'calc', expr: 'inputs.score' },
        {
          id: 'out',
          type: 'output',
          label: 'Out',
          expr: 'premium',
          format: 'money',
        },
      ],
    };

    const trace: TraceStep[] = [
      {
        id: 'decline_low',
        type: 'decision',
        status: 'ok',
        detail: { fired: true, outcome: 'decline', reason: null },
      },
      { id: 'premium', type: 'calc', status: 'skipped' },
      { id: 'out', type: 'output', status: 'skipped' },
    ];

    const { nodes } = definitionToFlow(withDecision, trace);
    const decisionNode = nodes.find((n) => n.data.title === 'decline_low');
    expect(decisionNode?.data.status).toBe('ok');
    expect(decisionNode?.data.badge).toBe('decline'); // outcome, not a bound value
    // downstream steps are skipped (dimmed) after the terminal
    expect(nodes.find((n) => n.data.title === 'out')?.data.status).toBe(
      'skipped',
    );
  });
});
