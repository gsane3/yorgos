'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import type { Customer, CustomerStatus, CustomerSource } from '@/lib/types';
import { norm } from '@/lib/search';
import CustomerCard from '@/components/customers/CustomerCard';
import { STATUS_LABELS } from '@/components/customers/CustomerStatusBadge';
import { SOURCE_LABELS } from '@/components/customers/CustomerCard';

const selCls =
  'rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-700 outline-none focus:border-indigo-400';

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface CustomerDto {
  id: string;
  crmNumber: string | null;
  name: string | null;
  companyName: string | null;
  phone: string | null;
  mobilePhone: string | null;
  landlinePhone: string | null;
  email: string | null;
  address: string | null;
  source: string | null;
  status: string;
  needsSummary: string | null;
  preferredContactMethod: string;
  intakeStatus: string;
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

const VALID_SOURCES: readonly CustomerSource[] = [
  'facebook_ads', 'google_ads', 'website_form', 'referral',
  'inbound_call', 'missed_call', 'manual_entry', 'other',
];

const VALID_STATUSES: readonly CustomerStatus[] = [
  'new_lead', 'contacted', 'follow_up_needed', 'offer_drafted',
  'offer_sent', 'won', 'lost',
];

const VALID_CONTACT_METHODS = ['viber', 'email', 'phone'] as const;

function mapIntakeStatus(
  raw: string
): 'none' | 'waiting_sms' | 'completed' {
  if (raw === 'submitted') return 'completed';
  if (raw === 'pending' || raw === 'sent' || raw === 'opened') return 'waiting_sms';
  return 'none';
}

function mapCustomer(dto: CustomerDto): Customer {
  return {
    id: dto.id,
    name: dto.name ?? dto.companyName ?? dto.crmNumber ?? 'Νέος πελάτης',
    companyName: dto.companyName ?? '',
    phone: dto.phone ?? '',
    mobilePhone: dto.mobilePhone ?? undefined,
    landlinePhone: dto.landlinePhone ?? undefined,
    email: dto.email ?? '',
    address: dto.address ?? '',
    source: VALID_SOURCES.includes(dto.source as CustomerSource)
      ? (dto.source as CustomerSource)
      : 'manual_entry',
    status: VALID_STATUSES.includes(dto.status as CustomerStatus)
      ? (dto.status as CustomerStatus)
      : 'new_lead',
    preferredContactMethod: VALID_CONTACT_METHODS.includes(
      dto.preferredContactMethod as (typeof VALID_CONTACT_METHODS)[number]
    )
      ? (dto.preferredContactMethod as 'viber' | 'email' | 'phone')
      : 'phone',
    needsSummary: dto.needsSummary ?? '',
    notes: '',
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    lastContactAt: dto.lastContactAt ?? undefined,
    crmNumber: dto.crmNumber ?? undefined,
    intakeStatus: mapIntakeStatus(dto.intakeStatus),
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

type PageMessage = 'no_session' | 'fetch_error' | null;

export default function CustomersPage() {
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<PageMessage>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | ''>('');
  const [sourceFilter, setSourceFilter] = useState<CustomerSource | ''>('');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      let supabase: ReturnType<typeof createBrowserSupabaseClient>;
      try {
        supabase = createBrowserSupabaseClient();
      } catch {
        if (!cancelled) {
          setMessage('fetch_error');
          setHydrated(true);
          setLoading(false);
        }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        if (!cancelled) {
          setMessage('no_session');
          setCustomers([]);
          setHydrated(true);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch('/api/customers?limit=100', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json() as { ok?: boolean; customers?: CustomerDto[]; error?: string };

        if (!cancelled) {
          if (json.ok && Array.isArray(json.customers)) {
            setCustomers(json.customers.map(mapCustomer));
            setMessage(null);
          } else {
            setCustomers([]);
            setMessage('fetch_error');
          }
          setHydrated(true);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setCustomers([]);
          setMessage('fetch_error');
          setHydrated(true);
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refreshTick]);

  const hasFilter = search.trim() !== '' || statusFilter !== '' || sourceFilter !== '';

  const filtered = useMemo(() => {
    const q = norm(search.trim());
    return customers.filter((c) => {
      if (q) {
        const hit =
          norm(c.name).includes(q) ||
          norm(c.companyName).includes(q) ||
          norm(c.phone).includes(q) ||
          norm(c.email).includes(q) ||
          norm(c.needsSummary).includes(q) ||
          norm(c.crmNumber ?? '').includes(q) ||
          norm(c.mobilePhone ?? '').includes(q) ||
          norm(c.landlinePhone ?? '').includes(q);
        if (!hit) return false;
      }
      if (statusFilter && c.status !== statusFilter) return false;
      if (sourceFilter && c.source !== sourceFilter) return false;
      return true;
    });
  }, [customers, search, statusFilter, sourceFilter]);

  function clearFilters() {
    setSearch('');
    setStatusFilter('');
    setSourceFilter('');
  }

  // ---------------------------------------------------------------------------
  // Loading shell (server render + first client render)
  // ---------------------------------------------------------------------------
  if (!hydrated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-zinc-900">Πελάτες</h1>
        </div>
        <div className="mb-4 space-y-2">
          <input
            type="search"
            disabled
            placeholder="Αναζήτηση ονόματος, εταιρείας, τηλεφώνου, email..."
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <select disabled className={selCls}><option>Όλα τα status</option></select>
            <select disabled className={selCls}><option>Όλες οι πηγές</option></select>
          </div>
        </div>
        <p className="py-10 text-center text-sm text-zinc-400">Φόρτωση πελατών...</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // No session
  // ---------------------------------------------------------------------------
  if (message === 'no_session') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-5">
        <h1 className="mb-4 text-lg font-semibold text-zinc-900">Πελάτες</h1>
        <div className="rounded-2xl bg-zinc-50 px-6 py-10 text-center ring-1 ring-zinc-100">
          <p className="text-sm font-medium text-zinc-600">
            Συνδέσου για να δεις τους πελάτες του CRM.
          </p>
          <Link
            href="/login/backend"
            className="mt-4 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Σύνδεση
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Fetch error
  // ---------------------------------------------------------------------------
  if (message === 'fetch_error') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-5">
        <h1 className="mb-4 text-lg font-semibold text-zinc-900">Πελάτες</h1>
        <div className="rounded-2xl bg-red-50 px-6 py-8 text-center ring-1 ring-red-100">
          <p className="text-sm font-medium text-red-700">
            Αδυναμία φόρτωσης πελατών. Έλεγξε τη σύνδεση ή ανανέωσε τη σελίδα.
          </p>
          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
          >
            Δοκίμασε ξανά
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main view
  // ---------------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-semibold text-zinc-900">Πελάτες</h1>
          {customers.length > 0 && (
            <span className="text-sm text-zinc-400">{customers.length}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setRefreshTick((t) => t + 1)}
          disabled={loading}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-500 transition hover:bg-zinc-50 disabled:opacity-50"
        >
          {loading ? 'Φόρτωση...' : 'Ανανέωση'}
        </button>
      </div>

      {/* Search + filters */}
      <div className="mb-4 space-y-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Αναζήτηση ονόματος, εταιρείας, τηλεφώνου, email..."
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CustomerStatus | '')}
            className={selCls}
          >
            <option value="">Όλα τα status</option>
            {(Object.entries(STATUS_LABELS) as [CustomerStatus, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as CustomerSource | '')}
            className={selCls}
          >
            <option value="">Όλες οι πηγές</option>
            {(Object.entries(SOURCE_LABELS) as [CustomerSource, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          {hasFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500 transition hover:bg-zinc-50"
            >
              Καθαρισμός
            </button>
          )}
        </div>
      </div>

      {/* Customer list */}
      {customers.length === 0 ? (
        <div className="rounded-2xl bg-zinc-50 px-5 py-8 text-center ring-1 ring-zinc-100">
          <p className="text-sm font-medium text-zinc-500">
            Δεν υπάρχουν ακόμα πελάτες.
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Όταν ολοκληρωθεί η πρώτη κλήση, ο νέος πελάτης θα εμφανιστεί εδώ.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-zinc-50 px-5 py-8 text-center ring-1 ring-zinc-100">
          <p className="text-sm font-medium text-zinc-500">Δεν βρέθηκαν αποτελέσματα.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Δοκίμασε διαφορετικούς όρους ή κάνε καθαρισμό φίλτρων.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((customer) => (
            <li key={customer.id}>
              <CustomerCard customer={customer} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
