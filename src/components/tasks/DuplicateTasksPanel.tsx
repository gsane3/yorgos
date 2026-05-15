'use client';

import type { Task } from '@/lib/types';

interface DuplicateGroup {
  primaryId: string;
  title: string;
  duplicateIds: string[];
}

// Build duplicate groups from open follow_up_offer tasks.
// Group key: customerId + offerId if present, else customerId + title.
// Primary = oldest createdAt. Duplicates = the rest.
function findDuplicateGroups(tasks: Task[]): DuplicateGroup[] {
  const candidates = tasks.filter(
    (t) => t.type === 'follow_up_offer' && t.status === 'open'
  );

  const buckets = new Map<string, Task[]>();
  for (const task of candidates) {
    const key =
      task.customerId && task.offerId
        ? `${task.customerId}:offer:${task.offerId}`
        : task.customerId
        ? `${task.customerId}:title:${task.title}`
        : `notitle:${task.title}`;
    const existing = buckets.get(key) ?? [];
    existing.push(task);
    buckets.set(key, existing);
  }

  const groups: DuplicateGroup[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    // Oldest createdAt first = the one to keep
    const sorted = [...bucket].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
    const [primary, ...duplicates] = sorted;
    groups.push({
      primaryId: primary.id,
      title: primary.title,
      duplicateIds: duplicates.map((t) => t.id),
    });
  }
  return groups;
}

interface Props {
  tasks: Task[];
  onDeleteMany: (taskIds: string[]) => void;
}

export default function DuplicateTasksPanel({ tasks, onDeleteMany }: Props) {
  const groups = findDuplicateGroups(tasks);
  if (groups.length === 0) return null;

  const totalDuplicates = groups.reduce((n, g) => n + g.duplicateIds.length, 0);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-amber-900">
          Βρέθηκαν διπλά follow-up tasks
        </p>
        <p className="text-xs text-amber-700">
          Μπορείς να κρατήσεις το πρώτο και να διαγράψεις τα υπόλοιπα.
          {' '}{totalDuplicates} διπλό{totalDuplicates === 1 ? '' : 'ά'} task{totalDuplicates === 1 ? '' : 's'} συνολικά.
        </p>
      </div>

      <ul className="space-y-2">
        {groups.map((group) => (
          <li
            key={group.primaryId}
            className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-amber-200"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-800">{group.title}</p>
              <p className="text-xs text-zinc-500">
                {group.duplicateIds.length} διπλό{group.duplicateIds.length === 1 ? '' : 'ά'} — το παλαιότερο διατηρείται
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Διαγραφή ${group.duplicateIds.length} διπλού/ών task για "${group.title}"; Η ενέργεια δεν αναιρείται.`
                  )
                ) {
                  onDeleteMany(group.duplicateIds);
                }
              }}
              className="shrink-0 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
            >
              Διαγραφή διπλών
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
