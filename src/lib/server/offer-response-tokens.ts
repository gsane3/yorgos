import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Raw public token is never stored. Only the SHA-256 hex hash is written to DB.
// Public offer-response pages must call server API routes; they must not query
// Supabase directly with the anon key.

const TOKEN_BYTES = 32;
const DEFAULT_EXPIRY_HOURS = 168; // 7 days

interface ServerEnv {
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OfferResponseTokenStatus =
  | 'pending'
  | 'sent'
  | 'opened'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'revoked';

export type OfferResponseValue = 'accepted' | 'rejected';

export interface OfferResponseTokenRow {
  id: string;
  business_id: string;
  offer_id: string;
  token_hash: string;
  status: OfferResponseTokenStatus;
  sent_channel: 'viber' | 'sms' | 'email' | 'manual' | null;
  sent_to: string | null;
  expires_at: string;
  opened_at: string | null;
  responded_at: string | null;
  response: OfferResponseValue | null;
  response_comment: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOfferResponseTokenResult {
  rawToken: string;
  tokenHash: string;
  responseUrl: string;
  row: OfferResponseTokenRow;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function requireServerEnv(): ServerEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server env (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  };
}

// ---------------------------------------------------------------------------
// Exported helpers
// ---------------------------------------------------------------------------

export function createServiceSupabaseClient() {
  const env = requireServerEnv();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function generateRawOfferResponseToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashOfferResponseToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function getPublicAppUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (appUrl) {
    return appUrl.replace(/\/$/, '');
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'http://localhost:3000';
}

export function buildOfferResponseUrl(rawToken: string): string {
  return `${getPublicAppUrl()}/offer-response/${encodeURIComponent(rawToken)}`;
}

// ---------------------------------------------------------------------------
// createOfferResponseToken
// ---------------------------------------------------------------------------

export async function createOfferResponseToken(params: {
  businessId: string;
  offerId: string;
  sentChannel?: 'viber' | 'sms' | 'email' | 'manual' | null;
  sentTo?: string | null;
  expiryHours?: number;
}): Promise<CreateOfferResponseTokenResult> {
  const supabase = createServiceSupabaseClient();

  const rawToken = generateRawOfferResponseToken();
  const tokenHash = hashOfferResponseToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + (params.expiryHours ?? DEFAULT_EXPIRY_HOURS) * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from('offer_response_tokens')
    .insert({
      business_id: params.businessId,
      offer_id: params.offerId,
      token_hash: tokenHash,
      status: params.sentChannel ? 'sent' : 'pending',
      sent_channel: params.sentChannel ?? null,
      sent_to: params.sentTo ?? null,
      expires_at: expiresAt,
      updated_at: now.toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create offer response token: ${error.message}`);
  }

  return {
    rawToken,
    tokenHash,
    responseUrl: buildOfferResponseUrl(rawToken),
    row: data as OfferResponseTokenRow,
  };
}

// ---------------------------------------------------------------------------
// markOfferResponseTokenSent
// ---------------------------------------------------------------------------

export async function markOfferResponseTokenSent(params: {
  tokenId: string;
  sentChannel: 'viber' | 'sms' | 'email' | 'manual';
  sentTo?: string | null;
}): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('offer_response_tokens')
    .update({
      status: 'sent',
      sent_channel: params.sentChannel,
      sent_to: params.sentTo ?? null,
      updated_at: now,
    })
    .eq('id', params.tokenId)
    .eq('status', 'pending');

  if (error) {
    throw new Error(`Failed to mark offer response token sent: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// findValidOfferResponseToken
// ---------------------------------------------------------------------------

export async function findValidOfferResponseToken(
  rawToken: string
): Promise<OfferResponseTokenRow | null> {
  const supabase = createServiceSupabaseClient();
  const tokenHash = hashOfferResponseToken(rawToken);

  const { data, error } = await supabase
    .from('offer_response_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .in('status', ['pending', 'sent', 'opened'])
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find offer response token: ${error.message}`);
  }

  return data ? (data as OfferResponseTokenRow) : null;
}

// ---------------------------------------------------------------------------
// markOfferResponseTokenOpened
// ---------------------------------------------------------------------------

export async function markOfferResponseTokenOpened(tokenId: string): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('offer_response_tokens')
    .update({
      status: 'opened',
      opened_at: now,
      updated_at: now,
    })
    .eq('id', tokenId)
    .in('status', ['pending', 'sent']);

  if (error) {
    throw new Error(`Failed to mark offer response token opened: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// markOfferResponseTokenResponded
// ---------------------------------------------------------------------------

export async function markOfferResponseTokenResponded(params: {
  tokenId: string;
  response: OfferResponseValue;
  comment?: string | null;
}): Promise<void> {
  const supabase = createServiceSupabaseClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('offer_response_tokens')
    .update({
      status: params.response,
      response: params.response,
      response_comment: params.comment ?? null,
      responded_at: now,
      updated_at: now,
    })
    .eq('id', params.tokenId)
    .in('status', ['pending', 'sent', 'opened']);

  if (error) {
    throw new Error(`Failed to mark offer response token responded: ${error.message}`);
  }
}
