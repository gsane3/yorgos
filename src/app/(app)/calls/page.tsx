'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { norm } from '@/lib/search';
import type { Customer } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'recent' | 'customers' | 'sms';

const TABS: { id: Tab; label: string }[] = [
  { id: 'recent', label: 'Πρόσφατες' },
  { id: 'customers', label: 'Πελάτες' },
  { id: 'sms', label: 'SMS' },
];

const CALL_DIRECTION_LABEL: Record<string, string> = {
  inbound: 'Εισερχόμενη',
  outbound: 'Εξερχόμενη',
};

// Backend communication shape from /api/communications.
interface BackendCallCustomer {
  id: string;
  crmNumber: string | null;
  name: string | null;
  companyName: string | null;
  phone: string | null;
  source: string | null;
  status: string | null;
}

interface BackendCall {
  id: string;
  customerId: string | null;
  channel: string;
  direction: string;
  status: string;
  phone: string | null;
  summary: string | null;
  createdAt: string;
  customer: BackendCallCustomer | null;
}

interface SmsTemplate {
  key: string;
  label: string;
  text: string;
}

const SMS_TEMPLATES: SmsTemplate[] = [
  {
    key: 'info_request',
    label: 'Ζήτηση στοιχείων',
    text: 'Καλησπέρα, για να προχωρήσουμε παρακαλώ στείλτε ονοματεπώνυμο, εταιρεία αν υπάρχει, email, διεύθυνση και λίγα λόγια για αυτό που χρειάζεστε.',
  },
  {
    key: 'follow_up',
    label: 'Follow-up μετά από κλήση',
    text: 'Καλησπέρα, σας ευχαριστώ για την επικοινωνία. Ετοιμάζω την προσφορά και θα σας ενημερώσω σύντομα.',
  },
  {
    key: 'reminder',
    label: 'Υπενθύμιση',
    text: 'Καλησπέρα, θέλω να σας υπενθυμίσω ότι αναμένω τα στοιχεία σας για να προχωρήσουμε. Παραμένω στη διάθεσή σας.',
  },
  {
    key: 'offer',
    label: 'Αποστολή προσφοράς',
    text: 'Καλησπέρα, σας αποστέλλω την προσφορά μας. Για οποιαδήποτε διευκρίνιση είμαι στη διάθεσή σας.',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('el-GR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

// Map backend customer API response to the local Customer type.
function mapCustomer(d: Record<string, unknown>): Customer {
  const now = new Date().toISOString();
  return {
    id: d.id as string,
    name:
      (d.name as string | null) ??
      (d.companyName as string | null) ??
      (d.crmNumber as string | null) ??
      'Πελάτης',
    companyName: (d.companyName as string | null) ?? '',
    phone: (d.phone as string | null) ?? '',
    email: (d.email as string | null) ?? '',
    address: (d.address as string | null) ?? '',
    source: (d.source as Customer['source']) ?? 'manual_entry',
    status: (d.status as Customer['status']) ?? 'new_lead',
    preferredContactMethod:
      (d.preferredContactMethod as Customer['preferredContactMethod']) ?? 'phone',
    needsSummary: (d.needsSummary as string | null) ?? '',
    notes: (d.notes as string | null) ?? '',
    createdAt: (d.createdAt as string) ?? now,
    updatedAt: (d.updatedAt as string) ?? now,
    crmNumber: (d.crmNumber as string | null) ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Icon helpers
// ---------------------------------------------------------------------------

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'h-5 w-5'} fill="none" strokeWidth={1.5} stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Recent Tab
// ---------------------------------------------------------------------------

function RecentTab({
  calls,
  onSwitchToSms,
}: {
  calls: BackendCall[];
  onSwitchToSms: () => void;
}) {
  const sorted = [...calls].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);

  if (sorted.length === 0) {
    return (
      <div className="rounded-[28px] bg-white px-5 py-10 text-center shadow-sm ring-1 ring-zinc-200/60">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
          <PhoneIcon className="h-6 w-6 text-indigo-400" />
        </div>
        <p className="text-sm font-medium text-zinc-700">Δεν υπάρχουν κλήσεις ακόμα.</p>
        <p className="mt-1.5 text-sm text-zinc-400">
          Όταν συνδεθεί το τηλεφωνικό σύστημα, οι κλήσεις θα εμφανίζονται εδώ με σύντομο brief.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {sorted.map((call) => {
        const linkedCustomer = call.customer;
        const displayName =
          linkedCustomer?.name ??
          linkedCustomer?.companyName ??
          (call.phone ? `****${call.phone.slice(-4)}` : null) ??
          'Αγνωστος';
        const isMissed = call.status === 'missed';
        const isUnknown = !linkedCustomer?.name && !linkedCustomer?.companyName;
        const initial = displayName.charAt(0).toUpperCase();
        return (
          <li key={call.id} className="rounded-[28px] bg-white px-5 py-4 shadow-sm ring-1 ring-zinc-200/60">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
                {isUnknown ? (
                  <PhoneIcon className="h-4 w-4 text-indigo-500" />
                ) : (
                  initial
                )}
              </div>
              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-semibold leading-snug text-zinc-900 truncate">
                    {displayName}
                  </p>
                  <span className="shrink-0 text-[10px] text-zinc-400 whitespace-nowrap">{fmtDate(call.createdAt)}</span>
                </div>
                {linkedCustomer?.companyName && linkedCustomer.companyName !== displayName && (
                  <p className="text-xs text-zinc-400 truncate">{linkedCustomer.companyName}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-zinc-500">
                    {CALL_DIRECTION_LABEL[call.direction] ?? call.direction}
                  </span>
                  {isMissed && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                      Αναπάντητη
                    </span>
                  )}
                  {call.summary && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600 ring-1 ring-indigo-100">
                      Σύνοψη
                    </span>
                  )}
                </div>
                {call.summary && (
                  <p className="mt-1.5 text-xs text-zinc-500 line-clamp-2">{call.summary}</p>
                )}
                {/* Quick actions */}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {call.customerId && (
                    <Link
                      href={`/customers/${call.customerId}`}
                      className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
                    >
                      Άνοιγμα πελάτη
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={onSwitchToSms}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
                  >
                    SMS
                  </button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Customers Tab
// ---------------------------------------------------------------------------

function CustomersTab({
  customers,
  onSwitchToSms,
}: {
  customers: Customer[];
  onSwitchToSms: (customer: Customer) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? customers.filter((c) => {
        const q = norm(search.trim());
        return (
          norm(c.name).includes(q) ||
          norm(c.companyName ?? '').includes(q) ||
          norm(c.phone ?? '').includes(q) ||
          norm(c.email ?? '').includes(q)
        );
      })
    : customers;

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex items-center gap-3 rounded-[28px] bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-200/60">
        <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" strokeWidth={1.5} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Αναζήτηση ονόματος, τηλεφώνου, email..."
          className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[28px] bg-white px-5 py-8 text-center shadow-sm ring-1 ring-zinc-200/60">
          <p className="text-sm text-zinc-500">
            {search.trim() ? 'Δεν βρέθηκαν αποτελέσματα.' : 'Δεν υπάρχουν πελάτες ακόμα.'}
          </p>
          {!search.trim() && (
            <Link href="/customers" className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700">
              Πήγαινε στους Πελάτες
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.slice(0, 20).map((c) => {
            const initial = c.name.charAt(0).toUpperCase();
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-[28px] bg-white px-5 py-4 shadow-sm ring-1 ring-zinc-200/60">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-zinc-900 truncate">{c.name}</p>
                  <p className="text-xs text-zinc-400 truncate">
                    {[c.companyName, c.phone].filter(Boolean).join(' · ') || 'Χωρίς στοιχεία'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSwitchToSms(c)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 transition hover:bg-indigo-100"
                    title="SMS"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" strokeWidth={1.5} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                    </svg>
                  </button>
                  <Link
                    href={`/customers/${c.id}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200 transition hover:bg-zinc-100"
                    title="Άνοιγμα"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" strokeWidth={2} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SMS Tab
// ---------------------------------------------------------------------------

function SmsTab({ preselectedCustomer, customers }: { preselectedCustomer: Customer | null; customers: Customer[] }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomer?.id ?? '');
  const [templateKey, setTemplateKey] = useState(SMS_TEMPLATES[0].key);
  const [customText, setCustomText] = useState('');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const template = SMS_TEMPLATES.find((t) => t.key === templateKey) ?? SMS_TEMPLATES[0];
  const smsText = customText || template.text;
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? preselectedCustomer;

  function handleCopy() {
    navigator.clipboard.writeText(smsText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }).catch(() => {
      if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    });
  }

  function pickTemplate(key: string) {
    setTemplateKey(key);
    setCustomText('');
  }

  return (
    <div className="space-y-4">
      {/* Disclaimer */}
      <div className="rounded-[28px] bg-zinc-50 px-5 py-4 ring-1 ring-zinc-200/60">
        <p className="text-sm text-zinc-500">
          Το μήνυμα αντιγράφεται για να το στείλεις εσύ χειροκίνητα.
        </p>
      </div>

      {/* Customer picker */}
      {customers.length > 0 && (
        <div className="rounded-[28px] bg-white px-5 py-4 shadow-sm ring-1 ring-zinc-200/60 space-y-2">
          <label className="block text-xs font-medium text-zinc-500">
            Πελάτης (προαιρετικό)
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition"
          >
            <option value=""> Χωρίς πελάτη </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
            ))}
          </select>
          {selectedCustomer?.phone && (
            <p className="text-xs text-zinc-400">Προς: {selectedCustomer.phone}</p>
          )}
        </div>
      )}

      {/* Template picker */}
      <div className="rounded-[28px] bg-white px-5 py-4 shadow-sm ring-1 ring-zinc-200/60 space-y-3">
        <p className="text-xs font-medium text-zinc-500">Πρότυπο</p>
        <div className="grid grid-cols-2 gap-2">
          {SMS_TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => pickTemplate(t.key)}
              className={`rounded-2xl px-3 py-2.5 text-left text-xs font-medium transition ${
                templateKey === t.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-50 text-zinc-700 ring-1 ring-zinc-200 hover:ring-indigo-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message preview / edit */}
      <div className="rounded-[28px] bg-white px-5 py-4 shadow-sm ring-1 ring-zinc-200/60 space-y-2">
        <label className="block text-xs font-medium text-zinc-500">
          Μήνυμα
        </label>
        <textarea
          ref={textareaRef}
          rows={5}
          value={customText || template.text}
          onChange={(e) => setCustomText(e.target.value)}
          className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none resize-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition"
        />
        {customText && (
          <button type="button" onClick={() => setCustomText('')}
            className="text-xs text-zinc-400 hover:text-zinc-600 transition">
            Επαναφορά προτύπου
          </button>
        )}
      </div>

      {/* Copy button */}
      <button
        type="button"
        onClick={handleCopy}
        className={`flex w-full items-center justify-center gap-2 rounded-[28px] py-3.5 text-sm font-semibold transition ${
          copied
            ? 'bg-green-600 text-white'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800'
        }`}
      >
        {copied ? (
          <>
            <svg className="h-4 w-4" fill="none" strokeWidth={2.5} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            Αντιγράφηκε
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" strokeWidth={1.5} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
            </svg>
            Αντιγραφή SMS
          </>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Numpad Panel (bottom sheet)
// ---------------------------------------------------------------------------

const DIAL_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

function NumpadPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [dialNumber, setDialNumber] = useState('');

  function closePanel() {
    setDialNumber('');
    onClose();
  }

  function press(key: string) {
    setDialNumber((n) => (n.length < 20 ? n + key : n));
  }

  function backspace() {
    setDialNumber((n) => n.slice(0, -1));
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        aria-hidden="true"
        onClick={closePanel}
      />
      {/* Panel */}
      <div className="fixed inset-x-0 bottom-0 z-50">
        <div className="mx-auto max-w-md rounded-t-[28px] bg-white px-5 pt-4 pb-8 shadow-2xl ring-1 ring-zinc-200/60">
          {/* Drag handle */}
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-200" />
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-bold text-zinc-900">Πληκτρολόγιο</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Πληκτρολόγησε αριθμό για αναζήτηση ή μελλοντική κλήση.
              </p>
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200"
              aria-label="Κλείσιμο"
            >
              <svg className="h-4 w-4" fill="none" strokeWidth={2} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Number display */}
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200">
            <span className="flex-1 text-center text-2xl font-light tracking-widest text-zinc-900 min-h-[2rem]">
              {dialNumber || (
                <span className="text-base font-normal text-zinc-400">Αριθμός ή αναζήτηση</span>
              )}
            </span>
            {dialNumber && (
              <button
                type="button"
                onClick={backspace}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-200"
                aria-label="Διαγραφή"
              >
                <svg className="h-4 w-4" fill="none" strokeWidth={2} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12 12 14.25m-2.58 4.92-6.374-6.375a1.125 1.125 0 0 1 0-1.59L9.42 4.83c.21-.211.497-.33.795-.33H19.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25h-9.284c-.298 0-.585-.119-.795-.33Z" />
                </svg>
              </button>
            )}
          </div>
          {/* Search hint */}
          {dialNumber && (
            <p className="mb-3 text-center text-xs text-zinc-400">
              Θα χρησιμοποιηθεί για αναζήτηση πελάτη ή κλήση όταν συνδεθεί.
            </p>
          )}
          {/* Key grid */}
          <div className="mb-4 grid grid-cols-3 gap-2">
            {DIAL_KEYS.flat().map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                className="flex h-14 items-center justify-center rounded-2xl bg-zinc-50 text-xl font-medium text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-100 active:bg-zinc-200"
              >
                {key}
              </button>
            ))}
          </div>
          {/* Actions */}
          <div className="flex gap-2">
            {dialNumber && (
              <button
                type="button"
                onClick={() => setDialNumber('')}
                className="flex-1 rounded-[28px] border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
              >
                Καθαρισμός
              </button>
            )}
            <button
              type="button"
              onClick={closePanel}
              className="flex-1 rounded-[28px] bg-zinc-100 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-200"
            >
              Κλείσιμο
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CallsPage() {
  const [hydrated, setHydrated] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('recent');
  const [calls, setCalls] = useState<BackendCall[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [smsPreselect, setSmsPreselect] = useState<Customer | null>(null);
  const [numpadOpen, setNumpadOpen] = useState(false);
  const tokenRef = useRef<string | null>(null);

  const loadData = useCallback(async (token: string) => {
    const headers: HeadersInit = { Authorization: `Bearer ${token}` };
    try {
      const [commsResp, customersResp] = await Promise.all([
        fetch('/api/communications?channel=call&limit=100', { headers }),
        fetch('/api/customers?limit=100', { headers }),
      ]);

      if (!commsResp.ok || !customersResp.ok) {
        setActionError('Αποτυχία φόρτωσης. Δοκίμασε ξανά.');
        setHydrated(true);
        return;
      }

      const [commsData, customersData] = await Promise.all([
        commsResp.json(),
        customersResp.json(),
      ]);

      const rawComms: BackendCall[] = Array.isArray(commsData)
        ? commsData
        : (commsData.communications ?? []);

      const rawCustomers: Record<string, unknown>[] = Array.isArray(customersData)
        ? customersData
        : (customersData.customers ?? []);

      setCalls(rawComms);
      setCustomers(rawCustomers.map(mapCustomer));
      setHydrated(true);
    } catch {
      setActionError('Αποτυχία φόρτωσης. Δοκίμασε ξανά.');
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const supabase = createBrowserSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setAuthRequired(true);
          setHydrated(true);
          return;
        }
        tokenRef.current = session.access_token;
        await loadData(session.access_token);
      } catch {
        setActionError('Αποτυχία σύνδεσης. Δοκίμασε ξανά.');
        setHydrated(true);
      }
    }
    init();
  }, [loadData]);

  function switchToSms(customer?: Customer) {
    if (customer) setSmsPreselect(customer);
    setTab('sms');
  }

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-md px-5 pt-6 pb-28">
        <div className="rounded-[28px] bg-white px-5 py-10 text-center shadow-sm ring-1 ring-zinc-200/60">
          <p className="text-sm text-zinc-400">Φόρτωση...</p>
        </div>
      </div>
    );
  }

  const latestCall = calls.length > 0
    ? [...calls].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    : null;

  const missedCount = calls.filter((c) => c.status === 'missed').length;

  return (
    <div className="mx-auto max-w-md space-y-5 px-5 pt-6 pb-28">

      {/* Error banner */}
      {actionError && (
        <div className="rounded-[28px] bg-red-50 px-5 py-3.5 ring-1 ring-red-200">
          <p className="text-sm text-red-700">{actionError}</p>
        </div>
      )}

      {/* Auth required notice */}
      {authRequired && (
        <div className="rounded-[28px] bg-amber-50 px-5 py-4 ring-1 ring-amber-200">
          <p className="text-sm text-amber-700">
            Συνδέσου για να φορτωθούν οι κλήσεις και οι πελάτες.
          </p>
          <Link
            href="/login/backend"
            className="mt-2 inline-block rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
          >
            Σύνδεση
          </Link>
        </div>
      )}

      {/* Header */}
      <div>
        <p className="text-xs font-medium text-zinc-400">Κλήσεις</p>
        <h1 className="mt-0.5 text-2xl font-bold text-zinc-900">Οι κλήσεις σου</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Κάθε κλήση οργανώνεται αφού την ελέγξεις.
        </p>
      </div>

      {/* Latest call card */}
      {latestCall ? (
        <div className="rounded-[28px] bg-white px-5 py-4 shadow-sm ring-1 ring-zinc-200/60">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50">
              <PhoneIcon className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-zinc-500">Τελευταία κλήση</p>
                {missedCount > 0 && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                    {missedCount} {missedCount === 1 ? 'αναπάντητη' : 'αναπάντητες'}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-base font-semibold text-zinc-900">
                {latestCall.customer?.name ??
                  latestCall.customer?.companyName ??
                  (latestCall.phone ? `****${latestCall.phone.slice(-4)}` : 'Αγνωστος')}
              </p>
              <p className="text-xs text-zinc-400">{fmtDate(latestCall.createdAt)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[28px] bg-white px-5 py-4 shadow-sm ring-1 ring-zinc-200/60">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50">
              <PhoneIcon className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-700">Δεν υπάρχουν κλήσεις ακόμα.</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Όταν συνδεθεί το τηλεφωνικό σύστημα, οι κλήσεις θα εμφανίζονται εδώ με σύντομο brief.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Segmented tabs */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-zinc-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl py-2 text-xs font-semibold transition ${
              tab === t.id
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'recent' && (
        <RecentTab
          calls={calls}
          onSwitchToSms={() => switchToSms()}
        />
      )}

      {tab === 'customers' && (
        <CustomersTab
          customers={customers}
          onSwitchToSms={(c) => switchToSms(c)}
        />
      )}

      {tab === 'sms' && (
        <SmsTab
          preselectedCustomer={smsPreselect}
          customers={customers}
        />
      )}

      {/* Floating numpad launcher */}
      <button
        type="button"
        onClick={() => setNumpadOpen(true)}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg ring-1 ring-indigo-500/20 transition hover:bg-indigo-700 active:bg-indigo-800 md:bottom-8 md:right-8"
        aria-label="Άνοιγμα πληκτρολογίου"
      >
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <circle cx="4" cy="4" r="1.75" />
          <circle cx="10" cy="4" r="1.75" />
          <circle cx="16" cy="4" r="1.75" />
          <circle cx="4" cy="10" r="1.75" />
          <circle cx="10" cy="10" r="1.75" />
          <circle cx="16" cy="10" r="1.75" />
          <circle cx="4" cy="16" r="1.75" />
          <circle cx="10" cy="16" r="1.75" />
          <circle cx="16" cy="16" r="1.75" />
        </svg>
      </button>

      {/* Numpad bottom sheet */}
      <NumpadPanel open={numpadOpen} onClose={() => setNumpadOpen(false)} />

    </div>
  );
}
