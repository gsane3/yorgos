import Link from 'next/link';
import type { Customer } from '@/lib/types';
import { isLikelyMobile } from '@/lib/phone';
import CustomerStatusBadge from './CustomerStatusBadge';

export const SOURCE_LABELS: Record<string, string> = {
  facebook_ads: 'Facebook Ads',
  google_ads: 'Google Ads',
  website_form: 'Φόρμα website',
  referral: 'Σύσταση',
  inbound_call: 'Εισερχόμενη κλήση',
  missed_call: 'Χαμένη κλήση',
  manual_entry: 'Χειροκίνητη καταχώρηση',
  other: 'Άλλο',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('el-GR', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

interface Props {
  customer: Customer;
}

export default function CustomerCard({ customer }: Props) {
  const mobilePhone = customer.mobilePhone || (customer.phone && isLikelyMobile(customer.phone) ? customer.phone : null);
  const landlinePhone = customer.landlinePhone || (customer.phone && !isLikelyMobile(customer.phone) && !customer.mobilePhone ? customer.phone : null);
  const displayPhone = mobilePhone || landlinePhone;

  return (
    <Link
      href={`/customers/${customer.id}`}
      className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-100 transition hover:ring-indigo-200 active:bg-zinc-50"
    >
      {/* Row 1: Name + CRM chip */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-bold text-zinc-900 leading-tight">{customer.name}</span>
        {customer.crmNumber && (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-400">
            {customer.crmNumber}
          </span>
        )}
        {customer.isDemo && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-600">
            Demo
          </span>
        )}
      </div>

      {/* Row 2: Company name */}
      {customer.companyName && (
        <p className="mt-0.5 text-xs text-zinc-500">{customer.companyName}</p>
      )}

      {/* Row 3: Status badge (max 1 prominent badge) */}
      <div className="mt-1.5">
        <CustomerStatusBadge status={customer.status} />
      </div>

      {/* Row 4: Value + phone  -  muted */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
        {customer.opportunityValue && (
          <span className="font-semibold text-zinc-700">
            €{customer.opportunityValue.toLocaleString('el-GR')}
          </span>
        )}
        {displayPhone && (
          <span>
            {mobilePhone ? 'Κιν.' : 'Σταθ.'} {displayPhone}
          </span>
        )}
        {customer.intakeStatus && customer.intakeStatus !== 'none' && customer.intakeStatus !== 'completed' && (
          <span className={
            customer.intakeStatus === 'no_response'
              ? 'text-red-500'
              : customer.intakeStatus === 'reminder_sent'
              ? 'text-amber-600'
              : 'text-zinc-400'
          }>
            {customer.intakeStatus === 'waiting_sms' ? 'Αναμονή SMS'
              : customer.intakeStatus === 'reminder_sent' ? 'Υπενθύμιση SMS'
              : customer.intakeStatus === 'no_response' ? 'Δεν απάντησε'
              : 'Πρόχειρη'}
          </span>
        )}
      </div>

      {/* Row 5: Last contact  -  very muted */}
      {customer.lastContactAt && (
        <p className="mt-1 text-xs text-zinc-400">
          Τελευταία επικοινωνία: {formatDate(customer.lastContactAt)}
        </p>
      )}
    </Link>
  );
}
