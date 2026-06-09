import { describe, it, expect } from 'vitest';
import { buildMapsUrl } from '../maps';

describe('buildMapsUrl', () => {
  it('builds a Google Maps search URL with the encoded address', () => {
    expect(buildMapsUrl('Mesologiou 17')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Mesologiou%2017',
    );
  });

  it('encodes commas and Greek characters', () => {
    expect(buildMapsUrl('Οδός 5, Αθήνα')).toBe(
      'https://www.google.com/maps/search/?api=1&query=%CE%9F%CE%B4%CF%8C%CF%82%205%2C%20%CE%91%CE%B8%CE%AE%CE%BD%CE%B1',
    );
  });
});
