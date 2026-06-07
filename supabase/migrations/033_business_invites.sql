-- Migration 033: Team invitations (multi-user per business).
--
-- Additive and idempotent. Safe to re-run.
--
-- Context: a business owner/admin invites a teammate by email. We store a
-- pending invite keyed by a hashed token (the raw token goes in the /join/<token>
-- link the owner sends). When the invited person logs in and opens the link, the
-- backend matches their email to the invite and creates a business_users
-- membership (role 'admin' | 'member'). Access then flows through the
-- membership-aware authenticateBusinessRequest (resolveBusinessContext).
--
-- business_users already exists (migration 001) with (business_id, user_id, role,
-- invited_at, accepted_at) — this table only tracks invites BEFORE the invitee
-- has accepted (and possibly before they even have an account).

CREATE TABLE IF NOT EXISTS public.business_invites (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  role        text        NOT NULL DEFAULT 'member',
  token_hash  text        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending',
  invited_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  PRIMARY KEY (id),
  CONSTRAINT business_invites_token_hash_key UNIQUE (token_hash),
  CONSTRAINT business_invites_role_check   CHECK (role   IN ('admin', 'member')),
  CONSTRAINT business_invites_status_check CHECK (status IN ('pending', 'accepted', 'revoked'))
);

CREATE INDEX IF NOT EXISTS business_invites_business_id_idx ON public.business_invites (business_id);
CREATE INDEX IF NOT EXISTS business_invites_email_idx       ON public.business_invites (lower(email));

ALTER TABLE public.business_invites ENABLE ROW LEVEL SECURITY;

-- All access goes through the backend (service_role). No anon/authenticated grants.
REVOKE ALL PRIVILEGES ON TABLE public.business_invites FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.business_invites FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.business_invites TO service_role;
