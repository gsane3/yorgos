'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    href: '/dashboard',
    label: 'Αρχική',
    icon: (active: boolean) => (
      <svg
        className={`h-5 w-5 shrink-0 ${active ? 'text-indigo-600' : 'text-zinc-400'}`}
        fill="none"
        strokeWidth={1.5}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
        />
      </svg>
    ),
  },
  {
    href: '/customers',
    label: 'Πελάτες',
    icon: (active: boolean) => (
      <svg
        className={`h-5 w-5 shrink-0 ${active ? 'text-indigo-600' : 'text-zinc-400'}`}
        fill="none"
        strokeWidth={1.5}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
        />
      </svg>
    ),
  },
  {
    href: '/tasks',
    label: 'Tasks',
    icon: (active: boolean) => (
      <svg
        className={`h-5 w-5 shrink-0 ${active ? 'text-indigo-600' : 'text-zinc-400'}`}
        fill="none"
        strokeWidth={1.5}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    ),
  },
  {
    href: '/offers',
    label: 'Προσφορές',
    icon: (active: boolean) => (
      <svg
        className={`h-5 w-5 shrink-0 ${active ? 'text-indigo-600' : 'text-zinc-400'}`}
        fill="none"
        strokeWidth={1.5}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
        />
      </svg>
    ),
  },
];

export default function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 z-40 w-60 border-r border-zinc-200 bg-white">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 border-b border-zinc-100 px-5">
        <span className="text-lg font-bold text-zinc-900">yorgos.ai</span>
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
          demo
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                  }`}
                >
                  {item.icon(active)}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-100 px-4 py-3">
        <p className="text-xs text-zinc-400">Τοπική αποθήκευση · MVP</p>
      </div>
    </aside>
  );
}
