-- yorgos.ai Backend Phase 5 Offer Response Tokens
-- Secure public links that let customers accept or reject a sent offer.
--
-- Raw public tokens are never stored. Only SHA-256 hashes are written to this table.
-- Public offer-response pages must call server API routes that use service_role.
-- No authenticated or anonymous policies are created for this table by design.
-- See src/lib/server/offer-response-tokens.ts for the server-side helper.

CREATE TABLE IF NOT EXISTS public.offer_response_tokens (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  offer_id         uuid        NOT NULL,
  token_hash       text        NOT NULL,
  status           text        NOT NULL DEFAULT 'pending',
  sent_channel     text,
  sent_to          text,
  expires_at       timestamptz NOT NULL,
  opened_at        timestamptz,
  responded_at     timestamptz,
  response         text,
  response_comment text,
  revoked_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- Composite FK: guarantees offer_id belongs to the same business_id tenant.
  -- Requires the UNIQUE (business_id, id) constraint on public.offers (added in 007).
  CONSTRAINT offer_response_tokens_business_offer_fk
    FOREIGN KEY (business_id, offer_id)
    REFERENCES public.offers(business_id, id)
    ON DELETE CASCADE,

  CONSTRAINT offer_response_tokens_status_check
    CHECK (status IN ('pending', 'sent', 'opened', 'accepted', 'rejected', 'expired', 'revoked')),

  -- response is only written when the customer makes a final decision.
  CONSTRAINT offer_response_tokens_response_check
    CHECK (response IS NULL OR response IN ('accepted', 'rejected')),

  CONSTRAINT offer_response_tokens_sent_channel_check
    CHECK (sent_channel IS NULL OR sent_channel IN ('viber', 'sms', 'email', 'manual'))
);

-- Each raw token maps to exactly one hash row.
CREATE UNIQUE INDEX IF NOT EXISTS offer_response_tokens_token_hash_unique
  ON public.offer_response_tokens (token_hash);

CREATE INDEX IF NOT EXISTS offer_response_tokens_business_offer_idx
  ON public.offer_response_tokens (business_id, offer_id);

CREATE INDEX IF NOT EXISTS offer_response_tokens_status_expires_idx
  ON public.offer_response_tokens (status, expires_at);

CREATE INDEX IF NOT EXISTS offer_response_tokens_created_idx
  ON public.offer_response_tokens (created_at);

ALTER TABLE public.offer_response_tokens ENABLE ROW LEVEL SECURITY;

-- No authenticated or anon policies by design.
-- Token lookup and response recording happen only through trusted server API routes
-- that use the service_role key. This prevents customers from reading or mutating
-- offer_response_tokens rows directly through the Supabase client.

REVOKE ALL PRIVILEGES ON TABLE public.offer_response_tokens FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.offer_response_tokens FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.offer_response_tokens FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.offer_response_tokens TO service_role;
