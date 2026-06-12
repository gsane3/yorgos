// DELETE /api/scheduled-messages/[id]  → cancel a pending scheduled message.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateBusinessRequest } from '@/lib/api/auth';

export const runtime = 'nodejs';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateBusinessRequest(request);
  if ('error' in auth) return auth.error;
  const { supabase, businessId } = auth.ctx;
  const { id } = await params;

  const { error } = await supabase
    .from('scheduled_messages')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('business_id', businessId)
    .eq('status', 'pending');

  if (error) return NextResponse.json({ ok: false, error: 'cancel_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
