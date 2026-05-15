import type { CallRecord } from '@/lib/types';
import { demoRecentCalls } from '@/lib/demo-data';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} δευτ.`;
  const m = Math.floor(seconds / 60);
  return `${m} λεπτ.`;
}

function formatTime(isoStr: string): string {
  const date = new Date(isoStr);
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const dateStr = date.toISOString().split('T')[0];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const timeStr = date.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
  if (dateStr === todayStr) return `σήμερα ${timeStr}`;
  if (dateStr === yesterdayStr) return `χθες ${timeStr}`;
  return (
    date.toLocaleDateString('el-GR', { day: 'numeric', month: 'short' }) + ` ${timeStr}`
  );
}

function InboundIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-green-600"
      fill="none"
      strokeWidth={2}
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-label="Εισερχόμενη"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
    </svg>
  );
}

function OutboundIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-blue-500"
      fill="none"
      strokeWidth={2}
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-label="Εξερχόμενη"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 4.5 4.5 19.5m0 0h11.25m-11.25 0V8.25" />
    </svg>
  );
}

interface Props {
  callRecords: CallRecord[] | undefined;
  customerMap: Record<string, string>;
}

export default function RecentCallsSection({ callRecords, customerMap }: Props) {
  const isDemo = callRecords === undefined;

  // Demo fallback: user has never used the call mock
  if (isDemo) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Πρόσφατες κλήσεις
          </h2>
        </div>
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100 overflow-hidden">
          <ul className="divide-y divide-zinc-100">
            {demoRecentCalls.map((call) => (
              <li key={call.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-50 ring-1 ring-zinc-200">
                  {call.direction === 'inbound' ? <InboundIcon /> : <OutboundIcon />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800">{call.nameOrNumber}</p>
                  <p className="text-xs text-zinc-400">
                    {call.durationLabel} · {call.timeLabel}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-zinc-100 px-4 py-2.5">
            <p className="text-xs text-zinc-400">
              Demo κλήσεις. Δεν έγινε πραγματική τηλεφωνική κλήση ή ηχογράφηση.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Real call records — sorted newest first, limit 5
  const recent = [...callRecords]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 5);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Πρόσφατες κλήσεις
        </h2>
      </div>

      {recent.length === 0 ? (
        <p className="text-sm text-zinc-500">Δεν υπάρχουν πρόσφατες κλήσεις.</p>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100 overflow-hidden">
          <ul className="divide-y divide-zinc-100">
            {recent.map((call) => {
              const name = call.customerId ? customerMap[call.customerId] : undefined;
              return (
                <li key={call.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-50 ring-1 ring-zinc-200">
                    {call.direction === 'inbound' ? <InboundIcon /> : <OutboundIcon />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-800">
                      {name ?? 'Άγνωστος αριθμός'}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {formatDuration(call.durationSeconds)} · {formatTime(call.startedAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-zinc-100 px-4 py-2.5">
            <p className="text-xs text-zinc-400">
              Mock κλήσεις — δεν έγινε πραγματική τηλεφωνική κλήση ή ηχογράφηση.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
