// GET  /api/customers/[id]/scheduled-messages  → pending scheduled messages
// POST /api/customers/[id]/scheduled-messages  → schedule { text, scheduledFor, channel? }
//
// Send-later texts (F4). The scheduled-messages cron dispatches due rows.
// Tolerant of a pending migration 044 (table missing → safe responses).

import { NextRequest, NextResponse } from 'next/server';
import { authenticateBusinessRequest } from '@/lib/api/auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateBusinessRequest(request);
  if ('error' in auth) return auth.error;
  const { supabase, businessId } = auth.ctx;
  const { id: customerId } = await params;

  const { data, error } = await supabase
    .from('scheduled_messages')
    .select('id, body, channel, scheduled_for, status')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true });

  if (error) return NextResponse.json({ ok: true, messages: [] }); // pre-044
  const messages = ((data ?? []) as Array<{ id: string; body: string; channel: string; scheduled_for: string; status: string }>).map((m) => ({
    id: m.id, body: m.body, channel: m.channel, scheduledFor: m.scheduled_for, status: m.status,
  }));
  return NextResponse.json({ ok: true, messages });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateBusinessRequest(request);
  if ('error' in auth) return auth.error;
  const { supabase, businessId } = auth.ctx;
  const { id: customerId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  const scheduledFor = typeof raw.scheduledFor === 'string' ? raw.scheduledFor : '';
  const channel = raw.channel === 'sms' || raw.channel === 'viber' ? raw.channel : 'auto';

  if (!text) return NextResponse.json({ ok: false, error: 'empty_text' }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ ok: false, error: 'too_long' }, { status: 400 });
  const when = new Date(scheduledFor);
  if (isNaN(when.getTime())) return NextResponse.json({ ok: false, error: 'invalid_date' }, { status: 400 });
  if (when.getTime() < Date.now() - 60_000) return NextResponse.json({ ok: false, error: 'past_date' }, { status: 400 });

  // Confirm the customer belongs to this business (and has a phone).
  const { data: cust } = await supabase
    .from('customers')
    .select('id, phone, mobile_phone, landline_phone')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .maybeSingle();
  if (!cust) return NextResponse.json({ ok: false, error: 'customer_not_found' }, { status: 404 });
  const c = cust as { phone: string | null; mobile_phone: string | null; landline_phone: string | null };
  if (!(c.mobile_phone || c.phone || c.landline_phone)) {
    return NextResponse.json({ ok: false, error: 'no_phone' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('scheduled_messages')
    .insert({
      business_id: businessId,
      customer_id: customerId,
      channel,
      body: text,
      scheduled_for: when.toISOString(),
      status: 'pending',
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'schedule_failed', hint: 'migration_044_pending' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, id: (data as { id: string }).id });
}
