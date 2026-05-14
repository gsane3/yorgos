import { demoOpenOffers, type DemoOfferStatus } from '@/lib/demo-data';

const STATUS_LABELS: Record<DemoOfferStatus, string> = {
  draft: 'Πρόχειρη',
  ready_to_send: 'Έτοιμη για αποστολή',
};

function OfferStatusBadge({ status }: { status: DemoOfferStatus }) {
  if (status === 'ready_to_send') {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        {STATUS_LABELS[status]}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function OpenOffersSection() {
  const count = demoOpenOffers.length;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Ανοιχτές προσφορές
        </h2>
        {count > 0 && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
            {count}
          </span>
        )}
      </div>

      {count === 0 ? (
        <p className="text-sm text-zinc-500">Δεν υπάρχουν ανοιχτές προσφορές.</p>
      ) : (
        <ul className="space-y-2">
          {demoOpenOffers.map((offer) => (
            <li
              key={offer.id}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-100"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900">
                      {offer.customerName}
                    </span>
                    <span className="text-xs text-zinc-400">{offer.offerNumber}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-zinc-700">
                      €{offer.total.toLocaleString('el-GR')}
                    </span>
                    <OfferStatusBadge status={offer.status} />
                    <span className="text-zinc-400">
                      Ισχύει έως {offer.validUntilLabel}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
