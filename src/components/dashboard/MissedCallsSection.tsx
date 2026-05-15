import type { CallRecord } from '@/lib/types';
import { demoMissedCalls } from '@/lib/demo-data';

function DisabledBtn({ label }: { label: string }) {
  return (
    <button disabled className="cursor-not-allowed text-xs text-zinc-400">
      {label}
    </button>
  );
}

interface Props {
  callRecords: CallRecord[] | undefined;
  customerMap: Record<string, string>;
}

export default function MissedCallsSection({ callRecords }: Props) {
  // When calls data exists, show only real missed records.
  // Mock call flow creates 'completed' records, so this will normally be empty.
  if (callRecords !== undefined) {
    const missed = callRecords.filter((c) => c.status === 'missed');
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Χαμένες κλήσεις
          </h2>
          {missed.length > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              {missed.length}
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-500">
          Δεν υπάρχουν χαμένες κλήσεις αυτή τη στιγμή.
        </p>
      </section>
    );
  }

  // Demo fallback: user has never used the call mock
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Χαμένες κλήσεις
        </h2>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
          {demoMissedCalls.length}
        </span>
      </div>

      <ul className="space-y-2">
        {demoMissedCalls.map((call) => (
          <li
            key={call.id}
            className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold text-red-900">
                    {call.customerName ?? call.phoneDisplay}
                  </span>
                  {call.isUnknown && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
                      Άγνωστος αριθμός
                    </span>
                  )}
                </div>
                {call.customerName && (
                  <p className="mt-0.5 text-xs text-zinc-500">{call.phoneDisplay}</p>
                )}
                <p className="mt-0.5 text-xs text-zinc-500">{call.timeLabel}</p>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-4 w-4 text-red-600"
                  fill="none"
                  strokeWidth={2}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 6Z"
                  />
                </svg>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <DisabledBtn label="Κλήση πίσω" />
              <span className="text-zinc-200">·</span>
              {call.isUnknown ? (
                <DisabledBtn label="Προσθήκη στο CRM" />
              ) : (
                <DisabledBtn label="Άνοιγμα πελάτη" />
              )}
              <span className="text-zinc-200">·</span>
              <DisabledBtn label="Χειρίστηκα" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
