// GET    /api/team/members  — list the business's members (+ emails, roles)
// DELETE /api/team/members  — remove a member (owner/admin only; not the owner/self)
//
// Defensive: if migration 001/033 tables are missing, degrades to ok:false
// degraded:true rather than 500.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateBusinessRequest } from '@/lib/api/auth';
import { isManager } from '@/lib/server/team-invites';

export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(request: NextRequest) {
  const auth = await authenticateBusinessRequest(request);
  if ('error' in auth) return auth.error;
  const { supabase, businessId, userId } = auth.ctx;

  try {
    const { data, error } = await supabase
      .from('business_users')
      .select('user_id, role, accepted_at, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true });
    if (error) {
      return NextResponse.json({ ok: false, error: 'team_unavailable', degraded: true }, { status: 200, headers: NO_STORE });
    }
    const rows = (data ?? []) as Array<{ user_id: string; role: string; accepted_at: string | null }>;
    const members = await Promise.all(
      rows.map(async (r) => {
        let email: string | null = null;
        try {
          const { data: u } = await supabase.auth.admin.getUserById(r.user_id);
          email = u?.user?.email ?? null;
        } catch {
          // ignore — show the row without an email rather than failing the list
        }
        return { userId: r.user_id, email, role: r.role, isYou: r.user_id === userId };
      })
    );
    return NextResponse.json({ ok: true, members, yourRole: auth.ctx.role }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false, error: 'team_unavailable', degraded: true }, { status: 200, headers: NO_STORE });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateBusinessRequest(request);
  if ('error' in auth) return auth.error;
  const { supabase, businessId, userId, role } = auth.ctx;

  if (!isManager(role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403, headers: NO_STORE });
  }

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers: NO_STORE });
  }
  const target = (body.userId ?? '').trim();
  if (!target) {
    return NextResponse.json({ ok: false, error: 'invalid_user' }, { status: 400, headers: NO_STORE });
  }
  if (target === userId) {
    return NextResponse.json({ ok: false, error: 'cannot_remove_self' }, { status: 400, headers: NO_STORE });
  }

  try {
    // Never remove an owner via this endpoint.
    const { data: targetRow } = await supabase
      .from('business_users')
      .select('role')
      .eq('business_id', businessId)
      .eq('user_id', target)
      .maybeSingle();
    if ((targetRow as { role?: string } | null)?.role === 'owner') {
      return NextResponse.json({ ok: false, error: 'cannot_remove_owner' }, { status: 400, headers: NO_STORE });
    }
    await supabase.from('business_users').delete().eq('business_id', businessId).eq('user_id', target);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false, error: 'team_unavailable', degraded: true }, { status: 200, headers: NO_STORE });
  }
}
