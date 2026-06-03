// Client helper to load the current business profile.
//
// localStorage-first (fast, works offline, set during onboarding/settings) with
// a Supabase fallback via /api/businesses/me so a fresh device or a new login
// still has the business context (type, VAT, terms) instead of bare defaults.

import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { loadState, saveBusinessProfile } from '@/lib/storage';
import type { BusinessProfile } from '@/lib/types';

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function strOrUndefined(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function mapDbBusiness(b: Record<string, unknown>): BusinessProfile {
  const vat = Number(b.default_vat_rate);
  return {
    id: str(b.id),
    businessName: str(b.name),
    businessType: (str(b.type) || 'other') as BusinessProfile['businessType'],
    ownerName: [str(b.owner_first_name), str(b.owner_last_name)].filter(Boolean).join(' '),
    phone: str(b.phone),
    email: str(b.email),
    address: str(b.address),
    city: strOrUndefined(b.city),
    legalName: strOrUndefined(b.legal_name),
    tradeName: strOrUndefined(b.trade_name),
    ownerFirstName: strOrUndefined(b.owner_first_name),
    ownerLastName: strOrUndefined(b.owner_last_name),
    addressLine1: strOrUndefined(b.address_line1),
    addressLine2: strOrUndefined(b.address_line2),
    postalCode: strOrUndefined(b.postal_code),
    region: strOrUndefined(b.region),
    website: strOrUndefined(b.website),
    vatNumber: str(b.vat_number),
    taxOffice: str(b.tax_office),
    logoDataUrl: str(b.logo_url),
    defaultVatRate: Number.isFinite(vat) ? vat : 24,
    defaultOfferTerms: str(b.default_offer_terms),
    defaultAcceptanceText: str(b.default_acceptance_text),
    preferredContactMethod:
      (str(b.preferred_contact_method) || 'phone') as BusinessProfile['preferredContactMethod'],
    createdAt: str(b.created_at),
    updatedAt: str(b.updated_at),
  };
}

export async function getBusinessProfile(): Promise<BusinessProfile | null> {
  // Prefer the locally-cached profile.
  const local = loadState().businessProfile ?? null;
  if (local) return local;

  // Fall back to the server (fresh device / new login).
  try {
    const supabase = createBrowserSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const res = await fetch('/api/businesses/me', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { ok?: boolean; business?: Record<string, unknown> };
    if (!data.ok || !data.business) return null;

    const profile = mapDbBusiness(data.business);
    // Cache for next time (best-effort).
    try {
      saveBusinessProfile(profile);
    } catch {
      // localStorage unavailable — non-fatal.
    }
    return profile;
  } catch {
    return null;
  }
}
