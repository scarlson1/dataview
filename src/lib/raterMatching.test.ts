import { describe, expect, it } from 'vitest';
import type { MatchCondition, RecordMapping } from '#/types/raters';
import { evaluateCondition, recordMatchesBinding } from './raterMatching';

const cond = (
  column: string,
  op: MatchCondition['op'],
  value: string,
): MatchCondition => ({ column, op, value });

describe('evaluateCondition', () => {
  it('eq/neq on text (case-sensitive)', () => {
    const row = { lob: 'Cyber' };
    expect(evaluateCondition(cond('lob', 'eq', 'Cyber'), row)).toBe(true);
    expect(evaluateCondition(cond('lob', 'eq', 'cyber'), row)).toBe(false);
    expect(evaluateCondition(cond('lob', 'neq', 'Property'), row)).toBe(true);
    expect(evaluateCondition(cond('lob', 'neq', 'Cyber'), row)).toBe(false);
  });

  it('eq on number coerces both sides', () => {
    const row = { carrier_id: 42 };
    expect(evaluateCondition(cond('carrier_id', 'eq', '42'), row, 'number')).toBe(true);
    expect(evaluateCondition(cond('carrier_id', 'eq', '7'), row, 'number')).toBe(false);
  });

  it('eq on bool', () => {
    expect(evaluateCondition(cond('active', 'eq', 'true'), { active: true }, 'bool')).toBe(true);
    expect(evaluateCondition(cond('active', 'eq', 'true'), { active: false }, 'bool')).toBe(false);
  });

  it('numeric comparisons', () => {
    const row = { premium: 5000 };
    expect(evaluateCondition(cond('premium', 'gt', '1000'), row, 'number')).toBe(true);
    expect(evaluateCondition(cond('premium', 'gte', '5000'), row, 'number')).toBe(true);
    expect(evaluateCondition(cond('premium', 'lt', '5000'), row, 'number')).toBe(false);
    expect(evaluateCondition(cond('premium', 'lte', '5000'), row, 'number')).toBe(true);
  });

  it('lexical comparison for non-numeric columns (ISO dates)', () => {
    const row = { eff: '2026-07-01' };
    expect(evaluateCondition(cond('eff', 'gte', '2026-01-01'), row)).toBe(true);
    expect(evaluateCondition(cond('eff', 'lt', '2026-01-01'), row)).toBe(false);
  });

  it('like vs ilike and wildcards', () => {
    const row = { name: 'Acme Cyber Co' };
    expect(evaluateCondition(cond('name', 'like', '%Cyber%'), row)).toBe(true);
    expect(evaluateCondition(cond('name', 'like', '%cyber%'), row)).toBe(false);
    expect(evaluateCondition(cond('name', 'ilike', '%cyber%'), row)).toBe(true);
    expect(evaluateCondition(cond('name', 'ilike', 'acme%'), row)).toBe(true);
    expect(evaluateCondition(cond('name', 'ilike', 'cyber'), row)).toBe(false);
  });

  it('in list, text and numeric', () => {
    expect(evaluateCondition(cond('lob', 'in', 'Cyber, Property'), { lob: 'Property' })).toBe(true);
    expect(evaluateCondition(cond('lob', 'in', 'Cyber, Property'), { lob: 'GL' })).toBe(false);
    expect(evaluateCondition(cond('id', 'in', '1, 2, 3'), { id: 2 }, 'number')).toBe(true);
  });

  it('is null / true / false', () => {
    expect(evaluateCondition(cond('carrier_id', 'is', 'null'), { carrier_id: null })).toBe(true);
    expect(evaluateCondition(cond('carrier_id', 'is', 'null'), { carrier_id: 5 })).toBe(false);
    expect(evaluateCondition(cond('flag', 'is', 'true'), { flag: true })).toBe(true);
    expect(evaluateCondition(cond('flag', 'is', 'false'), { flag: false })).toBe(true);
  });

  it('null/undefined row values do not match value comparisons', () => {
    expect(evaluateCondition(cond('lob', 'eq', 'Cyber'), { lob: null })).toBe(false);
    expect(evaluateCondition(cond('lob', 'ilike', '%x%'), {})).toBe(false);
    expect(evaluateCondition(cond('lob', 'in', 'a,b'), { lob: null })).toBe(false);
  });
});

describe('recordMatchesBinding', () => {
  const binding = (
    conditions?: MatchCondition[],
  ): RecordMapping => ({ table: 'new_business_submissions', conditions });

  it('null binding never matches', () => {
    expect(recordMatchesBinding(null, { id: 1 })).toBe(false);
  });

  it('no conditions matches every row', () => {
    expect(recordMatchesBinding(binding(), { line_of_business: 'Cyber' })).toBe(true);
    expect(recordMatchesBinding(binding([]), { line_of_business: 'Cyber' })).toBe(true);
  });

  it('conditions AND together', () => {
    const b = binding([
      cond('line_of_business', 'eq', 'Cyber'),
      cond('stage', 'eq', 'quoted'),
    ]);
    expect(recordMatchesBinding(b, { line_of_business: 'Cyber', stage: 'quoted' })).toBe(true);
    expect(recordMatchesBinding(b, { line_of_business: 'Cyber', stage: 'bound' })).toBe(false);
    expect(recordMatchesBinding(b, { line_of_business: 'Property', stage: 'quoted' })).toBe(false);
  });
});
