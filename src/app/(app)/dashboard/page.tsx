'use client';

import { useState } from 'react';
import { loadState } from '@/lib/storage';
import { getEffectiveStatus } from '@/lib/types';
import type { Customer, Task, Offer, CallRecord } from '@/lib/types';
import QuickAssistantInput from '@/components/dashboard/QuickAssistantInput';
import MissedCallsSection from '@/components/dashboard/MissedCallsSection';
import LeadsSection from '@/components/dashboard/LeadsSection';
import TodayTasksSection from '@/components/dashboard/TodayTasksSection';
import OpenOffersSection from '@/components/dashboard/OpenOffersSection';
import RecentCallsSection from '@/components/dashboard/RecentCallsSection';

const LEAD_STATUSES = new Set<string>([
  'new_lead',
  'follow_up_needed',
  'offer_drafted',
  'offer_sent',
]);
const OPEN_OFFER_STATUSES = new Set<string>(['draft', 'ready_to_send', 'sent_manually']);

const PRIORITY_ORDER: Record<string, number> = { high: 0, normal: 1, low: 2 };

interface DashboardData {
  customers: Customer[];
  tasks: Task[];
  offers: Offer[];
  calls: CallRecord[] | undefined;
}

function initDashboard(): DashboardData {
  if (typeof window === 'undefined') {
    return { customers: [], tasks: [], offers: [], calls: undefined };
  }
  const state = loadState();
  return {
    customers: state.customers ?? [],
    tasks: state.tasks ?? [],
    offers: state.offers ?? [],
    calls: state.calls, // undefined = never created a call record
  };
}

export default function DashboardPage() {
  const [{ customers, tasks, offers, calls }] = useState(initDashboard);

  const leads = customers
    .filter((c) => LEAD_STATUSES.has(c.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const urgentTasks = tasks
    .filter((t) => {
      const eff = getEffectiveStatus(t);
      return eff === 'due_today' || eff === 'overdue';
    })
    .sort((a, b) => {
      const ea = getEffectiveStatus(a);
      const eb = getEffectiveStatus(b);
      if (ea === 'overdue' && eb !== 'overdue') return -1;
      if (eb === 'overdue' && ea !== 'overdue') return 1;
      return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
    });

  const openOffers = offers.filter((o) => OPEN_OFFER_STATUSES.has(o.status));

  const customerMap: Record<string, string> = Object.fromEntries(
    customers.map((c) => [c.id, c.name])
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-5">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">
          Καλημέρα. Τι πρέπει να γίνει σήμερα;
        </h1>
      </div>

      <QuickAssistantInput />

      <MissedCallsSection callRecords={calls} customerMap={customerMap} />
      <LeadsSection leads={leads} />
      <TodayTasksSection tasks={urgentTasks} customerMap={customerMap} />
      <OpenOffersSection offers={openOffers} customerMap={customerMap} />
      <RecentCallsSection callRecords={calls} customerMap={customerMap} />
    </div>
  );
}
