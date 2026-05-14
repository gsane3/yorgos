'use client';

import { useState, useMemo } from 'react';
import { loadState, saveState, addTask, updateTask, deleteTask } from '@/lib/storage';
import { generateDemoTasks } from '@/lib/demo-data';
import type { Task, Customer, TaskBaseStatus, TaskType, TaskPriority } from '@/lib/types';
import { getEffectiveStatus } from '@/lib/types';
import { norm } from '@/lib/search';
import TaskCard from '@/components/tasks/TaskCard';
import TaskForm from '@/components/tasks/TaskForm';
import { TASK_TYPE_LABELS, TASK_PRIORITY_LABELS } from '@/components/tasks/TaskStatusBadge';

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

function initTasks(): Task[] {
  if (typeof window === 'undefined') return [];
  const state = loadState();
  if (state.tasks === undefined) {
    const seeded = generateDemoTasks();
    saveState({ tasks: seeded });
    return seeded;
  }
  return state.tasks;
}

function initCustomers(): Customer[] {
  if (typeof window === 'undefined') return [];
  return loadState().customers ?? [];
}

const selCls =
  'rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-700 outline-none focus:border-indigo-400';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(initTasks);
  const [customers] = useState<Customer[]>(initCustomers);
  const [activeTab, setActiveTab] = useState<TabId>('due_today');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Search + filter state (does not affect tab counts)
  const [taskSearch, setTaskSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('');
  const [typeFilter, setTypeFilter] = useState<TaskType | ''>('');

  const hasTaskFilter = taskSearch.trim() !== '' || priorityFilter !== '' || typeFilter !== '';

  const customerMap = useMemo(
    () => Object.fromEntries(customers.map((c) => [c.id, c.name])),
    [customers]
  );

  // Tab counts — based on ALL tasks, unaffected by search/filter (constraint)
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

  // Filtered list — tab first, then search+filter within tab
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

  function handleComplete(id: string) {
    const now = new Date().toISOString();
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const completed = { ...task, status: 'completed' as TaskBaseStatus, completedAt: now, updatedAt: now };
    updateTask(completed);
    setTasks((prev) => prev.map((t) => (t.id === id ? completed : t)));
  }

  function handleDelete(id: string) {
    deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function handleEdit(task: Task) {
    setEditingTask(task);
    setShowForm(true);
  }

  function handleSave(task: Task) {
    if (editingTask) {
      updateTask(task);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    } else {
      addTask(task);
      setTasks((prev) => [...prev, task]);
    }
    setShowForm(false);
    setEditingTask(null);
  }

  function handleCancelForm() {
    setShowForm(false);
    setEditingTask(null);
  }

  function openNewForm() {
    setEditingTask(null);
    setShowForm(true);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
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

      {/* Form */}
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

      {/* Tabs — counts are total per tab, unaffected by search/filter */}
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
        <p className="py-10 text-center text-sm text-zinc-400">
          {hasTaskFilter ? 'Δεν βρέθηκαν αποτελέσματα για αυτά τα φίλτρα.' : EMPTY_STATES[activeTab]}
        </p>
      ) : (
        <ul className="space-y-2">
          {filteredTasks.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                customerName={task.customerId ? customerMap[task.customerId] : undefined}
                onComplete={handleComplete}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
