import type { Customer } from './types';

const HEADERS = [
  'crmNumber',
  'name',
  'companyName',
  'mobilePhone',
  'landlinePhone',
  'phone',
  'email',
  'address',
  'source',
  'status',
  'preferredContactMethod',
  'opportunityValue',
  'needsSummary',
  'notes',
  'createdAt',
  'updatedAt',
  'lastContactAt',
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function customerToRow(c: Customer): string {
  return [
    c.crmNumber,
    c.name,
    c.companyName,
    c.mobilePhone,
    c.landlinePhone,
    c.phone,
    c.email,
    c.address,
    c.source,
    c.status,
    c.preferredContactMethod,
    c.opportunityValue,
    c.needsSummary,
    c.notes,
    c.createdAt,
    c.updatedAt,
    c.lastContactAt,
  ].map(csvCell).join(',');
}

export function exportCustomersCsv(customers: Customer[]): string {
  const header = HEADERS.join(',');
  const rows = customers.map(customerToRow);
  // UTF-8 BOM keeps Greek text readable in Excel
  return '﻿' + [header, ...rows].join('\r\n');
}

export function downloadCustomersCsv(customers: Customer[]): void {
  const csv = exportCustomersCsv(customers);
  const date = new Date().toISOString().split('T')[0];
  const filename = `yorgos-customers-${date}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
