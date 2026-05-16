'use client';

import { useState, useEffect, useRef } from 'react';
import { getBusinessProfile, saveBusinessProfile, exportStateJson, importStateJson, loadState, clearState } from '@/lib/storage';
import { buildDataHealthReport, type DataHealthReport } from '@/lib/data-health';
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
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [healthReport, setHealthReport] = useState<DataHealthReport | null>(null);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Load localStorage after mount to avoid hydration mismatch.
  // setState calls are deferred into a timer so they are not synchronous in the effect body.
  useEffect(() => {
    const stored = getBusinessProfile();
    const nextProfile = stored ?? defaultProfile();
    const report = buildDataHealthReport(loadState());
    const timer = window.setTimeout(() => {
      setProfile(nextProfile);
      setHealthReport(report);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function handleDownloadBackup() {
    const json = exportStateJson();
    const date = new Date().toISOString().split('T')[0];
    const filename = `yorgos-crm-backup-${date}.json`;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (
        !window.confirm(
          'Η επαναφορά θα αντικαταστήσει τα τρέχοντα δεδομένα. Συνέχεια;'
        )
      ) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      const ok = importStateJson(text);
      setRestoreStatus(ok ? 'success' : 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onerror = () => {
      setRestoreStatus('error');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  }

  function handleRecheck() {
    setHealthReport(buildDataHealthReport(loadState()));
  }

  function handleReset() {
    clearState();
    setResetConfirming(false);
    setResetDone(true);
    setHealthReport(buildDataHealthReport(loadState()));
    setTimeout(() => window.location.reload(), 1500);
  }

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

        {/* Backup & Restore */}
        <div className="pt-8 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-800">Backup δεδομένων</h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              Κατέβασε αντίγραφο ασφαλείας των τοπικών δεδομένων ή επαναφέρτε από προηγούμενο backup.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <svg className="h-4 w-4" fill="none" strokeWidth={1.5} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Λήψη backup
            </button>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
              <svg className="h-4 w-4" fill="none" strokeWidth={1.5} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              Επαναφορά backup
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                onChange={handleRestoreFile}
              />
            </label>
          </div>

          {restoreStatus === 'success' && (
            <div className="rounded-xl bg-green-50 px-4 py-3 ring-1 ring-green-200">
              <p className="text-sm font-medium text-green-700">
                Το backup επαναφέρθηκε. Κάνε refresh για να δεις τα δεδομένα.
              </p>
            </div>
          )}
          {restoreStatus === 'error' && (
            <div className="rounded-xl bg-red-50 px-4 py-3 ring-1 ring-red-200">
              <p className="text-sm font-medium text-red-700">
                Το αρχείο backup δεν είναι έγκυρο.
              </p>
            </div>
          )}
        </div>

        {/* Data health */}
        <div className="pt-8 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-800">Έλεγχος τοπικών δεδομένων</h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                Ο έλεγχος γίνεται μόνο τοπικά στον browser. Δεν στέλνονται δεδομένα εκτός συσκευής.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRecheck}
              className="shrink-0 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
            >
              Επανέλεγχος
            </button>
          </div>

          {healthReport && (
            <div className="rounded-2xl bg-white ring-1 ring-zinc-100 shadow-sm overflow-hidden">
              {/* Status banner */}
              <div className={`px-4 py-3 ${healthReport.healthy ? 'bg-green-50' : 'bg-amber-50'}`}>
                <p className={`text-sm font-semibold ${healthReport.healthy ? 'text-green-700' : 'text-amber-900'}`}>
                  {healthReport.healthy
                    ? 'Όλα φαίνονται σωστά'
                    : `Βρέθηκαν ${healthReport.issues.length} θέματα στα τοπικά δεδομένα`}
                </p>
              </div>

              {/* Counts */}
              <div className="grid grid-cols-2 gap-px bg-zinc-100 sm:grid-cols-5">
                {[
                  { label: 'Πελάτες', value: healthReport.counts.customers },
                  { label: 'Tasks', value: healthReport.counts.tasks },
                  { label: 'Προσφορές', value: healthReport.counts.offers },
                  { label: 'Κλήσεις', value: healthReport.counts.calls },
                  { label: 'Επικοινωνίες', value: healthReport.counts.communications },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white px-4 py-3 text-center">
                    <p className="text-lg font-bold text-zinc-900">{value}</p>
                    <p className="text-xs text-zinc-400">{label}</p>
                  </div>
                ))}
              </div>

              {/* Issues list */}
              {healthReport.issues.length > 0 && (
                <div className="border-t border-zinc-100 px-4 py-3 space-y-1.5">
                  <p className="text-xs font-semibold text-zinc-500 mb-2">Λεπτομέρειες</p>
                  <ul className="space-y-1">
                    {healthReport.issues.slice(0, 20).map((issue, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-zinc-600">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                        <span>
                          <span className="font-medium text-zinc-700">{issue.entity}:</span>{' '}
                          {issue.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {healthReport.issues.length > 20 && (
                    <p className="text-xs text-zinc-400">
                      +{healthReport.issues.length - 20} ακόμα
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        {/* Data reset */}
        <div className="pt-8 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-800">Καθαρισμός τοπικών δεδομένων</h2>
            <div className="mt-2 space-y-1 text-xs text-zinc-500">
              <p>Τα δεδομένα είναι αποθηκευμένα μόνο σε αυτόν τον browser.</p>
              <p>
                Πριν τα διαγράψεις, μπορείς να κατεβάσεις backup από την ενότητα{' '}
                <span className="font-medium text-zinc-700">Backup δεδομένων</span> παραπάνω.
              </p>
              <p className="font-medium text-zinc-700">
                Η διαγραφή δεν μπορεί να αναιρεθεί από το app αν δεν έχεις backup.
              </p>
            </div>
          </div>

          {resetDone ? (
            <div className="rounded-xl bg-green-50 px-4 py-3 ring-1 ring-green-200">
              <p className="text-sm font-medium text-green-700">
                Τα δεδομένα διαγράφηκαν. Η σελίδα θα ανανεωθεί...
              </p>
            </div>
          ) : resetConfirming ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-red-900">Επιβεβαίωση διαγραφής</p>
              <p className="text-xs text-red-700">
                Η ενέργεια αυτή θα αφαιρέσει όλα τα τοπικά δεδομένα CRM από αυτόν τον browser.
                Πελάτες, tasks, προσφορές, κλήσεις και επικοινωνίες θα διαγραφούν χωρίς δυνατότητα
                ανάκτησης εκτός αν έχεις αποθηκευμένο backup.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setResetConfirming(false)}
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Ακύρωση
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Ναι, διαγραφή δεδομένων
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setResetConfirming(true)}
              className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              Διαγραφή τοπικών δεδομένων
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
