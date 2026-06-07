// GET    /api/team/invites — list pending invites (owner/admin)
// POST   /api/team/invites — create an invite {email, role}; returns the join link
// DELETE /api/team/invites — revoke an invite {id}
//
// The owner sends the returned joinUrl to the teammate (Viber/email). When the
// teammate logs in and opens it, /api/team/accept attaches them.

import { NextRequest, NextResponse } from 'next/server';
import { authenticateBusinessRequest } from '@/lib/api/auth';
import { generateInviteToken, buildJoinUrl, isManager } from '@/lib/server/team-invites';

export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const VALID_ROLES = ['admin', 'member'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest) {
  const auth = await authenticateBusinessRequest(request);
  if ('error' in auth) return auth.error;
  const { supabase, businessId, role } = auth.ctx;
  if (!isManager(role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403, headers: NO_STORE });
  }
  try {
    const { data, error } = await supabase
      .from('business_invites')
      .select('id, email, role, status, created_at, expires_at')
      .eq('business_id', businessId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) {
      return NextResponse.json({ ok: true, invites: [], degraded: true }, { headers: NO_STORE });
    }
    return NextResponse.json({ ok: true, invites: data ?? [] }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: true, invites: [], degraded: true }, { headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateBusinessRequest(request);
  if ('error' in auth) return auth.error;
  const { supabase, businessId, userId, role } = auth.ctx;
  if (!isManager(role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403, headers: NO_STORE });
  }

  let body: { email?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers: NO_STORE });
  }
  const email = (body.email ?? '').trim().toLowerCase();
  const inviteRole = (body.role ?? 'member').trim();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400, headers: NO_STORE });
  }
  if (!VALID_ROLES.includes(inviteRole as (typeof VALID_ROLES)[number])) {
    return NextResponse.json({ ok: false, error: 'invalid_role' }, { status: 400, headers: NO_STORE });
  }

  try {
    const { raw, hash } = generateInviteToken();
    // Supersede any prior pending invite for the same email in this business.
    await supabase
      .from('business_invites')
      .update({ status: 'revoked' })
      .eq('business_id', businessId)
      .eq('email', email)
      .eq('status', 'pending');

    const { data, error } = await supabase
      .from('business_invites')
      .insert({ business_id: businessId, email, role: inviteRole, token_hash: hash, invited_by: userId })
      .select('id, email, role')
      .single();
    if (error || !data) {
      return NextResponse.json({ ok: false, error: 'invite_failed', degraded: true }, { status: 200, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true, invite: data, joinUrl: buildJoinUrl(raw) }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: false, error: 'invite_failed', degraded: true }, { status: 200, headers: NO_STORE });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateBusinessRequest(request);
  if ('error' in auth) return auth.error;
  const { supabase, businessId, role } = auth.ctx;
  if (!isManager(role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403, headers: NO_STORE });
  }
  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400, headers: NO_STORE });
  }
  const id = (body.id ?? '').trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400, headers: NO_STORE });
  }
  try {
    await supabase
      .from('business_invites')
      .update({ status: 'revoked' })
      .eq('id', id)
      .eq('business_id', businessId);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ ok: true, degraded: true }, { headers: NO_STORE });
  }
}
