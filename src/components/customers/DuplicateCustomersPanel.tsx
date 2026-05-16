'use client';

import { useState } from 'react';
import type { Customer } from '@/lib/types';
import { findDuplicateCustomerGroups, getCustomerPhoneKeys } from '@/lib/phone';

function scoreCustomer(c: Customer): number {
  let score = 0;
  const isTempName = /^Πελάτης #\d+/.test(c.name) || c.name.includes('Καταχώρηση');
  if (!isTempName && c.name) score += 4;
  if (c.crmNumber) score += 2;
  if (c.mobilePhone) score += 3;
  if (c.landlinePhone) score += 2;
  if (c.email) score += 3;
  if (c.address) score += 2;
  if (c.companyName) score += 2;
  if (c.notes) score += 1;
  return score;
}

function bestCustomerId(group: Customer[]): string {
  return [...group].sort((a, b) => scoreCustomer(b) - scoreCustomer(a))[0].id;
}

function getSharedPhone(group: Customer[]): string | null {
  const counts = new Map<string, number>();
  for (const c of group) {
    for (const k of getCustomerPhoneKeys(c)) {
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  for (const [k, n] of counts.entries()) {
    if (n > 1) return k;
  }
  return null;
}

interface Props {
  customers: Customer[];
  onMerge: (primaryId: string, duplicateId: string) => void;
}

export default function DuplicateCustomersPanel({ customers, onMerge }: Props) {
  const groups = findDuplicateCustomerGroups(customers);
  // selectedIds[groupIndex] = chosen primary id
  const [selectedIds, setSelectedIds] = useState<Record<number, string>>({});

  if (groups.length === 0) return null;

  function getSelectedId(groupIndex: number, group: Customer[]): string {
    return selectedIds[groupIndex] ?? bestCustomerId(group);
  }

  function handleMergeGroup(groupIndex: number, group: Customer[]) {
    const primaryId = getSelectedId(groupIndex, group);
    const duplicates = group.filter((c) => c.id !== primaryId);
    if (
      !window.confirm(
        `Να συγχωνευτούν οι διπλές καρτέλες στην επιλεγμένη βασική καρτέλα; ${duplicates.length} διπλή/ές θα διαγραφ${duplicates.length === 1 ? 'εί' : 'ούν'}. Δεν υπάρχει undo.`
      )
    )
      return;
    for (const dup of duplicates) {
      onMerge(primaryId, dup.id);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-amber-900">Πιθανές διπλές καρτέλες</p>
        <p className="text-xs text-amber-700">
          Επέλεξε ποια καρτέλα θα κρατηθεί ως βασική και συγχώνευσε τις υπόλοιπες.
        </p>
      </div>

      {groups.map((group, i) => {
        const selectedId = getSelectedId(i, group);
        const shared = getSharedPhone(group);

        return (
          <div key={i} className="rounded-2xl bg-white p-3 ring-1 ring-amber-100 space-y-3">
            {shared && (
              <p className="text-xs text-zinc-400">
                Κοινό τηλέφωνο: <span className="font-medium text-zinc-600">{shared}</span>
              </p>
            )}

            <div className="space-y-2">
              {group.map((c) => {
                const isSelected = selectedId === c.id;
                const isTempName =
                  /^Πελάτης #\d+/.test(c.name) || c.name.includes('Καταχώρηση');
                const displayPhone = c.mobilePhone || c.landlinePhone || c.phone;

                return (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 transition ${
                      isSelected
                        ? 'bg-indigo-50 ring-1 ring-indigo-200'
                        : 'bg-zinc-50 ring-1 ring-zinc-100 hover:bg-zinc-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`primary-${i}`}
                      value={c.id}
                      checked={isSelected}
                      onChange={() =>
                        setSelectedIds((prev) => ({ ...prev, [i]: c.id }))
                      }
                      className="mt-1 h-4 w-4 shrink-0 text-indigo-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-sm font-medium ${
                            isTempName ? 'text-zinc-400' : 'text-zinc-900'
                          }`}
                        >
                          {c.name}
                        </span>
                        {c.crmNumber && (
                          <span className="text-xs text-zinc-400">
                            Πελάτης {c.crmNumber}
                          </span>
                        )}
                        {isSelected && (
                          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                            Θα κρατηθεί
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                        {displayPhone && <span>{displayPhone}</span>}
                        {c.email && <span>{c.email}</span>}
                        {c.address && (
                          <span className="min-w-0 truncate">{c.address}</span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => handleMergeGroup(i, group)}
              className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-50"
            >
              Συγχώνευση επιλεγμένων
            </button>
          </div>
        );
      })}
    </div>
  );
}
