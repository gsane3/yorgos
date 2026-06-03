'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    async function run() {
      try {
        const supabase = createBrowserSupabaseClient();
        const params = new URLSearchParams(window.location.search);

        if (params.get('error')) {
          router.replace('/login');
          return;
        }

        const code = params.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setFailed(true);
            setTimeout(() => router.replace('/login'), 1800);
            return;
          }
        }
        // AppShell handles onboarding/activation gating from here.
        router.replace('/dashboard');
      } catch {
        setFailed(true);
        setTimeout(() => router.replace('/login'), 1800);
      }
    }
    run();
  }, [router]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#F5F5F7] px-6 text-center">
      {failed ? (
        <p className="text-sm text-zinc-500">Δεν ολοκληρώθηκε η σύνδεση. Επιστροφή στη σύνδεση…</p>
      ) : (
        <>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-indigo-500" />
          <p className="text-sm text-zinc-500">Ολοκληρώνουμε τη σύνδεση…</p>
        </>
      )}
    </div>
  );
}
