'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import type { Task, Customer, TaskBaseStatus, TaskType, TaskPriority } from '@/lib/types';
import { getEffectiveStatus } from '@/lib/types';
import { norm } from '@/lib/search';
import TaskCard from '@/components/tasks/TaskCard';
import TaskForm from '@/components/tasks/TaskForm';
import { TASK_TYPE_LABELS, TASK_PRIORITY_LABELS } from '@/components/tasks/TaskStatusBadge';
import PageHelp from '@/components/common/PageHelp';

type TabId = 'due_today' | 'upcoming' | 'overdue' | 'completed';

const TAB_LABELS: Record<TabId, string> = {
  overdue: 'Εκπρόθεσμα',
  due_today: 'Σήμερα',
  upcoming: 'Επερχόμενα',
  completed: 'Ολοκληρωμένα',
};

const TAB_ORDER: TabId[] = ['due_today', 'upcoming', 'overdue', 'completed'];

const EMPTY_STATES: Record<TabId, string> = {
  overdue: 'Δεν υπάρχουν εκπρόθεσμα tasks.',
  due_today: 'Δεν έχεις ανοιχτά tasks για σήμερα.',
  upcoming: 'Δεν υπάρχουν επερχόμενα tasks.',
  completed: 'Δεν υπάρχουν ολοκληρωμένα tasks.',
};

const selCls =
  'rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-700 outline-none focus:border-indigo-400';

// DTO shapes from backend API
interface TaskDto {
  id: string;
  customerId?: string | null;
  offerId?: string | null;
  title: string;
  type: string;
  status: string;
  priority: string;
  dueDate: string;
  dueTime?: string | null;
  note?: string | null;
  createdFromAi?: boolean | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CustomerDto {
  id: string;
  crmNumber?: string | null;
  name?: string | null;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  status?: string | null;
  preferredContactMethod?: string | null;
  needsSummary?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapTask(dto: TaskDto): Task {
  return {
    id: dto.id,
    customerId: dto.customerId ?? undefined,
    offerId: dto.offerId ?? undefined,
    title: dto.title,
    type: (dto.type as TaskType) ?? 'other',
    // ai_draft is not in TaskBaseStatus but is cast safely. getEffectiveStatus falls through
    // to date-based logic for any unrecognised status, which is the correct behaviour.
    status: dto.status as TaskBaseStatus,
    priority: (dto.priority as TaskPriority) ?? 'normal',
    dueDate: dto.dueDate ?? new Date().toISOString().split('T')[0],
    dueTime: dto.dueTime ?? undefined,
    note: dto.note ?? '',
    createdFromAi: dto.createdFromAi ?? false,
    completedAt: dto.completedAt ?? undefined,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

function mapCustomer(dto: CustomerDto): Customer {
  const now = new Date().toISOString();
  return {
    id: dto.id,
    name: dto.name ?? dto.companyName ?? dto.crmNumber ?? 'Πελάτης',
    companyName: dto.companyName ?? '',
    phone: dto.phone ?? '',
    email: dto.email ?? '',
    address: '',
    source: (dto.source as Customer['source']) ?? 'manual_entry',
    status: (dto.status as Customer['status']) ?? 'new_lead',
    preferredContactMethod:
      (dto.preferredContactMethod as Customer['preferredContactMethod']) ?? 'phone',
    needsSummary: dto.needsSummary ?? '',
    notes: dto.notes ?? '',
    createdAt: dto.createdAt ?? now,
    updatedAt: dto.updatedAt ?? now,
    crmNumber: dto.crmNumber ?? undefined,
  };
}

// Prevent sending ai_draft (or any unknown status) to write endpoints.
function sanitizeWriteStatus(status: string): 'open' | 'completed' | 'cancelled' {
  if (status === 'completed' || status === 'cancelled') return status;
  return 'open';
}

export default function TasksPage() {
  const [hydrated, setHydrated] = useState(false);
  const [noSession, setNoSession] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('due_today');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const [taskSearch, setTaskSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('');
  const [typeFilter, setTypeFilter] = useState<TaskType | ''>('');

  const loadData = useCallback(async (token: string) => {
    setFetchError(null);
    try {
      const headers: HeadersInit = { Authorization: `Bearer ${token}` };
      const [tasksResp, customersResp] = await Promise.all([
        fetch('/api/tasks?limit=100', { headers }),
        fetch('/api/customers?limit=100', { headers }),
      ]);

      if (!tasksResp.ok || !customersResp.ok) {
        setFetchError('Αποτυχία φόρτωσης. Δοκίμασε ξανά.');
        setHydrated(true);
        return;
      }

      const tasksData = await tasksResp.json();
      const customersData = await customersResp.json();

      const rawTasks: TaskDto[] = Array.isArray(tasksData)
        ? tasksData
        : (tasksData.tasks ?? []);
      const rawCustomers: CustomerDto[] = Array.isArray(customersData)
        ? customersData
        : (customersData.customers ?? []);

      // Appointment/visit types belong to /appointments, not /tasks.
      const nextTasks = rawTasks
        .map(mapTask)
        .filter((t) => t.type !== 'book_appointment' && t.type !== 'visit_customer');

      const nextCustomers = rawCustomers.map(mapCustomer);

      // taskId URL param - switch to correct tab and highlight after load.
      const pid =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('taskId')
          : null;
      let tabOverride: TabId | null = null;
      let foundTaskId: string | null = null;
      if (pid) {
        const found = nextTasks.find((t) => t.id === pid);
        if (found) {
          foundTaskId = found.id;
          const eff = getEffectiveStatus(found);
          tabOverride =
            eff === 'completed' || eff === 'cancelled'
              ? 'completed'
              : eff === 'overdue'
              ? 'overdue'
              : eff === 'due_today'
              ? 'due_today'
              : 'upcoming';
        }
      }

      setTasks(nextTasks);
      setCustomers(nextCustomers);
      if (tabOverride) {
        setActiveTab(tabOverride);
        setTaskSearch('');
        setPriorityFilter('');
        setTypeFilter('');
      }
      if (foundTaskId) setFocusedTaskId(foundTaskId);
      setHydrated(true);
    } catch {
      setFetchError('Αποτυχία φόρτωσης. Δοκίμασε ξανά.');
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const supabase = createBrowserSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setNoSession(true);
          setHydrated(true);
          return;
        }
        tokenRef.current = session.access_token;
        await loadData(session.access_token);
      } catch {
        setFetchError('Αποτυχία σύνδεσης. Δοκίμασε ξανά.');
        setHydrated(true);
      }
    }
    init();
  }, [loadData]);

  // Scroll to focused task after hydration.
  useEffect(() => {
    if (!hydrated || !focusedTaskId) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`task-${focusedTaskId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    return () => clearTimeout(timer);
  }, [hydrated, focusedTaskId]);

  // Clear focus when the focused task disappears from the list.
  useEffect(() => {
    if (!hydrated || !focusedTaskId) return;
    const found = tasks.find((t) => t.id === focusedTaskId);
    if (!found) {
      const timer = window.setTimeout(() => {
        setFocusedTaskId(null);
        window.history.replaceState(null, '', '/tasks');
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [tasks, focusedTaskId, hydrated]);

  const hasTaskFilter = taskSearch.trim() !== '' || priorityFilter !== '' || typeFilter !== '';

  function clearFocusedTask() {
    setFocusedTaskId(null);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/tasks');
    }
  }

  const focusedTask = focusedTaskId ? tasks.find((t) => t.id === focusedTaskId) ?? null : null;

  const customerMap = useMemo(
    () => Object.fromEntries(customers.map((c) => [c.id, c.name])),
    [customers]
  );

  const tabCounts = useMemo(() => {
    const counts: Record<TabId, number> = { due_today: 0, upcoming: 0, overdue: 0, completed: 0 };
    for (const t of tasks) {
      const eff = getEffectiveStatus(t);
      if (eff === 'due_today') counts.due_today++;
      else if (eff === 'upcoming') counts.upcoming++;
      else if (eff === 'overdue') counts.overdue++;
      else if (eff === 'completed' || eff === 'cancelled') counts.completed++;
    }
    return counts;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = norm(taskSearch.trim());
    return tasks.filter((t) => {
      const eff = getEffectiveStatus(t);
      const inTab =
        activeTab === 'completed'
          ? eff === 'completed' || eff === 'cancelled'
          : eff === activeTab;
      if (!inTab) return false;

      if (q) {
        const customerName = t.customerId ? norm(customerMap[t.customerId] ?? '') : '';
        const hit =
          norm(t.title).includes(q) ||
          norm(t.note).includes(q) ||
          customerName.includes(q);
        if (!hit) return false;
      }

      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (typeFilter && t.type !== typeFilter) return false;

      return true;
    });
  }, [tasks, activeTab, taskSearch, priorityFilter, typeFilter, customerMap]);

  function clearTaskFilters() {
    setTaskSearch('');
    setPriorityFilter('');
    setTypeFilter('');
  }

  async function handleComplete(id: string) {
    const token = tokenRef.current;
    if (!token) return;
    const resp = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? mapTask(data.task) : t)));
    }
  }

  // "Delete" patches status to cancelled - no hard-delete endpoint exists yet.
  async function handleDelete(id: string) {
    const token = tokenRef.current;
    if (!token) return;
    const resp = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? mapTask(data.task) : t)));
    }
  }

  function handleEdit(task: Task) {
    setEditingTask(task);
    setShowForm(true);
  }

  async function handleSave(task: Task) {
    const token = tokenRef.current;
    if (!token) return;

    // TaskForm preserves ai_draft status; sanitize before sending to the write endpoint.
    const safeStatus = sanitizeWriteStatus(task.status as string);

    const body = {
      title: task.title,
      type: task.type,
      status: safeStatus,
      priority: task.priority,
      dueDate: task.dueDate,
      dueTime: task.dueTime ?? null,
      note: task.note,
      customerId: task.customerId ?? null,
      offerId: task.offerId ?? null,
    };

    if (editingTask) {
      const resp = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (resp.ok) {
        const data = await resp.json();
        setTasks((prev) => prev.map((t) => (t.id === task.id ? mapTask(data.task) : t)));
      }
    } else {
      const resp = await fetch('/api/tasks', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (resp.ok) {
        const data = await resp.json();
        const created = mapTask(data.task);
        if (created.type !== 'book_appointment' && created.type !== 'visit_customer') {
          setTasks((prev) => [...prev, created]);
        }
      }
    }

    setShowForm(false);
    setEditingTask(null);
  }

  async function handleSnooze(id: string, newDueDate: string) {
    const token = tokenRef.current;
    if (!token) return;
    const task = tasks.find((t) => t.id === id);
    if (!task || task.status !== 'open') return;
    const resp = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueDate: newDueDate }),
    });
    if (resp.ok) {
      const data = await resp.json();
      setTasks((prev) => prev.map((t) => (t.id === id ? mapTask(data.task) : t)));
    }
  }

  function handleCancelForm() {
    setShowForm(false);
    setEditingTask(null);
  }

  function openNewForm() {
    setEditingTask(null);
    setShowForm(true);
  }

  // Skeleton shown during initial load - no data-derived content to avoid hydration mismatch.
  if (!hydrated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-zinc-900">Tasks</h1>
          <button
            type="button"
            className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
          >
            + Νέο task
          </button>
        </div>
        <div className="mb-3 -mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
          {TAB_ORDER.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                tab === 'due_today'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
        <p className="py-10 text-center text-sm text-zinc-400">Φόρτωση tasks...</p>
      </div>
    );
  }

  if (noSession) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-5">
        <h1 className="mb-4 text-lg font-semibold text-zinc-900">Tasks</h1>
        <div className="rounded-2xl bg-zinc-50 px-5 py-10 text-center ring-1 ring-zinc-100">
          <p className="mb-4 text-sm text-zinc-600">Συνδέσου για να δεις τα tasks.</p>
          <Link
            href="/login/backend"
            className="inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Σύνδεση
          </Link>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-5">
        <h1 className="mb-4 text-lg font-semibold text-zinc-900">Tasks</h1>
        <div className="rounded-2xl bg-zinc-50 px-5 py-10 text-center ring-1 ring-zinc-100">
          <p className="mb-4 text-sm text-red-600">{fetchError}</p>
          <button
            type="button"
            onClick={() => {
              const token = tokenRef.current;
              if (token) {
                setHydrated(false);
                loadData(token);
              }
            }}
            className="inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Δοκίμασε ξανά
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      <div className="mb-4">
        <PageHelp title="Τι βλέπω εδώ;">
          <p className="text-sm text-zinc-600">
            Εδώ βλέπεις όλες τις εκκρεμότητες. Άνοιξε ένα task ή πάτα Ολοκλήρωση.
          </p>
          <ul className="space-y-1 mt-1">
            {[
              'Πάτα «Ολοκλήρωση» για να κλείσεις ένα task.',
              'Πάτα «Περισσότερα» για αναβολή, επεξεργασία ή ακύρωση.',
              'Τα tasks από AI εμφανίζονται αυτόματα μετά από κάθε κλήση.',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2 text-xs text-zinc-500">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                {t}
              </li>
            ))}
          </ul>
        </PageHelp>
      </div>

      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-zinc-900">Tasks</h1>
        <button
          type="button"
          onClick={showForm && !editingTask ? handleCancelForm : openNewForm}
          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
            showForm && !editingTask
              ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {showForm && !editingTask ? 'Ακύρωση' : '+ Νέο task'}
        </button>
      </div>

      {/* Create / edit form */}
      {showForm && (
        <div className="mb-5">
          <TaskForm
            initial={editingTask ?? undefined}
            customers={customers}
            onSave={handleSave}
            onCancel={handleCancelForm}
          />
        </div>
      )}

      {/* Focus banner - shown when arriving from dashboard with a taskId param */}
      {focusedTask && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-indigo-50 px-4 py-3 ring-1 ring-indigo-200">
          <div className="min-w-0">
            <p className="text-xs font-medium text-indigo-600">Άνοιξες task από το dashboard</p>
            <p className="truncate text-sm font-semibold text-indigo-900">{focusedTask.title}</p>
          </div>
          <button
            type="button"
            onClick={clearFocusedTask}
            className="shrink-0 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50"
          >
            Καθαρισμός εστίασης
          </button>
        </div>
      )}

      {/* Tabs - counts based on all tasks, unaffected by search/filter */}
      <div className="mb-3 -mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
        {TAB_ORDER.map((tab) => {
          const count = tabCounts[tab];
          const active = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {TAB_LABELS[tab]}
              {count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                    active
                      ? 'bg-white/20 text-white'
                      : tab === 'overdue'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-zinc-200 text-zinc-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + filters within active tab */}
      <div className="mb-4 space-y-2">
        <input
          type="search"
          value={taskSearch}
          onChange={(e) => setTaskSearch(e.target.value)}
          placeholder="Αναζήτηση τίτλου, σημείωσης, πελάτη..."
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | '')}
            className={selCls}
          >
            <option value="">Όλες οι προτεραιότητες</option>
            {(Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TaskType | '')}
            className={selCls}
          >
            <option value="">Όλοι οι τύποι</option>
            {(Object.entries(TASK_TYPE_LABELS) as [TaskType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          {hasTaskFilter && (
            <button
              type="button"
              onClick={clearTaskFilters}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500 transition hover:bg-zinc-50"
            >
              Καθαρισμός
            </button>
          )}
        </div>
      </div>

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-2xl bg-zinc-50 px-5 py-8 text-center ring-1 ring-zinc-100">
          <p className="text-sm font-medium text-zinc-500">
            {hasTaskFilter
              ? 'Δεν βρέθηκαν αποτελέσματα για αυτά τα φίλτρα.'
              : tasks.length === 0
              ? 'Δεν υπάρχουν ακόμα tasks. Όταν ολοκληρωθεί η πρώτη κλήση, τα προτεινόμενα tasks θα εμφανιστούν εδώ.'
              : EMPTY_STATES[activeTab]}
          </p>
          {!hasTaskFilter && activeTab !== 'completed' && tasks.length > 0 && (
            <p className="mt-1 text-sm text-zinc-400">
              Πρόσθεσε task με το κουμπί + παραπάνω.
            </p>
          )}
          {hasTaskFilter && (
            <button
              type="button"
              onClick={clearTaskFilters}
              className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-600 ring-1 ring-zinc-200 transition hover:ring-indigo-300"
            >
              Καθαρισμός φίλτρων
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredTasks.map((task) => (
            <li
              key={task.id}
              id={`task-${task.id}`}
              className={
                task.id === focusedTaskId
                  ? 'rounded-2xl outline outline-2 outline-offset-2 outline-indigo-400'
                  : ''
              }
            >
              <TaskCard
                task={task}
                customerName={task.customerId ? customerMap[task.customerId] : undefined}
                onComplete={handleComplete}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSnooze={handleSnooze}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
