// Cross-step static validation of a rater definition — everything Zod's
// per-step shape checks can't see: binding references, per-path duplicate
// ids, output reachability, structural caps, expression parse errors.
//
// Errors block save/run; warnings surface in the builder but don't block
// (e.g. a binding that is only assigned on some branch paths — running the
// other path errors at runtime).

import { ExprError, FUNCTION_NAMES, parse, referencedBindings } from './expr.ts';
import {
  type BranchStep,
  RATER_LIMITS,
  type RaterDefinition,
  type RaterStep,
} from './schema.ts';

export interface ValidationIssue {
  stepId?: string;
  message: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

// Names a step id may not take: the inputs scope, expression keywords, and
// function names (a binding named `round` would shadow the function).
const RESERVED = new Set([
  'inputs',
  'true',
  'false',
  'null',
  'not',
  'and',
  'or',
  ...FUNCTION_NAMES,
]);

interface WalkState {
  // Bindings assigned on EVERY path reaching the current position.
  definite: Set<string>;
  // Bindings assigned on SOME path (referencing these is a warning).
  maybe: Set<string>;
  // Whether the path definitely produces a result by this position: an output
  // step, or an unconditional decision (a terminal that always fires).
  producesResult: boolean;
}

export const validateRaterDefinition = (
  definition: RaterDefinition,
): ValidationResult => {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const inputNames = new Set<string>();
  for (const input of definition.inputs) {
    if (inputNames.has(input.name)) {
      errors.push({ message: `duplicate input '${input.name}'` });
    }
    inputNames.add(input.name);
  }

  let totalSteps = 0;
  let fetchSteps = 0;
  const warnedUnreachable = new Set<string>();

  // Parse an expression and check its references against the current scope.
  const checkExpr = (
    stepId: string,
    what: string,
    src: string,
    state: WalkState,
  ): void => {
    let node;
    try {
      node = parse(src);
    } catch (e) {
      const msg = e instanceof ExprError ? e.message : String(e);
      errors.push({ stepId, message: `${what}: ${msg}` });
      return;
    }
    for (const ref of referencedBindings(node)) {
      if (ref.startsWith('inputs.')) {
        const name = ref.slice('inputs.'.length);
        if (!inputNames.has(name)) {
          errors.push({ stepId, message: `${what}: unknown input '${name}'` });
        }
        continue;
      }
      if (ref === 'inputs') continue; // bare `inputs` object reference
      if (state.definite.has(ref)) continue;
      if (state.maybe.has(ref)) {
        warnings.push({
          stepId,
          message: `${what}: '${ref}' is only set on some branch paths — running a path that skips it will fail`,
        });
        continue;
      }
      errors.push({
        stepId,
        message: `${what}: unknown name '${ref}' (bindings are steps declared earlier)`,
      });
    }
  };

  // Extract {{expr}} segments from an http url template.
  const urlExprs = (url: string): string[] => {
    const out: string[] = [];
    const re = /\{\{(.*?)\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(url)) !== null) out.push(m[1]);
    return out;
  };

  const checkStepExprs = (step: RaterStep, state: WalkState): void => {
    switch (step.type) {
      case 'calc':
      case 'output':
        checkExpr(step.id, 'expression', step.expr, state);
        break;
      case 'lookup':
        for (const [i, m] of step.match.entries()) {
          checkExpr(step.id, `match ${i + 1} value`, m.value, state);
        }
        break;
      case 'fetch':
        if (step.source === 'db') {
          for (const f of step.filters) {
            checkExpr(step.id, `filter on '${f.column}'`, f.value, state);
          }
        } else {
          for (const [i, src] of urlExprs(step.url).entries()) {
            checkExpr(step.id, `url segment ${i + 1}`, src, state);
          }
          for (const [key, src] of Object.entries(step.query ?? {})) {
            checkExpr(step.id, `query '${key}'`, src, state);
          }
        }
        break;
      case 'decision':
        if (step.when !== undefined) checkExpr(step.id, 'condition', step.when, state);
        if (step.reason !== undefined) checkExpr(step.id, 'reason', step.reason, state);
        break;
      case 'branch':
        // `when` guards checked in walkSteps (per-case).
        break;
    }
  };

  // Walk a step list, threading definite/maybe scope. Returns the state after
  // the list. `pathIds` = ids already used on this execution path.
  const walkSteps = (
    steps: RaterStep[],
    state: WalkState,
    pathIds: Set<string>,
    depth: number,
  ): WalkState => {
    let current = state;
    let terminatedAt: string | null = null; // id of an unconditional decision seen in THIS list

    for (const step of steps) {
      totalSteps += 1;

      if (terminatedAt && !warnedUnreachable.has(terminatedAt)) {
        warnedUnreachable.add(terminatedAt);
        warnings.push({
          stepId: step.id,
          message: `steps after decision '${terminatedAt}' are unreachable — it always halts the run`,
        });
      }

      if (RESERVED.has(step.id)) {
        errors.push({ stepId: step.id, message: `'${step.id}' is a reserved name` });
      }
      if (pathIds.has(step.id)) {
        errors.push({
          stepId: step.id,
          message: `duplicate step id '${step.id}' on the same execution path`,
        });
      }
      pathIds.add(step.id);

      if (step.type === 'fetch') fetchSteps += 1;

      if (step.type === 'branch') {
        if (depth >= RATER_LIMITS.maxBranchDepth) {
          errors.push({
            stepId: step.id,
            message: `branches nest deeper than ${RATER_LIMITS.maxBranchDepth} levels`,
          });
        }

        const branch = step as BranchStep;
        const caseStates: WalkState[] = [];
        for (const [i, c] of branch.cases.entries()) {
          checkExpr(step.id, `case ${i + 1} ('${c.label}') condition`, c.when, current);
          caseStates.push(
            walkSteps(
              c.steps,
              {
                definite: new Set(current.definite),
                maybe: new Set(current.maybe),
                producesResult: current.producesResult,
              },
              new Set(pathIds),
              depth + 1,
            ),
          );
        }
        // The else path — implicit no-op when absent.
        caseStates.push(
          branch.else
            ? walkSteps(
                branch.else,
                {
                  definite: new Set(current.definite),
                  maybe: new Set(current.maybe),
                  producesResult: current.producesResult,
                },
                new Set(pathIds),
                depth + 1,
              )
            : { ...current, definite: new Set(current.definite), maybe: new Set(current.maybe) },
        );

        // definite = assigned on every path; maybe = assigned on any path.
        const definite = new Set(
          [...caseStates[0].definite].filter((name) =>
            caseStates.every((s) => s.definite.has(name)),
          ),
        );
        const maybe = new Set(current.maybe);
        for (const s of caseStates) {
          for (const name of s.definite) if (!definite.has(name)) maybe.add(name);
          for (const name of s.maybe) if (!definite.has(name)) maybe.add(name);
        }
        current = {
          definite,
          maybe,
          producesResult: caseStates.every((s) => s.producesResult),
        };
        continue;
      }

      checkStepExprs(step, current);

      if (step.type === 'decision') {
        // An unconditional decision (no `when`) always fires → it both produces
        // a result and terminates this list. It does NOT bind a value.
        if (step.when === undefined) {
          current = { ...current, producesResult: true };
          terminatedAt = step.id;
        }
        continue;
      }

      current.definite.add(step.id);
      if (step.type === 'output') {
        current = { ...current, producesResult: true };
      }
    }

    return current;
  };

  const final = walkSteps(
    definition.steps,
    { definite: new Set(), maybe: new Set(), producesResult: false },
    new Set(),
    0,
  );

  if (definition.steps.length > 0 && !final.producesResult) {
    errors.push({
      message:
        'every path must end in an output or a terminal decision (add an output, an unconditional decision, or move one out of the branch)',
    });
  }

  if (totalSteps > RATER_LIMITS.maxSteps) {
    errors.push({ message: `too many steps (${totalSteps} > ${RATER_LIMITS.maxSteps})` });
  }
  if (fetchSteps > RATER_LIMITS.maxFetchSteps) {
    errors.push({ message: `too many fetch steps (${fetchSteps} > ${RATER_LIMITS.maxFetchSteps})` });
  }

  return { errors, warnings };
};
