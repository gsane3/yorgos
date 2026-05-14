import type { CustomerStatus } from '@/lib/types';

export const STATUS_LABELS: Record<CustomerStatus, string> = {
  new_lead: 'Νέο lead',
  contacted: 'Έγινε επικοινωνία',
  follow_up_needed: 'Θέλει follow-up',
  offer_drafted: 'Έχει draft προσφοράς',
  offer_sent: 'Στάλθηκε προσφορά',
  won: 'Κερδισμένος',
  lost: 'Χαμένος',
};

const STATUS_COLORS: Record<CustomerStatus, string> = {
  new_lead: 'bg-indigo-100 text-indigo-700',
  contacted: 'bg-emerald-100 text-emerald-700',
  follow_up_needed: 'bg-amber-100 text-amber-700',
  offer_drafted: 'bg-purple-100 text-purple-700',
  offer_sent: 'bg-blue-100 text-blue-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-zinc-100 text-zinc-500',
};

export default function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
