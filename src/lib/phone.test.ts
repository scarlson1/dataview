import { describe, expect, it } from 'vitest';
import { isValidPhone, toE164 } from './phone';

describe('isValidPhone', () => {
  it('accepts E.164 numbers from any country', () => {
    expect(isValidPhone('+14155551234')).toBe(true); // US
    expect(isValidPhone('+442071838750')).toBe(true); // GB
  });

  it('accepts legacy raw US digits (defaults to US region)', () => {
    expect(isValidPhone('4155551234')).toBe(true);
  });

  it('accepts previously-formatted US values', () => {
    expect(isValidPhone('(415) 555-1234')).toBe(true);
  });

  it('rejects empty and invalid values', () => {
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone('123')).toBe(false);
  });
});

describe('toE164', () => {
  it('normalizes raw US digits to E.164', () => {
    expect(toE164('4155551234')).toBe('+14155551234');
  });

  it('normalizes formatted US values to E.164', () => {
    expect(toE164('(415) 555-1234')).toBe('+14155551234');
  });

  it('leaves E.164 values unchanged', () => {
    expect(toE164('+442071838750')).toBe('+442071838750');
  });

  it('honors a non-US default country for bare numbers', () => {
    expect(toE164('02071838750', 'GB')).toBe('+442071838750');
  });

  it('returns empty string for empty input', () => {
    expect(toE164('')).toBe('');
  });
});
