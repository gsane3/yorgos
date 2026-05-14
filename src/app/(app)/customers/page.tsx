'use client';

import { useState, useMemo } from 'react';
import { loadState, saveState, addCustomer } from '@/lib/storage';
import { demoCustomers } from '@/lib/demo-data';
import type { Customer } from '@/lib/types';
import CustomerCard from '@/components/customers/CustomerCard';
import CustomerForm from '@/components/customers/CustomerForm';

function initCustomers(): Customer[] {
  if (typeof window === 'undefined') return [];
  const state = loadState();
  if (state.customers === undefined) {
    saveState({ customers: demoCustomers });
    return demoCustomers;
  }
  return state.customers;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>(initCustomers);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase().trim();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [customers, search]);

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

      {/* Search */}
      <div className="mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Αναζήτηση με όνομα, τηλέφωνο, email..."
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
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
            Δοκίμασε όνομα, τηλέφωνο ή email.
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
