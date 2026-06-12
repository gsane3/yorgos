// PATCH  /api/snippets/[id]   → edit { title?, body? }
// DELETE /api/snippets/[id]   → remove a snippet
//
// Tenant-scoped: every write is filtered by the caller's business_id.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateBusinessRequest } from '@/lib/api/auth';

export const runtime = 'nodejs';

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateBusinessRequest(request);
  if ('error' in auth) return auth.error;
  const { supabase, businessId } = auth.ctx;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('title' in raw) {
    const t = str(raw.title);
    if (!t || t.length > 80) return NextResponse.json({ ok: false, error: 'invalid_title' }, { status: 400 });
    updates.title = t;
  }
  if ('body' in raw) {
    const b = str(raw.body);
    if (!b || b.length > 1000) return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
    updates.body = b;
  }

  const { data, error } = await supabase
    .from('message_snippets')
    .update(updates)
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id, title, body, sort_order')
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  const r = data as { id: string; title: string; body: string; sort_order: number };
  return NextResponse.json({ ok: true, snippet: { id: r.id, title: r.title, body: r.body, sortOrder: r.sort_order } });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateBusinessRequest(request);
  if ('error' in auth) return auth.error;
  const { supabase, businessId } = auth.ctx;
  const { id } = await params;

  const { error } = await supabase
    .from('message_snippets')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) return NextResponse.json({ ok: false, error: 'delete_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
