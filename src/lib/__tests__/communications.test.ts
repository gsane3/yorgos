import { describe, it, expect } from 'vitest';
import {
  buildCallHref,
  buildSmsHref,
  buildEmailHref,
  buildWhatsAppHref,
  buildProviderActionLabel,
  getCommunicationMode,
} from '../communications';

describe('buildCallHref', () => {
  it('builds a tel: link', () => {
    expect(buildCallHref('6912345678')).toBe('tel:6912345678');
  });
});

describe('buildSmsHref', () => {
  it('builds an sms: link without a body', () => {
    expect(buildSmsHref('6912345678')).toBe('sms:6912345678');
  });
  it('URL-encodes the body', () => {
    expect(buildSmsHref('6912345678', 'hello world & friends')).toBe(
      'sms:6912345678?body=hello%20world%20%26%20friends',
    );
  });
});

describe('buildEmailHref', () => {
  it('builds a bare mailto:', () => {
    expect(buildEmailHref('a@b.com')).toBe('mailto:a@b.com');
  });
  it('adds subject and body, URL-encoded', () => {
    expect(buildEmailHref('a@b.com', 'Προσφορά', 'Body text')).toBe(
      'mailto:a@b.com?subject=%CE%A0%CF%81%CE%BF%CF%83%CF%86%CE%BF%CF%81%CE%AC&body=Body%20text',
    );
  });
  it('supports body only', () => {
    expect(buildEmailHref('a@b.com', undefined, 'Hi')).toBe('mailto:a@b.com?body=Hi');
  });
});

describe('buildWhatsAppHref — Greek number normalization', () => {
  it('prepends 30 for a 10-digit mobile starting with 6', () => {
    expect(buildWhatsAppHref('6912345678')).toBe('https://wa.me/306912345678');
  });
  it('prepends 30 for a 10-digit landline starting with 2', () => {
    expect(buildWhatsAppHref('2101234567')).toBe('https://wa.me/302101234567');
  });
  it('keeps a number that already carries the 30 country code', () => {
    expect(buildWhatsAppHref('+30 691 234 5678')).toBe('https://wa.me/306912345678');
  });
  it('strips a 0030 international prefix', () => {
    expect(buildWhatsAppHref('00306912345678')).toBe('https://wa.me/306912345678');
  });
  it('appends an encoded text message', () => {
    expect(buildWhatsAppHref('6912345678', 'Γεια')).toBe(
      'https://wa.me/306912345678?text=%CE%93%CE%B5%CE%B9%CE%B1',
    );
  });
});

describe('buildProviderActionLabel', () => {
  it('maps each channel to its Greek label', () => {
    expect(buildProviderActionLabel('call')).toBe('Κλήση');
    expect(buildProviderActionLabel('sms')).toBe('SMS');
    expect(buildProviderActionLabel('viber')).toBe('Viber');
    expect(buildProviderActionLabel('whatsapp')).toBe('WhatsApp');
  });
});

describe('getCommunicationMode', () => {
  it('is native_link', () => {
    expect(getCommunicationMode()).toBe('native_link');
  });
});
