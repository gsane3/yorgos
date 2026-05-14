'use client';

import { useState } from 'react';
import type { Task, TaskType, TaskPriority, Customer } from '@/lib/types';
import { TASK_TYPE_LABELS, TASK_PRIORITY_LABELS } from './TaskStatusBadge';

interface Props {
  initial?: Task;
  customers: Customer[];
  onSave: (task: Task) => void;
  onCancel: () => void;
}

const todayStr = () => new Date().toISOString().split('T')[0];

export default function TaskForm({ initial, customers, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [type, setType] = useState<TaskType>(initial?.type ?? 'call_back');
  const [customerId, setCustomerId] = useState(initial?.customerId ?? '');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? todayStr());
  const [dueTime, setDueTime] = useState(initial?.dueTime ?? '');
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'normal');
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState('');

  function handleSave() {
    if (!title.trim()) {
      setError('Ο τίτλος είναι υποχρεωτικός.');
      return;
    }
    if (!dueDate) {
      setError('Η ημερομηνία είναι υποχρεωτική.');
      return;
    }
    const now = new Date().toISOString();
    const task: Task = {
      id: initial?.id ?? crypto.randomUUID(),
      customerId: customerId || undefined,
      title: title.trim(),
      type,
      status: initial?.status ?? 'open',
      priority,
      dueDate,
      dueTime: dueTime || undefined,
      note: note.trim(),
      createdFromAi: initial?.createdFromAi ?? false,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
      completedAt: initial?.completedAt,
      isDemo: initial?.isDemo,
    };
    onSave(task);
  }

  const inputCls =
    'w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
  const selectCls =
    'w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white';
  const labelCls = 'mb-1 block text-sm font-medium text-zinc-700';

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
      <h3 className="mb-4 text-base font-semibold text-zinc-900">
        {initial ? 'Επεξεργασία task' : 'Νέο task'}
      </h3>

      <div className="flex flex-col gap-4">
        <div>
          <label className={labelCls}>Τίτλος *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(''); }}
            placeholder="π.χ. Κλήση πίσω στον Παπαδόπουλο"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Τύπος</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TaskType)}
            className={selectCls}
          >
            {(Object.entries(TASK_TYPE_LABELS) as [TaskType, string][]).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>
            Πελάτης{' '}
            <span className="text-xs font-normal text-zinc-400">(προαιρετικό)</span>
          </label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className={selectCls}
          >
            <option value="">— Χωρίς πελάτη —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelCls}>Ημερομηνία *</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => { setDueDate(e.target.value); setError(''); }}
              className={inputCls}
            />
          </div>
          <div className="w-32">
            <label className={labelCls}>
              Ώρα{' '}
              <span className="text-xs font-normal text-zinc-400">(opt)</span>
            </label>
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Προτεραιότητα</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className={selectCls}
          >
            {(Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(
              ([val, label]) => (
                <option key={val} value={val}>{label}</option>
              )
            )}
          </select>
        </div>

        <div>
          <label className={labelCls}>
            Σημείωση{' '}
            <span className="text-xs font-normal text-zinc-400">(προαιρετικό)</span>
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Σχόλια ή λεπτομέρειες..."
            className={`${inputCls} resize-none`}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Ακύρωση
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Αποθήκευση
          </button>
        </div>
      </div>
    </div>
  );
}
