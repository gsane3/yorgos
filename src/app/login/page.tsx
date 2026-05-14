'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadState, saveState } from '@/lib/storage';
import type { UserProfile } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const state = loadState();
    if (state.userProfile?.onboardingCompleted) {
      router.replace('/dashboard');
    } else if (state.userProfile) {
      router.replace('/onboarding');
    }
  }, [router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Συμπλήρωσε όνομα και email για να συνεχίσεις.');
      return;
    }
    const userProfile: UserProfile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim(),
      createdAt: new Date().toISOString(),
      onboardingCompleted: false,
    };
    saveState({ userProfile });
    router.push('/onboarding');
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-zinc-900">yorgos.ai</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Μίλα. Το app οργανώνει τα υπόλοιπα.
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
        <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Demo MVP — Δεν απαιτείται πραγματικός λογαριασμός.
        </div>

        <h2 className="mb-5 text-base font-semibold text-zinc-900">Καλώς ήρθες</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Ονοματεπώνυμο
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="π.χ. Γιώργος Παπαδόπουλος"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="π.χ. info@example.gr"
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              autoComplete="email"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            className="mt-1 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 active:bg-indigo-800"
          >
            Συνέχεια
          </button>
        </form>
      </div>

      <p className="mt-6 max-w-xs text-center text-xs text-zinc-400">
        Τα δεδομένα αποθηκεύονται τοπικά στον browser.
        <br />
        Η τελική νομική συμμόρφωση πρέπει να ελεγχθεί πριν από παραγωγική χρήση.
      </p>
    </div>
  );
}
