'use client';

import { useState, useMemo } from 'react';
import { loadState, saveState, addCustomer } from '@/lib/storage';
import { demoCustomers } from '@/lib/demo-data';
import type { Customer, CustomerStatus, CustomerSource } from '@/lib/types';
import { norm } from '@/lib/search';
import CustomerCard from '@/components/customers/CustomerCard';
import CustomerForm from '@/components/customers/CustomerForm';
import { STATUS_LABELS } from '@/components/customers/CustomerStatusBadge';
import { SOURCE_LABELS } from '@/components/customers/CustomerCard';

function initCustomers(): Customer[] {
  if (typeof window === 'undefined') return [];
  const state = loadState();
  if (state.customers === undefined) {
    saveState({ customers: demoCustomers });
    return demoCustomers;
  }
  return state.customers;
}

const selCls =
  'rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-700 outline-none focus:border-indigo-400';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>(initCustomers);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | ''>('');
  const [sourceFilter, setSourceFilter] = useState<CustomerSource | ''>('');
  const [showForm, setShowForm] = useState(false);

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
          norm(c.notes).includes(q) ||
          norm(c.needsSummary).includes(q);
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

  function handleCreate(customer: Customer) {
    addCustomer(customer);
    setCustomers((prev) => [...prev, customer]);
    setShowForm(false);
  }

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
          onClick={() => setShowForm((v) => !v)}
          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
            showForm
              ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {showForm ? 'Ακύρωση' : '+ Νέος πελάτης'}
        </button>
      </div>

      {/* New customer form */}
      {showForm && (
        <div className="mb-5">
          <CustomerForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Search + filters */}
      <div className="mb-4 space-y-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Αναζήτηση ονόματος, εταιρείας, τηλεφώνου, email, σημειώσεων..."
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
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-zinc-500">Δεν έχεις πελάτες ακόμα.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Πρόσθεσε έναν πελάτη με το κουμπί παραπάνω.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
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
