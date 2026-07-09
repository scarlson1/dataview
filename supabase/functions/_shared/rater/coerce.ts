// Validate + coerce caller-provided input values against a rater's declared
// inputs. Port of coerceParamValues (reportParams.ts) — same rules: absent
// value (undefined/null/'') → literal default when set, NULL when optional,
// missing_input failure when required.

import type { RaterInput } from './schema.ts';

export type InputScalar = string | number | boolean | null;

export interface CoerceSuccess {
  ok: true;
  values: Record<string, InputScalar>;
}

export interface CoerceFailure {
  ok: false;
  code: 'missing_input' | 'invalid_input';
  message: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const coerceOne = (input: RaterInput, raw: unknown): InputScalar | Error => {
  switch (input.type) {
    case 'date': {
      if (typeof raw === 'string' && DATE_RE.test(raw)) return raw;
      return new Error(`'${input.name}' must be a YYYY-MM-DD date`);
    }
    case 'number': {
      const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
      if (typeof n === 'number' && Number.isFinite(n)) return n;
      return new Error(`'${input.name}' must be a number`);
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return new Error(`'${input.name}' must be a boolean`);
    }
    case 'select': {
      const value = String(raw);
      if (input.options?.some((o) => o.value === value)) return value;
      return new Error(
        `'${input.name}' must be one of: ${input.options?.map((o) => o.value).join(', ')}`,
      );
    }
    case 'entity': {
      const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
      if (typeof n === 'number' && Number.isInteger(n) && n > 0) return n;
      return new Error(`'${input.name}' must be a row id (positive integer)`);
    }
    case 'text': {
      if (typeof raw === 'string') return raw;
      return new Error(`'${input.name}' must be a string`);
    }
  }
};

export const coerceInputValues = (
  config: RaterInput[],
  provided: Record<string, unknown>,
): CoerceSuccess | CoerceFailure => {
  const values: Record<string, InputScalar> = {};

  for (const input of config) {
    let raw: unknown = provided[input.name];
    if (raw === undefined || raw === null || raw === '') {
      raw = input.default ?? null;
    }
    if (raw === null) {
      if (input.required) {
        return {
          ok: false,
          code: 'missing_input',
          message: `Missing required input '${input.name}' (${input.label})`,
        };
      }
      values[input.name] = null;
      continue;
    }

    const coerced = coerceOne(input, raw);
    if (coerced instanceof Error) {
      return { ok: false, code: 'invalid_input', message: coerced.message };
    }
    values[input.name] = coerced;
  }

  return { ok: true, values };
};
