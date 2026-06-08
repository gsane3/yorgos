import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { authenticateBusinessRequest } from '@/lib/api/auth';

export const runtime = 'nodejs';

// GET /api/phone/twilio-token
//
// Mints a short-lived Twilio Voice **access token** (JWT) for the authenticated
// business, used by the native app's Twilio Voice SDK (via the Capacitor plugin)
// to place + receive in-app calls. The identity is the business's stable SIP
// identity `biz_<id>` — the SAME identity Asterisk dials on the Twilio trunk for
// inbound, so an incoming Greek-DID call rings this device.
//
// ENV-GATED + INERT: until the Twilio env vars below are set the route returns
// { ok:true, ready:false, reason:'twilio_not_configured' } — exactly like the
// other optional integrations — so nothing breaks before Twilio is wired.
//
// Required env (server-only; never logged or returned):
//   TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID
// Optional:
//   TWILIO_PUSH_CREDENTIAL_SID  (the Push Credential = APNs VoIP + FCM key; needed
//                                for ring-when-killed, harmless to omit for outbound)

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const TOKEN_TTL_SECONDS = 3600;

/** Stable, Twilio-safe Client identity for a business: `biz_<hex>`. */
function businessIdentity(businessId: string): string {
  return `biz_${businessId.replace(/[^a-zA-Z0-9]/g, '')}`;
}

export async function GET(request: NextRequest) {
  const auth = await authenticateBusinessRequest(request);
  if ('error' in auth) return auth.error;
  const { businessId } = auth.ctx;

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const apiKey = process.env.TWILIO_API_KEY?.trim();
  const apiSecret = process.env.TWILIO_API_SECRET?.trim();
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID?.trim();
  const pushCredentialSid = process.env.TWILIO_PUSH_CREDENTIAL_SID?.trim() || undefined;

  if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
    return NextResponse.json(
      { ok: true, ready: false, reason: 'twilio_not_configured' },
      { headers: NO_STORE }
    );
  }

  try {
    const { AccessToken } = twilio.jwt;
    const VoiceGrant = AccessToken.VoiceGrant;

    const identity = businessIdentity(businessId);
    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity,
      ttl: TOKEN_TTL_SECONDS,
    });
    token.addGrant(
      new VoiceGrant({
        outgoingApplicationSid: twimlAppSid,
        pushCredentialSid,
        incomingAllow: true,
      })
    );

    return NextResponse.json(
      { ok: true, ready: true, token: token.toJwt(), identity, ttl: TOKEN_TTL_SECONDS },
      { headers: NO_STORE }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: 'twilio_token_failed' },
      { status: 500, headers: NO_STORE }
    );
  }
}
