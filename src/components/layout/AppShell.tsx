'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { loadState } from '@/lib/storage';
import BottomNav from './BottomNav';
import DesktopSidebar from './DesktopSidebar';
import FloatingActionMenu from './FloatingActionMenu';

// FAB only on top-level list pages
const FAB_PATHS = new Set(['/dashboard', '/customers', '/tasks', '/offers']);

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

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
        {/* pb-24 ensures content clears bottom nav + FAB on mobile */}
        <main className="flex-1 pb-24 md:pb-6">{children}</main>
        <BottomNav />
      </div>
      {FAB_PATHS.has(pathname) && <FloatingActionMenu />}
    </div>
  );
}
