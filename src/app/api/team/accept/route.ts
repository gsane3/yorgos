// POST /api/team/accept  { token }
//
// Called by an authenticated user opening a /join/<token> link. Unlike the other
// team routes it does NOT require the caller to already belong to a business
// (an invited person may have just signed up), so it authenticates the bearer
// directly instead of via authenticateBusinessRequest. It matches the caller's
// email to a pending invite and creates the business_users membership.

import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken } from '@/lib/api/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { hashInviteToken } from '@/lib/server/team-invites';

export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(request: NextRequest) {
  const bearer = getBearerToken(request);
  if (!bearer) {
    return NextResponse.json({ ok: false, error: 'missing_auth' }, { status: 401, headers: NO_STORE });
  }

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers: NO_STORE });
  }
  const rawToken = (body.token ?? '').trim();
  if (!rawToken) {
    return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 400, headers: NO_STORE });
  }

  let supabase: ReturnType<typeof createServerSupabaseClient>;
  try {
    supabase = createServerSupabaseClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 503, headers: NO_STORE });
  }

  // Identify the caller.
  let userId: string;
  let email: string | null;
  try {
    const { data, error } = await supabase.auth.getUser(bearer);
    if (error || !data.user) {
      return NextResponse.json({ ok: false, error: 'invalid_auth' }, { status: 401, headers: NO_STORE });
    }
    userId = data.user.id;
    email = (data.user.email ?? '').toLowerCase() || null;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_auth' }, { status: 401, headers: NO_STORE });
  }

  try {
    const nowIso = new Date().toISOString();
    const { data: inviteData } = await supabase
      .from('business_invites')
      .select('id, business_id, email, role, status, expires_at')
      .eq('token_hash', hashInviteToken(rawToken))
      .maybeSingle();
    const invite = inviteData as
      | { id: string; business_id: string; email: string; role: string; status: string; expires_at: string }
      | null;

    if (!invite || invite.status !== 'pending') {
      return NextResponse.json({ ok: false, error: 'invite_invalid' }, { status: 404, headers: NO_STORE });
    }
    if (invite.expires_at <= nowIso) {
      return NextResponse.json({ ok: false, error: 'invite_expired' }, { status: 410, headers: NO_STORE });
    }
    if (!email || email !== invite.email.toLowerCase()) {
      // The link is bound to the invited email; a different account cannot accept.
      return NextResponse.json({ ok: false, error: 'wrong_account', invitedEmail: invite.email }, { status: 403, headers: NO_STORE });
    }

    // Create the membership (idempotent on the PK).
    const { error: memberError } = await supabase
      .from('business_users')
      .upsert(
        {
          business_id: invite.business_id,
          user_id: userId,
          role: invite.role,
          accepted_at: nowIso,
        },
        { onConflict: 'business_id,user_id' }
      );
    if (memberError) {
      return NextResponse.json({ ok: false, error: 'accept_failed' }, { status: 500, headers: NO_STORE });
    }

    await supabase
      .from('business_invites')
      .update({ status: 'accepted', accepted_at: nowIso })
      .eq('id', invite.id);

    return NextResponse.json({ ok: true, businessId: invite.business_id, role: invite.role }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false, error: 'accept_failed' }, { status: 500, headers: NO_STORE });
  }
}
