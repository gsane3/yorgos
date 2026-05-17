'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { loadState } from '@/lib/storage';
import type { Task, Offer } from '@/lib/types';

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('el-GR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getResponseStatus(note: string): {
  label: string;
  cls: string;
} {
  if (note.includes('Αποδοχή ραντεβού από πελάτη:')) {
    return { label: 'Αποδεκτό', cls: 'bg-green-100 text-green-700' };
  }
  if (note.includes('Αδυναμία παρουσίας πελάτη:')) {
    return { label: 'Αδυναμία', cls: 'bg-amber-100 text-amber-700' };
  }
  if (note.includes('Πρόταση αλλαγής από πελάτη:')) {
    return { label: 'Εναλλακτική', cls: 'bg-indigo-100 text-indigo-700' };
  }
  return { label: 'Αναμονή απάντησης', cls: 'bg-zinc-100 text-zinc-500' };
}

type GroupKey = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later';
const GROUP_LABELS: Record<GroupKey, string> = {
  overdue: 'Εκπρόθεσμα',
  today: 'Σήμερα',
  tomorrow: 'Αύριο',
  week: 'Επόμενες 7 μέρες',
  later: 'Αργότερα',
};
const GROUP_ORDER: GroupKey[] = ['overdue', 'today', 'tomorrow', 'week', 'later'];

function getGroupKey(dueDate: string, todayStr: string, tomorrowStr: string, weekStr: string): GroupKey {
  if (dueDate < todayStr) return 'overdue';
  if (dueDate === todayStr) return 'today';
  if (dueDate === tomorrowStr) return 'tomorrow';
  if (dueDate <= weekStr) return 'week';
  return 'later';
}

export default function AppointmentsPage() {
  const [hydrated, setHydrated] = useState(false);
  const [appointments, setAppointments] = useState<Task[]>([]);
  const [customerMap, setCustomerMap] = useState<Record<string, string>>({});
  const [offerMap, setOfferMap] = useState<Record<string, Offer>>({});

  useEffect(() => {
    const state = loadState();
    const tasks = (state.tasks ?? [])
      .filter((t) => t.type === 'book_appointment' && t.status === 'open')
      .sort((a, b) => {
        if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        const at = a.dueTime ?? 'zz';
        const bt = b.dueTime ?? 'zz';
        return at.localeCompare(bt);
      });
    const cMap: Record<string, string> = Object.fromEntries(
      (state.customers ?? []).map((c) => [c.id, c.name])
    );
    const oMap: Record<string, Offer> = Object.fromEntries(
      (state.offers ?? []).map((o) => [o.id, o])
    );
    const timer = window.setTimeout(() => {
      setAppointments(tasks);
      setCustomerMap(cMap);
      setOfferMap(oMap);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-sm text-zinc-400">Φόρτωση ραντεβού...</p>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const week = new Date();
  week.setDate(week.getDate() + 7);
  const weekStr = week.toISOString().split('T')[0];

  const groups: Record<GroupKey, Task[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    week: [],
    later: [],
  };
  for (const t of appointments) {
    groups[getGroupKey(t.dueDate, todayStr, tomorrowStr, weekStr)].push(t);
  }

  const hasAny = appointments.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Ραντεβού</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Πρόγραμμα ραντεβού από αποδεκτές προσφορές.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl bg-amber-50 px-4 py-2.5 ring-1 ring-amber-200">
        <p className="text-xs text-amber-700">
          Τοπικό πρόγραμμα CRM. Τα ραντεβού αποθηκεύονται μόνο σε αυτόν τον browser και δεν έχει συνδεθεί εξωτερικό ημερολόγιο.
        </p>
      </div>

      {/* Empty state */}
      {!hasAny && (
        <div className="rounded-2xl bg-zinc-50 px-5 py-10 text-center ring-1 ring-zinc-100">
          <p className="text-sm font-medium text-zinc-600">Δεν υπάρχουν ραντεβού ακόμα.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Ορίσε ραντεβού από μια αποδεκτή προσφορά.
          </p>
          <Link
            href="/offers"
            className="mt-4 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Προσφορές →
          </Link>
        </div>
      )}

      {/* Grouped agenda */}
      {hasAny && GROUP_ORDER.map((key) => {
        const group = groups[key];
        if (group.length === 0) return null;
        return (
          <section key={key} className="space-y-2">
            <h2
              className={`text-xs font-semibold uppercase tracking-wide ${
                key === 'overdue' ? 'text-red-600' : 'text-zinc-500'
              }`}
            >
              {GROUP_LABELS[key]}
            </h2>
            <ul className="space-y-2">
              {group.map((task) => {
                const customerName = task.customerId ? customerMap[task.customerId] : undefined;
                const offer = task.offerId ? offerMap[task.offerId] : undefined;
                const primaryHref = task.customerId
                  ? `/customers/${task.customerId}`
                  : `/tasks?taskId=${task.id}`;
                const status = getResponseStatus(task.note);

                return (
                  <li
                    key={task.id}
                    className={`rounded-2xl ring-1 ${key === 'overdue' ? 'bg-red-50 ring-red-200' : 'bg-white ring-zinc-100 shadow-sm'}`}
                  >
                    <Link
                      href={primaryHref}
                      className="flex min-w-0 flex-1 flex-col gap-1 p-4"
                    >
                      {/* Date + time row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`text-xs font-semibold ${key === 'overdue' ? 'text-red-700' : 'text-indigo-700'}`}>
                          {formatDate(task.dueDate)}
                          {task.dueTime && (
                            <span className="ml-1.5 font-normal text-zinc-500">
                              {task.dueTime}
                            </span>
                          )}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.cls}`}>
                          {status.label}
                        </span>
                      </div>

                      {/* Title */}
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {task.title}
                      </p>

                      {/* Customer + offer */}
                      {(customerName || offer) && (
                        <p className="text-xs text-zinc-500 truncate">
                          {customerName && <span>{customerName}</span>}
                          {customerName && offer && <span className="mx-1">·</span>}
                          {offer && <span>{offer.offerNumber}</span>}
                        </p>
                      )}
                    </Link>

                    {/* Secondary links */}
                    <div className="flex flex-wrap gap-2 border-t border-zinc-100 px-4 py-2">
                      <Link
                        href={`/tasks?taskId=${task.id}`}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition"
                      >
                        Άνοιγμα task →
                      </Link>
                      {offer && (
                        <Link
                          href={`/offers/${task.offerId}`}
                          className="text-xs font-medium text-zinc-500 hover:text-zinc-700 transition"
                        >
                          Προσφορά →
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
