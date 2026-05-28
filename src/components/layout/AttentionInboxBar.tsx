'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Shape returned by GET /api/notifications
interface ApiNotification {
  id: string;
  kind: 'offer' | 'appointment';
  response: string;
  title: string;
  description: string;
  customerId: string | null;
  customerName: string;
  href: string;
  respondedAt: string;
  isNew: boolean;
}

// Internal display shape
interface Notification {
  id: string;
  title: string;
  description: string;
  href: string;
  timeLabel: string;
  typeLabel: string;
  isNew: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeLabel(respondedAt: string): string {
  try {
    const diff = Date.now() - new Date(respondedAt).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 2) return 'Μόλις τώρα';
    if (minutes < 60) return `${minutes} λεπτά πριν`;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return 'Σήμερα';
    if (hours < 48) return 'Χθες';
    const d = new Date(respondedAt);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  } catch {
    return '';
  }
}

function mapApiToNotification(n: ApiNotification): Notification {
  return {
    id: n.id,
    title: n.title,
    description: n.description,
    href: n.href,
    timeLabel: formatTimeLabel(n.respondedAt),
    typeLabel: n.kind === 'offer' ? 'Προσφορά' : 'Ραντεβού',
    isNew: n.isNew,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AttentionInboxBar() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function fetchNotifications() {
      try {
        const supabase = createBrowserSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session || cancelled) {
          setLoading(false);
          return;
        }

        const res = await fetch('/api/notifications', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (cancelled) return;

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const json = (await res.json()) as {
          ok?: boolean;
          notifications?: ApiNotification[];
        };

        if (cancelled) return;

        if (json.ok && Array.isArray(json.notifications)) {
          setNotifications(json.notifications.map(mapApiToNotification));
        }
      } catch {
        // Network error: show empty state, do not crash.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchNotifications();
    return () => {
      cancelled = true;
    };
  }, []);

  function markRead(id: string) {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  // Badge counts unread (isNew && not yet clicked) items.
  const unreadCount = notifications.filter((n) => n.isNew && !readIds.has(n.id)).length;

  // Unread items first, then the rest in original (already-sorted) order.
  const sorted = [...notifications].sort((a, b) => {
    const aUnread = a.isNew && !readIds.has(a.id) ? 0 : 1;
    const bUnread = b.isNew && !readIds.has(b.id) ? 0 : 1;
    return aUnread - bUnread;
  });

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        type="button"
        title="Ειδοποιήσεις"
        aria-label="Ειδοποιήσεις"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-500 shadow-sm ring-1 ring-zinc-200/60 transition hover:bg-zinc-50 active:bg-zinc-100"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          strokeWidth={1.5}
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-12 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-zinc-900">Ειδοποιήσεις</p>
              {unreadCount > 0 && (
                <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                  {unreadCount} νέα
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Κλείσιμο"
              className="rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                strokeWidth={2}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="px-4 pb-1 pt-2 text-xs text-zinc-500">Τα νέα που χρειάζονται προσοχή.</p>

          {/* Content area */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-indigo-500" />
            </div>
          ) : sorted.length === 0 ? (
            <p className="px-4 pb-6 pt-2 text-center text-sm text-zinc-400">
              Δεν υπάρχουν νέες απαντήσεις.
            </p>
          ) : (
            <ul className="space-y-1.5 px-3 pb-3 pt-1">
              {sorted.map((n) => {
                const isUnread = n.isNew && !readIds.has(n.id);
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => {
                        markRead(n.id);
                        setOpen(false);
                      }}
                      className={`block rounded-xl px-3 py-2.5 transition ${
                        isUnread
                          ? 'bg-indigo-50 hover:bg-indigo-100'
                          : 'bg-zinc-50 hover:bg-zinc-100'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs font-semibold ${
                              isUnread ? 'text-zinc-900' : 'text-zinc-500'
                            }`}
                          >
                            {n.title}
                          </span>
                          {isUnread && (
                            <span className="shrink-0 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              Νέο
                            </span>
                          )}
                        </div>
                        <p className={`text-xs ${isUnread ? 'text-zinc-600' : 'text-zinc-400'}`}>
                          {n.description}
                        </p>
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-[10px] text-zinc-400">
                            {n.typeLabel} · {n.timeLabel}
                          </span>
                          <span className="text-[10px] font-medium text-indigo-600">Άνοιγμα</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
