'use client';

import { useState, useEffect } from 'react';
import { loadState, updateCustomer } from '@/lib/storage';
import type { Customer } from '@/lib/types';

interface Props {
  customerId: string;
}

export default function CustomerIntakeClient({ customerId }: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [needsSummary, setNeedsSummary] = useState('');

  useEffect(() => {
    const state = loadState();
    const found = (state.customers ?? []).find((c) => c.id === customerId) ?? null;
    const timer = window.setTimeout(() => {
      setCustomer(found);
      if (found) {
        setName(found.name ?? '');
        setPhone(found.phone ?? '');
        setEmail(found.email ?? '');
        setAddress(found.address ?? '');
        setNeedsSummary(found.needsSummary ?? '');
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [customerId]);

  function handleSubmit() {
    if (!customer || !name.trim()) return;
    const now = new Date().toISOString();
    const updated: Customer = {
      ...customer,
      name: name.trim(),
      phone: phone.trim() || customer.phone,
      email: email.trim(),
      address: address.trim(),
      needsSummary: needsSummary.trim(),
      updatedAt: now,
      intakeStatus: 'completed',
    };
    updateCustomer(updated);
    setSubmitted(true);
  }

  const inputCls =
    'w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-400">Φόρτωση...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center">
        <p className="text-base font-medium text-zinc-600">Δεν βρέθηκαν στοιχεία πελάτη.</p>
        <p className="max-w-xs text-sm text-zinc-400">
          Ο σύνδεσμος λειτουργεί μόνο στον browser όπου δημιουργήθηκε το demo CRM.
        </p>
        <div className="rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
          <p className="text-xs text-amber-700">
            Demo τοπικής αποθήκευσης. Τα στοιχεία αποθηκεύονται μόνο στον browser όπου δημιουργήθηκε ο σύνδεσμος. Δεν γίνεται ταυτοποίηση ή αποστολή σε server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-8">
      <div className="mx-auto max-w-lg space-y-5 px-4">

        {/* Disclaimer */}
        <div className="rounded-xl bg-amber-50 px-4 py-2.5 ring-1 ring-amber-200 text-center">
          <p className="text-xs font-medium text-amber-700">
            Demo τοπικής αποθήκευσης. Τα στοιχεία αποθηκεύονται μόνο στον browser όπου δημιουργήθηκε ο σύνδεσμος. Δεν γίνεται ταυτοποίηση ή αποστολή σε server.
          </p>
        </div>

        {/* Main card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100 space-y-5">
          {submitted ? (
            <div className="text-center space-y-2 py-2">
              <p className="text-lg font-bold text-green-700">Τα στοιχεία σας καταχωρήθηκαν.</p>
              <p className="text-sm text-zinc-500">
                Σας ευχαριστούμε. Η επιχείρηση θα επικοινωνήσει μαζί σας αν χρειαστεί κάτι επιπλέον.
              </p>
              <p className="text-xs text-zinc-400">Μπορείτε να κλείσετε αυτό το παράθυρο.</p>
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-xl font-bold text-zinc-900">Συμπλήρωση στοιχείων</h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Συμπληρώστε ή διορθώστε τα στοιχεία σας για να ενημερωθεί το CRM της επιχείρησης.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Ονοματεπώνυμο
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Τηλέφωνο
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Διεύθυνση / Περιοχή
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Τι χρειάζεστε / Περιγραφή εργασίας
                  </label>
                  <textarea
                    rows={4}
                    value={needsSummary}
                    onChange={(e) => setNeedsSummary(e.target.value)}
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!name.trim()}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                Αποθήκευση στοιχείων
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-zinc-400">yorgos.ai MVP, τοπική αποθήκευση μόνο</p>
      </div>
    </div>
  );
}
