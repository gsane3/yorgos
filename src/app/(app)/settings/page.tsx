'use client';

import { useState, useEffect } from 'react';
import { getBusinessProfile, saveBusinessProfile } from '@/lib/storage';
import type { BusinessProfile } from '@/lib/types';
import BusinessForm from '@/components/settings/BusinessForm';
import MockWorkspacePanel from '@/components/settings/MockWorkspacePanel';
import MockCrmPanel from '@/components/settings/MockCrmPanel';

function defaultProfile(): BusinessProfile {
  return {
    id: crypto.randomUUID(),
    businessName: '',
    businessType: 'technical_services',
    ownerName: '',
    phone: '',
    email: '',
    address: '',
    vatNumber: '',
    taxOffice: '',
    logoDataUrl: '',
    defaultVatRate: 24,
    defaultOfferTerms: '',
    defaultAcceptanceText: 'Αποδέχομαι τους παραπάνω όρους.',
    preferredContactMethod: 'viber',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function SettingsPage() {
  // Start with false so server render and first client render match.
  const [hydrated, setHydrated] = useState(false);
  // Initial profile is not rendered until hydrated — value here does not matter for DOM.
  const [profile, setProfile] = useState<BusinessProfile>(defaultProfile);
  const [saved, setSaved] = useState(false);

  // Load localStorage after mount to avoid hydration mismatch.
  // setState calls are deferred into a timer so they are not synchronous in the effect body.
  useEffect(() => {
    const stored = getBusinessProfile();
    const nextProfile = stored ?? defaultProfile();
    const timer = window.setTimeout(() => {
      setProfile(nextProfile);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function handleSave() {
    saveBusinessProfile({ ...profile, updatedAt: new Date().toISOString() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // Stable loading shell — identical on server and first client render.
  if (!hydrated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-5">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-zinc-900">Ρυθμίσεις</h1>
        </div>
        <p className="py-10 text-center text-sm text-zinc-400">Φόρτωση ρυθμίσεων...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">Ρυθμίσεις</h1>
        <p className="mt-1 text-xs text-zinc-400">
          Τα δεδομένα αποθηκεύονται τοπικά στον browser σας (MVP). Δεν αποστέλλεται τίποτα σε server.
        </p>
      </div>

      <div className="space-y-10 divide-y divide-zinc-100">
        {/* Business + Logo + Offers + Comms */}
        <div className="pt-0">
          <BusinessForm
            profile={profile}
            onChange={setProfile}
            onSave={handleSave}
            saved={saved}
          />
        </div>

        {/* Mock workspace */}
        <div className="pt-8">
          <MockWorkspacePanel />
        </div>

        {/* Mock CRM import */}
        <div className="pt-8">
          <MockCrmPanel />
        </div>
      </div>
    </div>
  );
}
