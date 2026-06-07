// Single source of truth for multi-tenant API authentication.
//
// Every business-scoped API route should resolve its caller through
// authenticateBusinessRequest() instead of re-implementing the
// getBearerToken -> getUser -> getBusinessId dance. This guarantees the
// business_id filter is applied consistently and can't be forgotten.

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type SupabaseServer = ReturnType<typeof createServerSupabaseClient>;

export interface BusinessAuthContext {
  supabase: SupabaseServer;
  userId: string;
  businessId: string;
  /** The caller's role in the business: 'owner' | 'admin' | 'member'. */
  role: string;
}

export function getBearerToken(request: NextRequest): string | null {
  const h = request.headers.get('authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7);
}

/**
 * Resolves which business a user belongs to and their role.
 * Membership-first (business_users) so invited TEAM members get access, with a
 * legacy fallback to businesses.owner_id so the original owner ALWAYS resolves
 * (even for a business created before memberships existed). Returns null if the
 * user belongs to no business.
 */
export async function resolveBusinessContext(
  supabase: SupabaseServer,
  userId: string
): Promise<{ businessId: string; role: string } | null> {
  // 1) Accepted membership (owner OR invited member).
  try {
    const { data } = await supabase
      .from('business_users')
      .select('business_id, role')
      .eq('user_id', userId)
      .not('accepted_at', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    const row = data as { business_id?: string; role?: string } | null;
    if (row?.business_id) {
      return { businessId: row.business_id, role: row.role ?? 'member' };
    }
  } catch {
    // fall through to owner_id
  }

  // 2) Legacy fallback: the owner_id column on businesses.
  try {
    const { data } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle();
    const id = (data as { id?: string } | null)?.id;
    if (id) return { businessId: id, role: 'owner' };
  } catch {
    // no business
  }
  return null;
}

/**
 * Resolves the authenticated user and their business.
 * Returns either `{ ctx }` (proceed) or `{ error }` (a ready NextResponse to return).
 *
 * Usage:
 *   const auth = await authenticateBusinessRequest(req);
 *   if ('error' in auth) return auth.error;
 *   const { supabase, businessId } = auth.ctx;
 */
export async function authenticateBusinessRequest(
  request: NextRequest
): Promise<{ ctx: BusinessAuthContext } | { error: NextResponse }> {
  const token = getBearerToken(request);
  if (!token) {
    return { error: NextResponse.json({ ok: false, error: 'missing_auth' }, { status: 401 }) };
  }

  let supabase: SupabaseServer;
  try {
    supabase = createServerSupabaseClient();
  } catch {
    return { error: NextResponse.json({ ok: false, error: 'missing_supabase_config' }, { status: 503 }) };
  }

  let userId: string;
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { error: NextResponse.json({ ok: false, error: 'invalid_auth' }, { status: 401 }) };
    }
    userId = user.id;
  } catch {
    return { error: NextResponse.json({ ok: false, error: 'invalid_auth' }, { status: 401 }) };
  }

  const resolved = await resolveBusinessContext(supabase, userId);
  if (!resolved) {
    return { error: NextResponse.json({ ok: false, error: 'business_not_found' }, { status: 404 }) };
  }

  return { ctx: { supabase, userId, businessId: resolved.businessId, role: resolved.role } };
}
