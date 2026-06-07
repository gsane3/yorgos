// POST/DELETE /api/push/register
//
// The native app registers its FCM/APNs device token here after the user grants
// notification permission. One row per device token (token is UNIQUE) so a token
// that moves between accounts is re-pointed rather than duplicated.
//
// Defensive: if migration 032 has not been applied, POST no-ops with
// degraded:true (never 500s) so an older DB doesn't break app startup.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateBusinessRequest } from '@/lib/api/auth';

export const runtime = 'nodejs';

const VALID_PLATFORMS = ['android', 'ios', 'web'] as const;
type Platform = (typeof VALID_PLATFORMS)[number];
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(request: NextRequest) {
  const auth = await authenticateBusinessRequest(request);
  if ('error' in auth) return auth.error;
  const { supabase, userId, businessId } = auth.ctx;

  let body: { token?: string; platform?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers: NO_STORE });
  }

  const token = (body.token ?? '').trim();
  const platform = (body.platform ?? '').trim();
  if (!token || token.length > 4096) {
    return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 400, headers: NO_STORE });
  }
  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json({ ok: false, error: 'invalid_platform' }, { status: 400, headers: NO_STORE });
  }

  try {
    const { error } = await supabase
      .from('device_push_tokens')
      .upsert(
        {
          token,
          platform,
          user_id: userId,
          business_id: businessId,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      );
    if (error) {
      // Most likely the table doesn't exist yet (migration 032 not applied).
      return NextResponse.json(
        { ok: false, error: 'push_register_unavailable', degraded: true },
        { status: 200, headers: NO_STORE }
      );
    }
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'push_register_unavailable', degraded: true },
      { status: 200, headers: NO_STORE }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateBusinessRequest(request);
  if ('error' in auth) return auth.error;
  const { supabase, userId } = auth.ctx;

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers: NO_STORE });
  }
  const token = (body.token ?? '').trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 400, headers: NO_STORE });
  }

  try {
    // Scope the delete to the caller so a user can only unregister their own token.
    await supabase.from('device_push_tokens').delete().eq('token', token).eq('user_id', userId);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: true, degraded: true }, { headers: NO_STORE });
  }
}
