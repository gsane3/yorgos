-- yorgos.ai Backend Phase 1 Initial Schema
-- Tables: businesses, business_users
-- Run this migration on a fresh Supabase project.
--
-- Phase 1 scope: one user, one business.
-- business_users exists from the start to support Phase 4+ team invitations.
-- Do not add customers, tasks, offers, email_send_logs, lead_source_connections,
-- or business_phone_numbers here. Those come in later migration files.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- gen_random_uuid() is available in Postgres 13+ (Supabase default).
-- Uncomment if your Supabase version requires it explicitly:
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS businesses (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                     text NOT NULL,
  type                     text,                         -- technical_services | sales_services | projects_construction | other
  phone                    text,
  email                    text,
  address                  text,
  vat_number               text,
  tax_office               text,
  logo_url                 text,
  default_vat_rate         numeric NOT NULL DEFAULT 24,
  default_offer_terms      text,
  default_acceptance_text  text,
  preferred_contact_method text NOT NULL DEFAULT 'phone', -- viber | email | phone
  -- Future Phase 4: verified sending domain for outbound email
  sending_domain           text,
  sending_from_email       text,
  -- Future Phase 6: provisioned VoIP number
  business_phone_number    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Phase 1: one user owns at most one business.
-- Remove this constraint in Phase 4 when a user can manage multiple businesses.
CREATE UNIQUE INDEX IF NOT EXISTS businesses_owner_id_unique
  ON businesses (owner_id);

-- ---------------------------------------------------------------------------
-- business_users
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS business_users (
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'owner',  -- owner | admin | member (Phase 4+)
  invited_at   timestamptz,
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, user_id)
);

CREATE INDEX IF NOT EXISTS business_users_user_id_idx
  ON business_users (user_id);

CREATE INDEX IF NOT EXISTS business_users_business_id_idx
  ON business_users (business_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Phase 1 starter policies.
-- These will be expanded after the auth flow and team invitations are built.
-- All policies use business_users membership as the access check.
-- ---------------------------------------------------------------------------

ALTER TABLE businesses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_users  ENABLE ROW LEVEL SECURITY;

-- businesses: SELECT
-- Phase 1: a user can see the business they own.
-- Phase 4: team membership access should be added with a non-recursive helper.
CREATE POLICY "businesses_select_own"
  ON businesses
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- businesses: INSERT
-- An authenticated user can create a business only if they are the owner.
-- Phase 1: one business per user (enforced by unique index above).
CREATE POLICY "businesses_insert_own"
  ON businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- business_users: SELECT
-- Phase 1: a user can see only their own membership row.
-- Phase 4: owner/admin team visibility should be added with a non-recursive helper.
CREATE POLICY "business_users_select_own"
  ON business_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- business_users: INSERT
-- An authenticated user can insert a business_users row for themselves
-- as owner when creating a new business.
-- Phase 4: expand this policy to allow owner-role users to invite others.
CREATE POLICY "business_users_insert_self"
  ON business_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- These starter policies intentionally avoid recursive membership checks.
-- UPDATE and DELETE policies are intentionally omitted in Phase 1.
-- Add them after the auth flow is complete and trust boundaries are clear.
