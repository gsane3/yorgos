import Link from 'next/link';
import type { Offer } from '@/lib/types';
import { fmtEur } from '@/lib/offer-calculations';
import OfferStatusBadge from '@/components/offers/OfferStatusBadge';

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('el-GR', {
    day: 'numeric',
    month: 'short',
  });
}

interface Props {
  offers: Offer[];
  customerMap: Record<string, string>;
}

export default function OpenOffersSection({ offers, customerMap }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Ανοιχτές προσφορές
        </h2>
        {offers.length > 0 && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
            {offers.length}
          </span>
        )}
      </div>

      {offers.length === 0 ? (
        <p className="text-sm text-zinc-500">Δεν υπάρχουν ανοιχτές προσφορές.</p>
      ) : (
        <ul className="space-y-2">
          {offers.map((offer) => {
            const customerName = offer.customerId ? customerMap[offer.customerId] : undefined;
            return (
              <li key={offer.id}>
                <Link
                  href={`/offers/${offer.id}`}
                  className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 transition hover:ring-indigo-200 active:bg-zinc-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900">
                          {customerName ?? 'Χωρίς πελάτη'}
                        </span>
                        <span className="text-xs text-zinc-400">{offer.offerNumber}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-zinc-700">{fmtEur(offer.total)}</span>
                        <OfferStatusBadge status={offer.status} />
                        <span className="text-zinc-400">
                          Ισχύει έως {formatDate(offer.validUntil)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
