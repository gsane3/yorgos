import Link from 'next/link';
import type { Customer, Task, Offer } from '@/lib/types';
import { getEffectiveStatus } from '@/lib/types';
import { fmtEur } from '@/lib/offer-calculations';

interface Props {
  customer: Customer;
  tasks: Task[];
  offers: Offer[];
}

interface Recommendation {
  title: string;
  detail: string;
  tone: 'red' | 'amber' | 'indigo' | 'neutral';
  actionLabel?: string;
  actionHref?: string;
}

function deriveRecommendation(
  customer: Customer,
  tasks: Task[],
  offers: Offer[]
): Recommendation {
  // 1. Overdue open task — highest urgency.
  const overdueTask = tasks.find(
    (t) => t.status === 'open' && getEffectiveStatus(t) === 'overdue'
  );
  if (overdueTask) {
    return {
      title: 'Υπάρχει εκπρόθεσμο task',
      detail: overdueTask.title,
      tone: 'red',
      actionLabel: 'Άνοιγμα tasks',
      actionHref: '/tasks',
    };
  }

  // 2. Open task due today.
  const todayTask = tasks.find(
    (t) => t.status === 'open' && getEffectiveStatus(t) === 'due_today'
  );
  if (todayTask) {
    return {
      title: 'Έχεις task για σήμερα',
      detail: todayTask.title,
      tone: 'amber',
      actionLabel: 'Άνοιγμα tasks',
      actionHref: '/tasks',
    };
  }

  // 3. Offer ready to send.
  const readyOffer = offers.find((o) => o.status === 'ready_to_send');
  if (readyOffer) {
    return {
      title: 'Υπάρχει προσφορά έτοιμη για αποστολή',
      detail: `${readyOffer.offerNumber} · ${fmtEur(readyOffer.total)}`,
      tone: 'indigo',
      actionLabel: 'Άνοιγμα προσφοράς',
      actionHref: `/offers/${readyOffer.id}`,
    };
  }

  // 4. Offer sent — suggest follow-up.
  const sentOffer = offers.find((o) => o.status === 'sent_manually');
  if (sentOffer) {
    return {
      title: 'Κάνε follow-up στην προσφορά',
      detail: `${sentOffer.offerNumber} · ${fmtEur(sentOffer.total)}`,
      tone: 'indigo',
      actionLabel: 'Άνοιγμα προσφοράς',
      actionHref: `/offers/${sentOffer.id}`,
    };
  }

  // 5. Customer status is follow_up_needed.
  if (customer.status === 'follow_up_needed') {
    return {
      title: 'Χρειάζεται follow-up',
      detail: 'Ο πελάτης είναι σε κατάσταση follow-up.',
      tone: 'amber',
      actionLabel: 'Δημιουργία task',
      actionHref: '/tasks',
    };
  }

  // 6. Nothing pending.
  return {
    title: 'Δεν υπάρχει άμεση εκκρεμότητα',
    detail:
      'Ο πελάτης δεν έχει ανοιχτό task ή προσφορά που χρειάζεται ενέργεια.',
    tone: 'neutral',
  };
}

const STYLES = {
  red: {
    container: 'bg-red-50 ring-1 ring-red-200',
    label: 'text-zinc-400',
    title: 'text-red-900',
    detail: 'text-red-700',
    button: 'bg-red-600 text-white hover:bg-red-700',
  },
  amber: {
    container: 'bg-amber-50 ring-1 ring-amber-200',
    label: 'text-zinc-400',
    title: 'text-amber-900',
    detail: 'text-amber-700',
    button: 'bg-amber-600 text-white hover:bg-amber-700',
  },
  indigo: {
    container: 'bg-indigo-50 ring-1 ring-indigo-200',
    label: 'text-zinc-400',
    title: 'text-indigo-900',
    detail: 'text-indigo-700',
    button: 'bg-indigo-600 text-white hover:bg-indigo-700',
  },
  neutral: {
    container: 'bg-zinc-50 ring-1 ring-zinc-100',
    label: 'text-zinc-400',
    title: 'text-zinc-700',
    detail: 'text-zinc-500',
    button: '',
  },
} as const;

export default function CustomerNextActionPanel({ customer, tasks, offers }: Props) {
  const rec = deriveRecommendation(customer, tasks, offers);
  const s = STYLES[rec.tone];

  return (
    <div className={`rounded-2xl p-4 ${s.container}`}>
      <p className={`mb-0.5 text-xs font-semibold uppercase tracking-wide ${s.label}`}>
        Προτεινόμενη ενέργεια
      </p>
      <p className={`text-sm font-semibold ${s.title}`}>{rec.title}</p>
      <p className={`mt-0.5 min-w-0 truncate text-xs ${s.detail}`}>{rec.detail}</p>

      {rec.actionLabel && rec.actionHref && (
        <Link
          href={rec.actionHref}
          className={`mt-3 inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-semibold transition ${s.button}`}
        >
          {rec.actionLabel}
        </Link>
      )}

      {rec.tone === 'neutral' && (
        <Link
          href="/tasks"
          className="mt-2 inline-flex text-xs text-indigo-600 hover:text-indigo-700"
        >
          Δείτε tasks
        </Link>
      )}
    </div>
  );
}
