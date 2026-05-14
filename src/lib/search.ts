const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'gu');

export function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(DIACRITICS, '');
}
