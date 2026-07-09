/**
 * Immutable helpers over a RaterDefinition's step tree. The builder's state
 * is one definition object; every editor mutates it through these.
 *
 * A StepPath addresses a step in the tree: numbers index into a step list,
 * and a case segment descends into a branch. Example:
 *   [3]                          → steps[3]
 *   [3, { case: 0 }, 1]          → steps[3].cases[0].steps[1]
 *   [3, { case: 'else' }, 0]     → steps[3].else[0]
 */

import type { BranchStep, RaterDefinition, RaterStep } from '#/types/raters';
import { parse, referencedBindings } from '#rater-shared/expr.ts';

export type StepPathSegment = number | { case: number | 'else' };
export type StepPath = StepPathSegment[];

export const pathKey = (path: StepPath): string =>
  path.map((s) => (typeof s === 'number' ? s : `c${s.case}`)).join('.');

// --- tree access -----------------------------------------------------------------

/** The step list containing the step at `path` (all but the final index). */
const listAt = (steps: RaterStep[], path: StepPath): RaterStep[] => {
  let list = steps;
  for (let i = 0; i < path.length - 1; i += 1) {
    const seg = path[i];
    if (typeof seg === 'number') {
      const next = path[i + 1];
      if (typeof next === 'number') {
        throw new Error('invalid step path: consecutive indices');
      }
      const branch = list[seg] as BranchStep;
      i += 1;
      list =
        next.case === 'else'
          ? (branch.else ?? [])
          : branch.cases[next.case].steps;
    } else {
      throw new Error('invalid step path: case segment without branch index');
    }
  }
  return list;
};

export const stepAt = (
  definition: RaterDefinition,
  path: StepPath,
): RaterStep => {
  const list = listAt(definition.steps, path);
  return list[path[path.length - 1] as number];
};

// Rebuild the tree with `mutate` applied to the list containing `path`'s tail.
const withList = (
  steps: RaterStep[],
  path: StepPath,
  mutate: (list: RaterStep[]) => RaterStep[],
): RaterStep[] => {
  if (path.length <= 1) return mutate([...steps]);

  const [head, caseSeg, ...rest] = path;
  if (typeof head !== 'number' || typeof caseSeg === 'number') {
    throw new Error('invalid step path');
  }
  const branch = steps[head] as BranchStep;
  const updated: BranchStep =
    caseSeg.case === 'else'
      ? { ...branch, else: withList(branch.else ?? [], rest, mutate) }
      : {
          ...branch,
          cases: branch.cases.map((c, i) =>
            i === caseSeg.case
              ? { ...c, steps: withList(c.steps, rest, mutate) }
              : c,
          ),
        };
  return steps.map((s, i) => (i === head ? updated : s));
};

export const replaceStepAt = (
  definition: RaterDefinition,
  path: StepPath,
  step: RaterStep,
): RaterDefinition => ({
  ...definition,
  steps: withList(definition.steps, path, (list) => {
    list[path[path.length - 1] as number] = step;
    return list;
  }),
});

export const removeStepAt = (
  definition: RaterDefinition,
  path: StepPath,
): RaterDefinition => ({
  ...definition,
  steps: withList(definition.steps, path, (list) => {
    list.splice(path[path.length - 1] as number, 1);
    return list;
  }),
});

/** Insert `step` at the end of the list addressed by `parentPath` ([] = root). */
export const appendStep = (
  definition: RaterDefinition,
  parentPath: StepPath,
  step: RaterStep,
): RaterDefinition => ({
  ...definition,
  steps: withList(
    definition.steps,
    [...parentPath, Number.MAX_SAFE_INTEGER],
    (list) => {
      list.push(step);
      return list;
    },
  ),
});

/** Move a step up (-1) or down (+1) within its own list. */
export const moveStepAt = (
  definition: RaterDefinition,
  path: StepPath,
  delta: -1 | 1,
): RaterDefinition => ({
  ...definition,
  steps: withList(definition.steps, path, (list) => {
    const from = path[path.length - 1] as number;
    const to = from + delta;
    if (to < 0 || to >= list.length) return list;
    const [step] = list.splice(from, 1);
    list.splice(to, 0, step);
    return list;
  }),
});

// --- scope / bindings ---------------------------------------------------------------

/**
 * Binding names available to an expression edited at `path`: every step id
 * declared earlier in the same list, plus everything visible at the parent
 * position for nested lists. (Branch guards see the scope at the branch.)
 */
export const bindingsBefore = (
  definition: RaterDefinition,
  path: StepPath,
): string[] => {
  const names: string[] = [];
  let list = definition.steps;

  for (let i = 0; i < path.length; i += 1) {
    const seg = path[i];
    if (typeof seg !== 'number') throw new Error('invalid step path');
    const isLast = i === path.length - 1;
    const upTo = Math.min(seg, list.length);
    for (let j = 0; j < upTo; j += 1) {
      const s = list[j];
      if (s.type !== 'branch') names.push(s.id);
    }
    if (isLast) break;

    const caseSeg = path[i + 1];
    if (typeof caseSeg === 'number') throw new Error('invalid step path');
    const branch = list[seg] as BranchStep;
    list =
      caseSeg.case === 'else'
        ? (branch.else ?? [])
        : branch.cases[caseSeg.case].steps;
    i += 1;
  }

  return names;
};

/** All step ids in the whole tree that reference `bindingName` in some expression. */
export const referencingSteps = (
  definition: RaterDefinition,
  bindingName: string,
): string[] => {
  const found: string[] = [];

  const exprsOf = (step: RaterStep): string[] => {
    switch (step.type) {
      case 'calc':
      case 'output':
        return [step.expr];
      case 'lookup':
        return step.match.map((m) => m.value);
      case 'fetch':
        return step.source === 'db'
          ? step.filters.map((f) => f.value)
          : [
              ...[...step.url.matchAll(/\{\{(.*?)\}\}/g)].map((m) => m[1]),
              ...Object.values(step.query ?? {}),
            ];
      case 'branch':
        return step.cases.map((c) => c.when);
      case 'decision':
        return [step.when, step.reason].filter((s): s is string => Boolean(s));
    }
  };

  const walk = (steps: RaterStep[]): void => {
    for (const step of steps) {
      const references = exprsOf(step).some((src) => {
        try {
          return referencedBindings(parse(src)).has(bindingName);
        } catch {
          return false;
        }
      });
      if (references) found.push(step.id);
      if (step.type === 'branch') {
        for (const c of step.cases) walk(c.steps);
        if (step.else) walk(step.else);
      }
    }
  };

  walk(definition.steps);
  return found;
};

// --- new-step factories ---------------------------------------------------------------

let counter = 0;

/** A step id not used anywhere in the tree (the user renames it after). */
export const freshStepId = (
  definition: RaterDefinition,
  base: string,
): string => {
  const used = new Set<string>();
  const walk = (steps: RaterStep[]): void => {
    for (const s of steps) {
      used.add(s.id);
      if (s.type === 'branch') {
        for (const c of s.cases) walk(c.steps);
        if (s.else) walk(s.else);
      }
    }
  };
  walk(definition.steps);

  let candidate = base;
  while (used.has(candidate)) {
    counter += 1;
    candidate = `${base}_${counter}`;
  }
  return candidate;
};

export const newStep = (
  definition: RaterDefinition,
  type: RaterStep['type'],
): RaterStep => {
  switch (type) {
    case 'calc':
      return { id: freshStepId(definition, 'calc'), type: 'calc', expr: '' };
    case 'lookup':
      return {
        id: freshStepId(definition, 'lookup'),
        type: 'lookup',
        columns: [
          { name: 'key', type: 'text' },
          { name: 'value', type: 'number' },
        ],
        rows: [['', 0]],
        match: [{ mode: 'exact', column: 'key', value: '' }],
        onMiss: 'error',
      };
    case 'fetch':
      return {
        id: freshStepId(definition, 'fetch'),
        type: 'fetch',
        source: 'db',
        table: '',
        select: [],
        filters: [],
        mode: 'maybe',
        onEmpty: 'null',
      };
    case 'branch':
      return {
        id: freshStepId(definition, 'branch'),
        type: 'branch',
        cases: [{ label: 'Case 1', when: '', steps: [] }],
        else: [],
      };
    case 'decision':
      return {
        id: freshStepId(definition, 'decision'),
        type: 'decision',
        outcome: 'decline',
        when: '',
      };
    case 'output':
      return {
        id: freshStepId(definition, 'output'),
        type: 'output',
        label: 'Output',
        expr: '',
        format: 'number',
      };
  }
};
