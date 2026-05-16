'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { loadState, updateTask, updateOffer, addTask, updateCustomer, deleteCustomer, saveCustomers, advanceSmsIntakeStatuses, addCommunicationRecord } from '@/lib/storage';
import { getSmsPhone } from '@/lib/phone';
import { getEffectiveStatus } from '@/lib/types';
import type { Customer, Task, Offer, CallRecord, TaskBaseStatus, CommunicationRecord } from '@/lib/types';
import QuickAssistantInput from '@/components/dashboard/QuickAssistantInput';
import NextActionsSection from '@/components/dashboard/NextActionsSection';
import SmsIntakeNotificationBar from '@/components/dashboard/SmsIntakeNotificationBar';
import DataQualityWidget from '@/components/dashboard/DataQualityWidget';
import DemoStepBanner from '@/components/common/DemoStepBanner';
import GuidedDemoBanner from '@/components/common/GuidedDemoBanner';
import DashboardSmartCards from '@/components/dashboard/DashboardSmartCards';

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
  communications: CommunicationRecord[];
}

export default function DashboardPage() {
  // Start empty so server render and first client render match.
  const [hydrated, setHydrated] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    customers: [],
    tasks: [],
    offers: [],
    calls: undefined,
    communications: [],
  });

  // Undo state for dashboard task completion â€” must be declared before any conditional return.
  const [lastCompletedTask, setLastCompletedTask] = useState<Task | null>(null);

  // Auto-clear the undo banner after 8 seconds.
  useEffect(() => {
    if (!lastCompletedTask) return;
    const timer = setTimeout(() => setLastCompletedTask(null), 8000);
    return () => clearTimeout(timer);
  }, [lastCompletedTask]);

  // Load localStorage after mount to avoid hydration mismatch.
  // setState calls are deferred into a timer so they are not synchronous in the effect body.
  useEffect(() => {
    const state = loadState();
    const rawCustomers = state.customers ?? [];
    const advanced = advanceSmsIntakeStatuses(rawCustomers);
    const anyChanged = advanced.some((c, i) => c.intakeStatus !== rawCustomers[i]?.intakeStatus);
    if (anyChanged) saveCustomers(advanced);

    // Log reminder SMS for each waiting_sms -> reminder_sent transition.
    const now = new Date().toISOString();
    const reminderComms: CommunicationRecord[] = [];
    advanced.forEach((after, i) => {
      const before = rawCustomers[i];
      if (before?.intakeStatus === 'waiting_sms' && after.intakeStatus === 'reminder_sent') {
        const phone = getSmsPhone(after) ?? undefined;
        const rec: CommunicationRecord = {
          id: crypto.randomUUID(),
          customerId: after.id,
          channel: 'sms',
          direction: 'outbound',
          status: 'sent',
          phone,
          summary: 'Î‘Ï€Î¿ÏƒÏ„Î¿Î»Î® Î´ÎµÏÏ„ÎµÏÎ¿Ï… SMS Ï…Ï€ÎµÎ½Î¸ÏÎ¼Î¹ÏƒÎ·Ï‚ Î³Î¹Î± ÏƒÏ„Î¿Î¹Ï‡ÎµÎ¯Î± Ï€ÎµÎ»Î¬Ï„Î·.',
          createdAt: now,
          isMock: true,
        };
        addCommunicationRecord(rec);
        reminderComms.push(rec);
      }
    });

    const nextData: DashboardData = {
      customers: anyChanged ? advanced : rawCustomers,
      tasks: state.tasks ?? [],
      offers: state.offers ?? [],
      calls: state.calls,
      communications: [...(state.communications ?? []), ...reminderComms],
    };
    const timer = window.setTimeout(() => {
      setDashboardData(nextData);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Stable loading shell â€” identical on server and first client render.
  if (!hydrated) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-5">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">
            ÎšÎ±Î»Î·Î¼Î­ÏÎ±. Î¤Î¹ Ï€ÏÎ­Ï€ÎµÎ¹ Î½Î± Î³Î¯Î½ÎµÎ¹ ÏƒÎ®Î¼ÎµÏÎ±;
          </h1>
        </div>
        <QuickAssistantInput />
        <p className="py-6 text-center text-sm text-zinc-400">Î¦ÏŒÏÏ„Ï‰ÏƒÎ· dashboard...</p>
      </div>
    );
  }

  const { customers, tasks, offers, calls } = dashboardData;

  function handleCompleteTask(taskId: string) {
    const now = new Date().toISOString();
    const task = dashboardData.tasks.find((t) => t.id === taskId);
    if (!task) return;
    setLastCompletedTask(task); // save for undo before overwriting
    const completed: Task = {
      ...task,
      status: 'completed' as TaskBaseStatus,
      completedAt: now,
      updatedAt: now,
    };
    updateTask(completed);
    setDashboardData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? completed : t)),
    }));
  }

  function handleUndoCompleteTask() {
    if (!lastCompletedTask) return;
    updateTask(lastCompletedTask);
    setDashboardData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === lastCompletedTask.id ? lastCompletedTask : t
      ),
    }));
    setLastCompletedTask(null);
  }

  function handleMarkOfferSent(offerId: string) {
    const offer = dashboardData.offers.find((o) => o.id === offerId);
    if (!offer) return;
    const updated = { ...offer, status: 'sent_manually' as const, updatedAt: new Date().toISOString() };
    updateOffer(updated);
    setDashboardData((prev) => ({
      ...prev,
      offers: prev.offers.map((o) => (o.id === offerId ? updated : o)),
    }));
  }

  function handleDeleteSmsIntakeCustomer(customerId: string) {
    deleteCustomer(customerId);
    setDashboardData((prev) => ({
      ...prev,
      customers: prev.customers.filter((c) => c.id !== customerId),
    }));
  }

  function handleCreateSmsIntakeFollowUp(customerId: string) {
    const now = new Date().toISOString();
    const customer = dashboardData.customers.find((c) => c.id === customerId);
    if (!customer) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const task: Task = {
      id: crypto.randomUUID(),
      customerId,
      title: 'Follow-up Î³Î¹Î± ÏƒÏ„Î¿Î¹Ï‡ÎµÎ¯Î± Ï€ÎµÎ»Î¬Ï„Î·',
      type: 'other',
      status: 'open',
      priority: 'normal',
      dueDate: tomorrow.toISOString().split('T')[0],
      note: 'ÎŸ Ï€ÎµÎ»Î¬Ï„Î·Ï‚ Î´ÎµÎ½ Î±Ï€Î¬Î½Ï„Î·ÏƒÎµ ÏƒÏ„Î¿ SMS ÏƒÏ„Î¿Î¹Ï‡ÎµÎ¯Ï‰Î½.',
      createdFromAi: false,
      createdAt: now,
      updatedAt: now,
    };
    addTask(task);
    const updated = { ...customer, intakeStatus: 'kept_draft' as const, updatedAt: now };
    updateCustomer(updated);
    setDashboardData((prev) => ({
      ...prev,
      tasks: [...prev.tasks, task],
      customers: prev.customers.map((c) => (c.id === customerId ? updated : c)),
    }));
  }

  function handleKeepSmsIntakeDraft(customerId: string) {
    const now = new Date().toISOString();
    const customer = dashboardData.customers.find((c) => c.id === customerId);
    if (!customer) return;
    const updated = {
      ...customer,
      intakeStatus: 'kept_draft' as const,
      notes: customer.notes
        ? `${customer.notes}\nÎšÏÎ±Ï„Î®Î¸Î·ÎºÎµ Ï‰Ï‚ Ï€ÏÏŒÏ‡ÎµÎ¹ÏÎ· ÎºÎ±ÏÏ„Î­Î»Î±.`
        : 'ÎšÏÎ±Ï„Î®Î¸Î·ÎºÎµ Ï‰Ï‚ Ï€ÏÏŒÏ‡ÎµÎ¹ÏÎ· ÎºÎ±ÏÏ„Î­Î»Î±.',
      updatedAt: now,
    };
    updateCustomer(updated);
    setDashboardData((prev) => ({
      ...prev,
      customers: prev.customers.map((c) => (c.id === customerId ? updated : c)),
    }));
  }

  function handleCreateOfferFollowUpTask(offerId: string) {
    const offer = dashboardData.offers.find((o) => o.id === offerId);
    if (!offer || !offer.customerId) return; // orphan offers cannot link task to customer

    // Prevent duplicates: skip if an open follow-up task already exists for this offer.
    const alreadyExists = dashboardData.tasks.some(
      (t) =>
        t.type === 'follow_up_offer' &&
        t.status === 'open' &&
        t.customerId === offer.customerId &&
        (t.offerId === offer.id || t.title === `Follow-up Ï€ÏÎ¿ÏƒÏ†Î¿ÏÎ¬Ï‚ ${offer.offerNumber}`)
    );
    if (alreadyExists) return;

    const now = new Date().toISOString();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const task: Task = {
      id: crypto.randomUUID(),
      customerId: offer.customerId,
      offerId: offer.id,
      title: `Follow-up Ï€ÏÎ¿ÏƒÏ†Î¿ÏÎ¬Ï‚ ${offer.offerNumber}`,
      type: 'follow_up_offer',
      status: 'open',
      priority: 'normal',
      dueDate: dueDate.toISOString().split('T')[0],
      note: 'Follow-up Î¼ÎµÏ„Î¬ Ï„Î·Î½ Î±Ï€Î¿ÏƒÏ„Î¿Î»Î® Ï„Î·Ï‚ Ï€ÏÎ¿ÏƒÏ†Î¿ÏÎ¬Ï‚.',
      createdFromAi: false,
      createdAt: now,
      updatedAt: now,
    };
    addTask(task);
    setDashboardData((prev) => ({
      ...prev,
      tasks: [...prev.tasks, task],
    }));
  }

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
      <DemoStepBanner
        step="dashboard"
        stepNum={2}
        title="Dashboard -- ÎµÎºÎºÏÎµÎ¼ÏŒÏ„Î·Ï„ÎµÏ‚ Ï„Î·Ï‚ Î·Î¼Î­ÏÎ±Ï‚"
        body="ÎšÎ¿Î¯Ï„Î± tasks ÎµÎºÏ€ÏÏŒÎ¸ÎµÏƒÎ¼Î±, Î±Î½Î¿Î¹Ï‡Ï„Î­Ï‚ Ï€ÏÎ¿ÏƒÏ†Î¿ÏÎ­Ï‚ ÎºÎ±Î¹ Ï„Î¿Ï€Î¹ÎºÎ® ÎµÎ¹ÎºÏŒÎ½Î± ÏƒÏ„Î¿ ÎºÎ¬Ï„Ï‰ Î¼Î­ÏÎ¿Ï‚."
        watchLabel="Î‘Î½ Î´ÎµÎ½ Î²Î»Î­Ï€ÎµÎ¹Ï‚ ÏƒÏ„Î¿Î¹Ï‡ÎµÎ¯Î±, Î³ÏÏÎ½Î± ÏƒÏ„Î¿ Mission 1 ÎºÎ±Î¹ ÎµÏ€Î±Î½Î±Ï†Î­ÏÎµ Rich demo."
        actionLabel="Î•Ï€ÏŒÎ¼ÎµÎ½Î¿: AI review"
        actionHref="/ai-review?demoStep=review"
      />
      <GuidedDemoBanner
        step="dashboard"
        stepNum={1}
        title="Dashboard â€” ÎºÎ­Î½Ï„ÏÎ¿ ÎµÎ»Î­Î³Ï‡Î¿Ï…"
        whatYouSee="Î•ÎºÎºÏÎµÎ¼ÏŒÏ„Î·Ï„ÎµÏ‚ Î·Î¼Î­ÏÎ±Ï‚: tasks ÎµÎºÏ€ÏÏŒÎ¸ÎµÏƒÎ¼Î±, Î±Î½Î¿Î¹Ï‡Ï„Î­Ï‚ Ï€ÏÎ¿ÏƒÏ†Î¿ÏÎ­Ï‚, Ï€ÏÏŒÏƒÏ†Î±Ï„ÎµÏ‚ Î±Ï€Î±Î½Ï„Î®ÏƒÎµÎ¹Ï‚, local analytics."
        whatToDo="Î Î¬Ï„Î± Î­Î½Î± ÎµÎ¹ÎºÎ¿Î½Î¯Î´Î¹Î¿ Î³Î¹Î± Î½Î± Î´ÎµÎ¹Ï‚ Î»ÎµÏ€Ï„Î¿Î¼Î­ÏÎµÎ¹ÎµÏ‚ Ï‡Ï‰ÏÎ¯Ï‚ Î½Î± Ï†ÏÎ³ÎµÎ¹Ï‚ Î±Ï€ÏŒ Ï„Î·Î½ Î‘ÏÏ‡Î¹ÎºÎ®. ÎšÎ¬Î½Îµ scroll Ï‰Ï‚ ÎºÎ¬Ï„Ï‰ Î³Î¹Î± Î½Î± Î´ÎµÎ¹Ï‚ ÏŒÎ»ÎµÏ‚ Ï„Î¹Ï‚ ÎµÎ½ÏŒÏ„Î·Ï„ÎµÏ‚."
        whyItMatters="Î£Ï„Î¿ Ï„ÎµÎ»Î¹ÎºÏŒ Ï€ÏÎ¿ÏŠÏŒÎ½, ÎµÎ´ÏŽ Î¸Î± Î²Î»Î­Ï€ÎµÎ¹Ï‚ Ï„Î¹ Ï‡ÏÎµÎ¹Î¬Î¶ÎµÏ„Î±Î¹ follow-up Î¼ÎµÏ„Î¬ Î±Ï€ÏŒ ÎºÎ»Î®ÏƒÎµÎ¹Ï‚, SMS, Viber Î® email. Î£Ï„Î¿ MVP: Ï„Î¿Ï€Î¹ÎºÎ¬ Î´ÎµÎ´Î¿Î¼Î­Î½Î± Î¼ÏŒÎ½Î¿."
        canManualComplete={true}
      />

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900">
          ÎšÎ±Î»Î·Î¼Î­ÏÎ±. Î¤Î¹ Ï€ÏÎ­Ï€ÎµÎ¹ Î½Î± Î³Î¯Î½ÎµÎ¹ ÏƒÎ®Î¼ÎµÏÎ±;
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/demo"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
          >
            Demo
          </Link>
          <Link
            href="/settings"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
          >
            Î¡Ï…Î¸Î¼Î¯ÏƒÎµÎ¹Ï‚
          </Link>
        </div>
      </div>

      {/* Smart overview cards â€” 6 icon cards */}
      <DashboardSmartCards
        urgentTasks={urgentTasks}
        leads={leads}
        openOffers={openOffers}
        customers={customers}
        calls={calls}
        customerMap={customerMap}
        onCompleteTask={handleCompleteTask}
      />

      <QuickAssistantInput />

      <SmsIntakeNotificationBar
        customers={customers}
        onDeleteCustomer={handleDeleteSmsIntakeCustomer}
        onCreateFollowUp={handleCreateSmsIntakeFollowUp}
        onKeepDraft={handleKeepSmsIntakeDraft}
      />

      <DataQualityWidget customers={customers} />

      <NextActionsSection
        customers={customers}
        tasks={tasks}
        offers={offers}
        onCompleteTask={handleCompleteTask}
        lastCompletedTaskTitle={lastCompletedTask?.title}
        onUndoCompleteTask={handleUndoCompleteTask}
        onMarkOfferSent={handleMarkOfferSent}
        onCreateOfferFollowUpTask={handleCreateOfferFollowUpTask}
      />

    </div>
  );
}
