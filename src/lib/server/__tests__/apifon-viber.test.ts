import { describe, it, expect } from 'vitest';
import { normalizeApifonMsisdn } from '../apifon-viber';

describe('normalizeApifonMsisdn', () => {
  it('returns null for null / empty / non-numeric input', () => {
    expect(normalizeApifonMsisdn(null)).toBeNull();
    expect(normalizeApifonMsisdn('')).toBeNull();
    expect(normalizeApifonMsisdn('abc')).toBeNull();
  });

  it('prepends 30 for a 10-digit Greek mobile (starts with 6)', () => {
    expect(normalizeApifonMsisdn('6912345678')).toBe('306912345678');
  });

  it('prepends 30 for a 10-digit Greek landline (starts with 2)', () => {
    expect(normalizeApifonMsisdn('2101234567')).toBe('302101234567');
  });

  it('keeps an already-prefixed 30… number', () => {
    expect(normalizeApifonMsisdn('306912345678')).toBe('306912345678');
  });

  it('strips spaces/plus and keeps the 30 country code', () => {
    expect(normalizeApifonMsisdn('+30 691 234 5678')).toBe('306912345678');
  });

  it('rejects a too-short number', () => {
    expect(normalizeApifonMsisdn('69123')).toBeNull();
  });

  it('documents that a leading-zero 0030 form is rejected (not E.164-normalized)', () => {
    // The regex requires the first digit to be 1-9, so a 00-prefixed string fails.
    expect(normalizeApifonMsisdn('00306912345678')).toBeNull();
  });
});
