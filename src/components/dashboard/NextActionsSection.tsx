import Link from 'next/link';
import type { Customer, Task, Offer } from '@/lib/types';
import { getEffectiveStatus } from '@/lib/types';
import { TASK_TYPE_LABELS } from '@/components/tasks/TaskStatusBadge';
import { fmtEur } from '@/lib/offer-calculations';

const INITIAL_VISIBLE = 5;

const PRIORITY_ORDER: Record<string, number> = { high: 0, normal: 1, low: 2 };

interface ActionItem {
  id: string;
  kind: 'task' | 'offer' | 'customer';
  tone: 'red' | 'amber' | 'indigo';
  title: string;
  detail: string;
  customerName?: string;
  href: string;
}

function buildActions(
  customers: Customer[],
  tasks: Task[],
  offers: Offer[]
): ActionItem[] {
  const items: ActionItem[] = [];
  const customerMap: Record<string, string> = Object.fromEntries(
    customers.map((c) => [c.id, c.name])
  );

  // Customer IDs that already have an open task (used to deduplicate follow-up fallback).
  const customerIdsWithOpenTask = new Set(
    tasks
      .filter((t) => t.status === 'open' && t.customerId)
      .map((t) => t.customerId as string)
  );

  // 1. Overdue open tasks — sorted high > normal > low priority.
  const overdueTasks = tasks
    .filter((t) => t.status === 'open' && getEffectiveStatus(t) === 'overdue')
    .sort(
      (a, b) =>
        (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
    );
  for (const task of overdueTasks) {
    items.push({
      id: task.id,
      kind: 'task',
      tone: 'red',
      title: task.title,
      detail: `Εκπρόθεσμο · ${TASK_TYPE_LABELS[task.type] ?? task.type}`,
      customerName: task.customerId ? customerMap[task.customerId] : undefined,
      href: '/tasks',
    });
  }

  // 2. Open tasks due today — sorted by priority.
  const todayTasks = tasks
    .filter((t) => t.status === 'open' && getEffectiveStatus(t) === 'due_today')
    .sort(
      (a, b) =>
        (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
    );
  for (const task of todayTasks) {
    items.push({
      id: task.id,
      kind: 'task',
      tone: 'amber',
      title: task.title,
      detail: `Σήμερα · ${TASK_TYPE_LABELS[task.type] ?? task.type}`,
      customerName: task.customerId ? customerMap[task.customerId] : undefined,
      href: '/tasks',
    });
  }

  // 3. Offers ready to send — newest updatedAt first.
  const readyOffers = offers
    .filter((o) => o.status === 'ready_to_send')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const offer of readyOffers) {
    items.push({
      id: offer.id,
      kind: 'offer',
      tone: 'indigo',
      title: `Προσφορά ${offer.offerNumber} — έτοιμη για αποστολή`,
      detail: fmtEur(offer.total),
      customerName: offer.customerId ? customerMap[offer.customerId] : undefined,
      href: `/offers/${offer.id}`,
    });
  }

  // 4. Offers sent manually — suggest follow-up, newest first.
  const sentOffers = offers
    .filter((o) => o.status === 'sent_manually')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const offer of sentOffers) {
    items.push({
      id: `follow-${offer.id}`,
      kind: 'offer',
      tone: 'indigo',
      title: `Follow-up προσφοράς ${offer.offerNumber}`,
      detail: fmtEur(offer.total),
      customerName: offer.customerId ? customerMap[offer.customerId] : undefined,
      href: `/offers/${offer.id}`,
    });
  }

  // 5. Customers with follow_up_needed but no open task — newest updatedAt first.
  const followUpCustomers = customers
    .filter(
      (c) =>
        c.status === 'follow_up_needed' &&
        !customerIdsWithOpenTask.has(c.id)
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const c of followUpCustomers) {
    items.push({
      id: `cu-${c.id}`,
      kind: 'customer',
      tone: 'amber',
      title: 'Χρειάζεται follow-up',
      detail: '',
      customerName: c.name,
      href: `/customers/${c.id}`,
    });
  }

  return items;
}

const TONE_ROW: Record<ActionItem['tone'], string> = {
  red: 'bg-red-50 ring-red-200',
  amber: 'bg-amber-50 ring-amber-200',
  indigo: 'bg-indigo-50 ring-indigo-200',
};

const TONE_LINK: Record<ActionItem['tone'], string> = {
  red: 'text-red-700 hover:text-red-900',
  amber: 'text-amber-700 hover:text-amber-900',
  indigo: 'text-indigo-700 hover:text-indigo-900',
};

const TONE_DOT: Record<ActionItem['tone'], string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  indigo: 'bg-indigo-500',
};

interface Props {
  customers: Customer[];
  tasks: Task[];
  offers: Offer[];
}

export default function NextActionsSection({ customers, tasks, offers }: Props) {
  const allItems = buildActions(customers, tasks, offers);
  const visible = allItems.slice(0, INITIAL_VISIBLE);
  const extra = allItems.length - INITIAL_VISIBLE;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Προτεραιότητες σήμερα
        </h2>
        {allItems.length > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            allItems.some((i) => i.tone === 'red')
              ? 'bg-red-100 text-red-700'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {allItems.length}
          </span>
        )}
      </div>

      {allItems.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Δεν υπάρχουν άμεσες προτεραιότητες.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {visible.map((item) => (
              <li
                key={item.id}
                className={`rounded-2xl p-3 ring-1 ${TONE_ROW[item.tone]}`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${TONE_DOT[item.tone]}`}
                  />
                  <div className="min-w-0 flex-1">
                    {item.customerName && (
                      <p className="truncate text-xs font-medium text-zinc-500">
                        {item.customerName}
                      </p>
                    )}
                    <p className="truncate text-sm font-semibold text-zinc-800">
                      {item.title}
                    </p>
                    {item.detail && (
                      <p className="text-xs text-zinc-500">{item.detail}</p>
                    )}
                  </div>
                  <Link
                    href={item.href}
                    className={`shrink-0 text-xs font-medium transition ${TONE_LINK[item.tone]}`}
                  >
                    Άνοιγμα
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          {extra > 0 && (
            <Link
              href="/tasks"
              className="text-xs text-indigo-600 hover:text-indigo-700"
            >
              +{extra} ακόμα προτεραιότητες
            </Link>
          )}
        </>
      )}
    </section>
  );
}
