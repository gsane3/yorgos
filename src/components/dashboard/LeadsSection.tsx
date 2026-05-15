import Link from 'next/link';
import type { Customer } from '@/lib/types';
import CustomerStatusBadge from '@/components/customers/CustomerStatusBadge';
import { SOURCE_LABELS } from '@/components/customers/CustomerCard';

interface Props {
  leads: Customer[];
}

export default function LeadsSection({ leads }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Leads για κλήση
        </h2>
        {leads.length > 0 && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
            {leads.length}
          </span>
        )}
      </div>

      {leads.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Δεν υπάρχουν leads που περιμένουν κλήση.
        </p>
      ) : (
        <ul className="space-y-2">
          {leads.map((customer) => (
            <li key={customer.id}>
              <Link
                href={`/customers/${customer.id}`}
                className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 transition hover:ring-indigo-200 active:bg-zinc-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">{customer.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
                        {SOURCE_LABELS[customer.source] ?? customer.source}
                      </span>
                      {customer.opportunityValue !== undefined && customer.opportunityValue > 0 && (
                        <span className="font-medium text-zinc-700">
                          €{customer.opportunityValue.toLocaleString('el-GR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <CustomerStatusBadge status={customer.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
