-- Migration 032: Device push-notification tokens (native app — Android/iOS).
--
-- Additive and idempotent (CREATE TABLE / INDEX / POLICY IF NOT EXISTS,
-- DROP POLICY IF EXISTS). No drops or renames. Safe to re-run.
--
-- Context: the Capacitor native wrapper registers each install for push
-- notifications and POSTs its FCM/APNs token to /api/push/register. The server
-- stores it here (one row per device token) so it can notify the business owner
-- when a customer responds to an offer / appointment, a new call comes in, etc.
--
-- All writes go through the backend (service_role) after the bearer token is
-- verified. A user may READ their own tokens; everything else is denied to anon.
-- The whole feature is INERT until the FCM service-account env is configured on
-- the server — this table simply collects tokens harmlessly in the meantime.

CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  token        text        NOT NULL,
  platform     text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT device_push_tokens_token_key UNIQUE (token),
  CONSTRAINT device_push_tokens_platform_check
    CHECK (platform IN ('android', 'ios', 'web'))
);

CREATE INDEX IF NOT EXISTS device_push_tokens_business_id_idx
  ON public.device_push_tokens (business_id);

CREATE INDEX IF NOT EXISTS device_push_tokens_user_id_idx
  ON public.device_push_tokens (user_id);

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

-- Users may read their own device tokens (e.g. to show "this device is
-- registered"). All writes go through the backend (service_role).
DROP POLICY IF EXISTS "device_push_tokens_select_own" ON public.device_push_tokens;
CREATE POLICY "device_push_tokens_select_own"
  ON public.device_push_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL PRIVILEGES ON TABLE public.device_push_tokens FROM anon;
GRANT SELECT                         ON TABLE public.device_push_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.device_push_tokens TO service_role;
