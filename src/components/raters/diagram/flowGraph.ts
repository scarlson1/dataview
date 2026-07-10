/**
 * Pure derivation of React Flow nodes/edges from a rater definition — the
 * diagram is a VIEW of the JSON DSL, never a second source of truth. With a
 * run trace, the executed path stays full-color (with value badges), skipped
 * branches dim, and the failing step turns red.
 *
 * Positions are assigned separately by layoutFlow (dagre); this module only
 * builds the graph. Kept dependency-free so it unit-tests in vitest.
 */

import type { RaterDefinition, RaterStep, TraceStep } from '#/types/raters';

export type RaterNodeStatus = 'none' | 'ok' | 'error' | 'skipped';

export interface RaterFlowNode {
  id: string;
  type: 'raterStep';
  position: { x: number; y: number };
  data: {
    stepType: RaterStep['type'] | 'inputs';
    title: string;
    subtitle?: string;
    status: RaterNodeStatus;
    /** Formatted bound value from the trace (ok steps only). */
    badge?: string;
  };
}

export interface RaterFlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  dimmed?: boolean;
}

export interface RaterFlowGraph {
  nodes: RaterFlowNode[];
  edges: RaterFlowEdge[];
}

const summarize = (step: RaterStep): string | undefined => {
  switch (step.type) {
    case 'calc':
    case 'output':
      return step.expr || undefined;
    case 'lookup':
      return step.source === 'ref'
        ? 'shared table'
        : `${step.rows.length} rows`;
    case 'fetch':
      return step.source === 'db' ? step.table : 'external API';
    case 'branch':
      return undefined;
    case 'decision':
      return step.when ? `${step.outcome} if…` : `${step.outcome} (always)`;
  }
};

const badgeFor = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? String(value)
      : String(Number(value.toFixed(4)));
  }
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'string')
    return value.length > 18 ? `${value.slice(0, 15)}…` : value;
  return undefined; // objects are too noisy for a badge
};

interface PathEntry {
  id: string;
  label?: string;
  /** This inbound path was not executed (untaken branch case). */
  dimmed: boolean;
}

export const definitionToFlow = (
  definition: RaterDefinition,
  trace?: TraceStep[],
): RaterFlowGraph => {
  const nodes: RaterFlowNode[] = [];
  const edges: RaterFlowEdge[] = [];
  const hasTrace = Boolean(trace);

  // The executed occurrence of each step id (sibling branch cases may reuse
  // an id; only the taken path's occurrence is non-skipped).
  const executed = new Map<string, TraceStep>();
  for (const t of trace ?? []) {
    if (t.status !== 'skipped' && !executed.has(t.id)) executed.set(t.id, t);
  }

  let nodeSeq = 0;
  const addNode = (
    stepType: RaterFlowNode['data']['stepType'],
    stepId: string,
    title: string,
    subtitle: string | undefined,
    pathDimmed: boolean,
  ): string => {
    nodeSeq += 1;
    const key = `n${nodeSeq}_${stepId}`;

    const t = executed.get(stepId);
    let status: RaterNodeStatus = 'none';
    if (hasTrace) {
      if (pathDimmed || !t) status = 'skipped';
      else status = t.status === 'error' ? 'error' : 'ok';
    }

    // Decisions carry no bound value; a FIRED decision badges its outcome.
    let badge: string | undefined;
    if (status === 'ok') {
      if (stepType === 'decision') {
        badge =
          t?.detail?.fired === true ? String(t.detail.outcome) : undefined;
      } else if (stepType !== 'branch' && stepType !== 'inputs') {
        badge = badgeFor(t?.value);
      }
    }

    nodes.push({
      id: key,
      type: 'raterStep',
      position: { x: 0, y: 0 },
      data: { stepType, title, subtitle, status, badge },
    });
    return key;
  };

  let edgeSeq = 0;
  const addEdge = (
    source: string,
    target: string,
    label?: string,
    dimmed?: boolean,
  ) => {
    edgeSeq += 1;
    edges.push({
      id: `e${edgeSeq}`,
      source,
      target,
      label,
      dimmed: hasTrace && dimmed,
    });
  };

  // Chain a step list from the given inbound paths; returns the outbound
  // paths the next step connects from.
  const walk = (steps: RaterStep[], entries: PathEntry[]): PathEntry[] => {
    let current = entries;

    for (const step of steps) {
      const pathDimmed = current.every((e) => e.dimmed);

      if (step.type === 'branch') {
        const branchNode = addNode(
          'branch',
          step.id,
          step.label ?? step.id,
          undefined,
          pathDimmed,
        );
        for (const e of current) addEdge(e.id, branchNode, e.label, e.dimmed);

        const caseTaken = executed.get(step.id)?.detail?.caseTaken as
          | number
          | 'else'
          | undefined;

        const exits: PathEntry[] = [];
        step.cases.forEach((c, i) => {
          const dimmed = pathDimmed || (hasTrace && caseTaken !== i);
          exits.push(
            ...walk(c.steps, [{ id: branchNode, label: c.label, dimmed }]),
          );
        });
        const elseDimmed = pathDimmed || (hasTrace && caseTaken !== 'else');
        if (step.else?.length) {
          exits.push(
            ...walk(step.else, [
              { id: branchNode, label: 'else', dimmed: elseDimmed },
            ]),
          );
        } else {
          exits.push({ id: branchNode, dimmed: elseDimmed });
        }

        current = exits;
        continue;
      }

      const node = addNode(
        step.type,
        step.id,
        step.id,
        step.label ?? summarize(step),
        pathDimmed,
      );
      for (const e of current) addEdge(e.id, node, e.label, e.dimmed);
      current = [{ id: node, dimmed: pathDimmed }];
    }

    return current;
  };

  const inputsSubtitle = definition.inputs.length
    ? definition.inputs.map((i) => i.name).join(', ')
    : 'no inputs yet';
  const inputsNode = addNode(
    'inputs',
    '__inputs__',
    'Inputs',
    inputsSubtitle,
    false,
  );
  // The inputs node is always "executed" when a trace exists.
  if (hasTrace) nodes[0].data.status = 'ok';

  walk(definition.steps, [{ id: inputsNode, dimmed: false }]);

  return { nodes, edges };
};
