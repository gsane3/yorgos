'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadState } from '@/lib/storage';
import BottomNav from './BottomNav';
import DesktopSidebar from './DesktopSidebar';
import FloatingActionMenu from './FloatingActionMenu';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const state = loadState();
    if (!state.userProfile) {
      router.replace('/login');
    } else if (!state.userProfile.onboardingCompleted) {
      router.replace('/onboarding');
    }
  }, [router]);

  return (
    <div className="flex min-h-full">
      <DesktopSidebar />
      <div className="flex flex-1 flex-col md:pl-60">
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <BottomNav />
      </div>
      <FloatingActionMenu />
    </div>
  );
}
