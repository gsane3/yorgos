'use client';

// Κλήσεις — top customer search (redesign P2/Κλήσεις spec: a centered search bar
// to find a customer). Self-contained: loads the customer list once, filters it
// in-memory (accent-insensitive on name + phone), and links each hit straight to
// that customer's Messenger chat. Collapses to just the input when the query is
// empty.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

interface CustomerLite { id: string; name: string | null; mobilePhone: string | null; phone: string | null; landlinePhone: string | null }

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function CallsCustomerSearch() {
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch('/api/customers?limit=500', { headers: { Authorization: `Bearer ${session.access_token}` } });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && json?.ok && Array.isArray(json.customers)) setCustomers(json.customers as CustomerLite[]);
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const results = useMemo(() => {
    const term = fold(q.trim());
    if (!term) return [];
    return customers
      .filter((c) => {
        const hay = fold(`${c.name ?? ''} ${c.mobilePhone ?? ''} ${c.phone ?? ''} ${c.landlinePhone ?? ''}`);
        return hay.includes(term);
      })
      .slice(0, 8);
  }, [q, customers]);

  return (
    <div>
      <div className="relative">
        <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" fill="none" strokeWidth={1.7} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="search"
          inputMode="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Αναζήτηση πελάτη…"
          className="w-full rounded-full border border-zinc-200 bg-white py-3 pl-11 pr-4 text-sm text-zinc-900 shadow-sm outline-none focus:border-indigo-400"
        />
      </div>

      {q.trim() && (
        <div className="mt-2 overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-zinc-200/60">
          {results.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-zinc-400">Κανένας πελάτης.</p>
          ) : (
            results.map((c) => {
              const phone = c.mobilePhone || c.phone || c.landlinePhone;
              return (
                <Link key={c.id} href={`/customers/${c.id}/chat`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-zinc-50 active:bg-zinc-100">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                    {(c.name ?? 'Π').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-900">{c.name ?? 'Πελάτης'}</span>
                    {phone && <span className="block truncate text-xs text-zinc-500">{phone}</span>}
                  </span>
                  <svg className="h-4 w-4 shrink-0 text-zinc-300" fill="none" strokeWidth={2} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
