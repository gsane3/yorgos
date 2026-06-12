// POST /api/customers/[id]/pin  → { pinned: boolean }
//
// Pin/unpin a customer so active jobs float to the top of the list (F6).
// Tolerant of a not-yet-applied migration 044: returns 503 migration_pending
// when the column doesn't exist rather than 500.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateBusinessRequest } from '@/lib/api/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const pinned = (body as { pinned?: unknown }).pinned === true;

  const { error } = await supabase
    .from('customers')
    .update({ pinned, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: 'update_failed', hint: 'migration_044_pending' },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true, pinned });
}
