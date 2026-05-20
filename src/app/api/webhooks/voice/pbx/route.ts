// PBX post-call webhook receiver for the Inter Telecom/Asterisk PoC.
// Machine-to-machine route: no user auth token required.
// Stores raw call-completed events into provider_webhook_events (003_crm_core.sql).
// Business isolation and transcription pipeline are handled in later phases.

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return null;
}

function getBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/webhooks/voice/pbx -- health check
// ---------------------------------------------------------------------------

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'pbx_call_completed_webhook' });
}

// ---------------------------------------------------------------------------
// POST /api/webhooks/voice/pbx -- receive PBX call-completed event
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // Shared secret guard. Set PBX_WEBHOOK_SECRET in env to require the header.
  // Leave unset during local/dev PoC to allow unauthenticated requests through.
  const webhookSecret = process.env.PBX_WEBHOOK_SECRET ?? '';
  if (webhookSecret) {
    const headerSecret = request.headers.get('x-pbx-webhook-secret') ?? '';
    if (headerSecret !== webhookSecret) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  // Read raw body before parse -- preserves option for future HMAC verification.
  const rawBody = await request.text();
  if (!rawBody) {
    return NextResponse.json({ ok: false, error: 'empty_body' }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!isRecord(parsed)) {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  // Extract idempotency key: prefer event_id, fall back to call_id, else null.
  const eventId =
    getString(parsed['event_id']) ??
    getString(parsed['call_id']) ??
    null;

  // event_type defaults to 'call.completed' if absent from payload.
  const eventType = getString(parsed['event_type']) ?? getString(parsed['event']) ?? 'call.completed';

  const businessId = getString(process.env.PBX_BUSINESS_ID);
  if (!businessId) {
    return NextResponse.json({ ok: false, error: 'missing_pbx_business_id' }, { status: 503 });
  }

  const callerNumber = getString(parsed['caller_number']);
  const dialStatus = getString(parsed['dialstatus']);
  const uniqueId = getString(parsed['uniqueid']) ?? eventId;
  const recordingPath = getString(parsed['recording_path']);
  const recordingExists = getBoolean(parsed['recording_exists']);
  const recordingSizeBytes = getNumber(parsed['recording_size_bytes']);
  const recordingFallbackApplied = getBoolean(parsed['recording_fallback_applied']);
  const consentAnnounced = getBoolean(parsed['consent_announced']);

  // Initialise Supabase service-role client.
  let supabase: ReturnType<typeof createServerSupabaseClient>;
  try {
    supabase = createServerSupabaseClient();
  } catch (err) {
    if (err instanceof Error && err.message.includes('Missing Supabase server')) {
      return NextResponse.json({ ok: false, error: 'missing_supabase_config' }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: 'webhook_store_failed' }, { status: 500 });
  }

  try {
    let webhookEventId: string | null = null;

    // Idempotency check: if event_id is known, skip duplicate inserts.
    // The partial unique index (provider, event_id) WHERE event_id IS NOT NULL
    // also enforces this at the DB level, but a pre-check avoids a confusing
    // unique-constraint error on the client.
    if (eventId !== null) {
      const { data: existing } = await supabase
        .from('provider_webhook_events')
        .select('id, processed')
        .eq('provider', 'pbx')
        .eq('event_id', eventId)
        .maybeSingle();

      if (existing?.processed) {
        return NextResponse.json({ ok: true, received: true, duplicate: true });
      }

      if (existing && !existing.processed) {
        const existingCommunicationQuery = uniqueId
          ? await supabase
              .from('communications')
              .select('id')
              .eq('business_id', businessId)
              .eq('channel', 'call')
              .like('summary', `%uniqueid=${uniqueId}%`)
              .limit(1)
              .maybeSingle()
          : { data: null, error: null };

        if (existingCommunicationQuery.error) {
          return NextResponse.json({ ok: false, error: 'communication_lookup_failed' }, { status: 500 });
        }

        if (existingCommunicationQuery.data) {
          await supabase
            .from('provider_webhook_events')
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
              error_message: null,
            })
            .eq('id', existing.id);

          return NextResponse.json({
            ok: true,
            received: true,
            duplicate: true,
            communication_already_exists: true,
          });
        }

        webhookEventId = existing.id;
      }
    }

    // Insert raw event only when this is not an unprocessed duplicate.
    if (!webhookEventId) {
      const { data: insertedWebhookEvent, error: insertError } = await supabase
        .from('provider_webhook_events')
        .insert({
          provider: 'pbx',
          event_id: eventId,
          event_type: eventType,
          payload: parsed,
          processed: false,
        })
        .select('id')
        .single();

      if (insertError || !insertedWebhookEvent) {
        return NextResponse.json({ ok: false, error: 'webhook_store_failed' }, { status: 500 });
      }

      webhookEventId = insertedWebhookEvent.id;
    }

    const summaryParts = [
      'PBX inbound call completed.',
      uniqueId ? `uniqueid=${uniqueId}` : null,
      dialStatus ? `dialstatus=${dialStatus}` : null,
      recordingExists !== null ? `recording_exists=${recordingExists}` : null,
      recordingSizeBytes !== null ? `recording_size_bytes=${recordingSizeBytes}` : null,
      recordingFallbackApplied !== null ? `recording_fallback_applied=${recordingFallbackApplied}` : null,
      consentAnnounced !== null ? `consent_announced=${consentAnnounced}` : null,
      recordingPath ? `recording_path=${recordingPath}` : null,
    ].filter(Boolean).join(' ');

    const { error: communicationError } = await supabase
      .from('communications')
      .insert({
        business_id: businessId,
        customer_id: null,
        channel: 'call',
        direction: 'inbound',
        status: 'completed',
        phone: callerNumber,
        summary: summaryParts,
      });

    if (communicationError) {
      await supabase
        .from('provider_webhook_events')
        .update({
          error_message: communicationError.message,
        })
        .eq('id', webhookEventId);

      return NextResponse.json({ ok: false, error: 'communication_store_failed' }, { status: 500 });
    }

    await supabase
      .from('provider_webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', webhookEventId);

    return NextResponse.json({ ok: true, received: true, communication_created: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'webhook_store_failed' }, { status: 500 });
  }
}

