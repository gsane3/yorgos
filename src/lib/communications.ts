// Communication action abstraction.
// Native links now; future cloud version can switch to provider_stub or real provider mode.

export type CommunicationChannel = 'call' | 'sms' | 'viber' | 'whatsapp';
export type CommunicationMode = 'native_link' | 'provider_stub';

export function getCommunicationMode(): CommunicationMode {
  return 'native_link';
}

export function buildCallHref(phone: string): string {
  return `tel:${phone}`;
}

export function buildSmsHref(phone: string, message?: string): string {
  if (message) return `sms:${phone}?body=${encodeURIComponent(message)}`;
  return `sms:${phone}`;
}

export function buildProviderActionLabel(channel: CommunicationChannel): string {
  const labels: Record<CommunicationChannel, string> = {
    call: 'Κλήση',
    sms: 'SMS',
    viber: 'Viber',
    whatsapp: 'WhatsApp',
  };
  return labels[channel];
}
