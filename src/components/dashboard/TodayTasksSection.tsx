import Link from 'next/link';
import type { Task } from '@/lib/types';
import { getEffectiveStatus } from '@/lib/types';
import { TASK_TYPE_LABELS } from '@/components/tasks/TaskStatusBadge';

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  normal: 'bg-zinc-400',
  low: 'bg-zinc-300',
};

function formatDueDate(dateStr: string, timeStr?: string): string {
  const todayStr = new Date().toISOString().split('T')[0];
  if (dateStr === todayStr) return timeStr ? `Σήμερα ${timeStr}` : 'Σήμερα';
  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('el-GR', {
    day: 'numeric',
    month: 'short',
  });
  return timeStr ? `${label} ${timeStr}` : label;
}

interface Props {
  tasks: Task[];
  customerMap: Record<string, string>;
}

export default function TodayTasksSection({ tasks, customerMap }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Σημερινά tasks
          </h2>
          {tasks.length > 0 && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
              {tasks.length}
            </span>
          )}
        </div>
        {tasks.length > 0 && (
          <Link href="/tasks" className="text-xs text-indigo-600 hover:text-indigo-700">
            Όλα
          </Link>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-zinc-500">Δεν έχεις ανοιχτά tasks για σήμερα.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => {
            const eff = getEffectiveStatus(task);
            const isOverdue = eff === 'overdue';
            const customerName = task.customerId ? customerMap[task.customerId] : undefined;
            return (
              <li
                key={task.id}
                className={`rounded-2xl p-4 ring-1 ${
                  isOverdue ? 'bg-red-50 ring-red-200' : 'bg-white ring-zinc-100 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] ?? 'bg-zinc-400'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`text-sm font-semibold ${
                          isOverdue ? 'text-red-900' : 'text-zinc-900'
                        }`}
                      >
                        {task.title}
                      </p>
                      {isOverdue ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Εκπρόθεσμο
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          Σήμερα
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                      {customerName && <span>{customerName}</span>}
                      <span>{TASK_TYPE_LABELS[task.type]}</span>
                      <span>{formatDueDate(task.dueDate, task.dueTime)}</span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
