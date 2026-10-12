// Resolve shared lookup-table references into inline lookup steps.
//
// A `lookup` step with source: 'ref' points at a rater_lookup_tables row by id.
// Before a definition can execute, each such step is replaced with an inline
// step carrying the resolved columns + rows — so the interpreter only ever sees
// inline grids, and the materialized definition (snapshotted into rater_runs)
// stays reproducible even after the shared table is later edited.
//
// Runtime-agnostic: the actual table load is injected via `resolve`, so the
// edge function supplies a user-scoped DB read (RLS gates access) and tests
// supply a stub.

import {
  type LookupTableContent,
  lookupTableContentSchema,
  type RaterDefinition,
  type RaterStep,
} from './schema.ts';

// Returns the table's content, or null if it doesn't exist / isn't accessible
// to the caller.
export type LookupTableResolver = (
  tableId: string,
) => Promise<LookupTableContent | null>;

export interface MaterializeResult {
  definition: RaterDefinition;
  errors: { stepId: string; message: string }[];
}

// Collect every referenced table id across the step tree (branches included).
const collectRefIds = (steps: RaterStep[], out: Set<string>): void => {
  for (const step of steps) {
    if (step.type === 'lookup' && step.source === 'ref') {
      out.add(step.tableId);
    } else if (step.type === 'branch') {
      for (const c of step.cases) collectRefIds(c.steps, out);
      if (step.else) collectRefIds(step.else, out);
    }
  }
};

export const materializeLookupTables = async (
  definition: RaterDefinition,
  resolve: LookupTableResolver,
): Promise<MaterializeResult> => {
  const refIds = new Set<string>();
  collectRefIds(definition.steps, refIds);

  const errors: MaterializeResult['errors'] = [];

  // No shared tables in play — return the definition untouched.
  if (refIds.size === 0) return { definition, errors };

  // Resolve each unique id once. A parse of the stored content re-checks its
  // shape defensively (a corrupted row must fail closed, not run).
  const resolved = new Map<string, LookupTableContent | null>();
  await Promise.all(
    [...refIds].map(async (id) => {
      const raw = await resolve(id);
      if (raw === null) {
        resolved.set(id, null);
        return;
      }
      const parsed = lookupTableContentSchema.safeParse(raw);
      resolved.set(id, parsed.success ? parsed.data : null);
    }),
  );

  const transform = (steps: RaterStep[]): RaterStep[] =>
    steps.map((step) => {
      if (step.type === 'branch') {
        return {
          ...step,
          cases: step.cases.map((c) => ({ ...c, steps: transform(c.steps) })),
          ...(step.else ? { else: transform(step.else) } : {}),
        };
      }
      if (step.type !== 'lookup' || step.source !== 'ref') return step;

      const content = resolved.get(step.tableId);
      if (!content) {
        errors.push({
          stepId: step.id,
          message: `lookup '${step.id}' references a lookup table that doesn't exist or isn't accessible`,
        });
        return step;
      }

      // Match + output columns must exist in the resolved table (the inline
      // schema enforces this statically; ref steps can only be checked here).
      const colNames = new Set(content.columns.map((c) => c.name));
      for (const m of step.match) {
        const refs = m.mode === 'exact' ? [m.column] : [m.minColumn, m.maxColumn];
        for (const name of refs) {
          if (!colNames.has(name)) {
            errors.push({
              stepId: step.id,
              message: `lookup '${step.id}' match references column '${name}', which the referenced table doesn't have`,
            });
          }
        }
      }
      if (step.outputColumn && !colNames.has(step.outputColumn)) {
        errors.push({
          stepId: step.id,
          message: `lookup '${step.id}' outputColumn references column '${step.outputColumn}', which the referenced table doesn't have`,
        });
      }

      return {
        id: step.id,
        ...(step.label !== undefined ? { label: step.label } : {}),
        type: 'lookup',
        source: 'inline',
        columns: content.columns,
        rows: content.rows,
        match: step.match,
        onMiss: step.onMiss,
        ...(step.defaultRow !== undefined ? { defaultRow: step.defaultRow } : {}),
        ...(step.outputColumn !== undefined ? { outputColumn: step.outputColumn } : {}),
      };
    });

  const nextSteps = transform(definition.steps);
  return { definition: { ...definition, steps: nextSteps }, errors };
};
