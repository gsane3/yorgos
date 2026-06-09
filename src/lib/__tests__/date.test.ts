import { describe, it, expect } from 'vitest';
import { formatDateGr, formatDateTimeGr } from '../date';

describe('formatDateGr — DD-MM-YYYY', () => {
  it('formats a date-only string (YYYY-MM-DD)', () => {
    expect(formatDateGr('2026-06-09')).toBe('09-06-2026');
    expect(formatDateGr('2026-12-25')).toBe('25-12-2026');
  });

  it('zero-pads day and month', () => {
    expect(formatDateGr('2026-01-02')).toBe('02-01-2026');
    expect(formatDateGr('2026-09-05')).toBe('05-09-2026');
  });

  it('formats a local (non-Z) ISO timestamp by its date part', () => {
    expect(formatDateGr('2026-03-05T10:00:00')).toBe('05-03-2026');
  });

  it('returns empty string for null / undefined / empty', () => {
    expect(formatDateGr(null)).toBe('');
    expect(formatDateGr(undefined)).toBe('');
    expect(formatDateGr('')).toBe('');
  });

  it('returns empty string for an invalid date', () => {
    expect(formatDateGr('not-a-date')).toBe('');
    expect(formatDateGr('2026-13-40')).toBe('');
  });
});

describe('formatDateTimeGr — DD-MM-YYYY HH:MM', () => {
  it('appends zero-padded hours and minutes', () => {
    expect(formatDateTimeGr('2026-03-05T10:00:00')).toBe('05-03-2026 10:00');
    expect(formatDateTimeGr('2026-03-05T09:05:00')).toBe('05-03-2026 09:05');
  });

  it('returns empty string for null / undefined / empty', () => {
    expect(formatDateTimeGr(null)).toBe('');
    expect(formatDateTimeGr(undefined)).toBe('');
    expect(formatDateTimeGr('')).toBe('');
  });

  it('returns empty string for an invalid date', () => {
    expect(formatDateTimeGr('nope')).toBe('');
  });
});
