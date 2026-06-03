-- deskop — all migrations combined (001→030), in order.
-- Paste into a FRESH Supabase project's SQL editor (Database → SQL). For an
-- EXISTING project, use the Supabase CLI 'supabase db push' instead (it applies
-- only the migrations you haven't run yet).


-- ====================================================================
-- 001_initial.sql
-- ====================================================================
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


-- ====================================================================
-- 002_grants.sql
-- ====================================================================
-- yorgos.ai Backend Phase 1 Data API Grants
--
-- These grants are required when Supabase project/table exposure is not automatic.
-- RLS still controls authenticated user access.
-- service_role is server-only and bypasses RLS, but grants are still explicit for API access.

grant usage on schema public to authenticated;
grant usage on schema public to service_role;

grant select, insert on table public.businesses to authenticated;
grant select, insert on table public.business_users to authenticated;

grant select, insert, update, delete on table public.businesses to service_role;
grant select, insert, update, delete on table public.business_users to service_role;


-- ====================================================================
-- 003_crm_core.sql
-- ====================================================================
-- yorgos.ai Backend Phase 3 CRM Core
-- Adds core CRM tables that are not blocked by voice provider selection.
-- Voice, recordings, transcripts, AI briefs, intake links, Viber messages, and offers are intentionally deferred.
--
-- Safe to run after 001_initial.sql and 002_grants.sql.
-- Uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS throughout.
-- Policy names are explicit; DROP POLICY IF EXISTS is used before each CREATE POLICY for idempotency.
-- updated_at columns are managed by the API layer, not by triggers, in Phase 3.

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
-- One row per CRM contact. Replaces the localStorage customers array.
-- crm_number is a display-only sequential label (#1, #2, ...) managed by the
-- API, not enforced as unique by the database in Phase 3.
-- phone, mobile_phone, landline_phone are stored in E.164 format by the API.
-- offer_drafts, call records, and intake links will add FK columns in later migrations.

CREATE TABLE IF NOT EXISTS public.customers (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id              uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  crm_number               text,
  name                     text,
  company_name             text,
  phone                    text,
  mobile_phone             text,
  landline_phone           text,
  email                    text,
  address                  text,
  source                   text,
  status                   text        NOT NULL DEFAULT 'new_lead',
  opportunity_value        numeric,
  needs_summary            text,
  notes                    text,
  preferred_contact_method text        NOT NULL DEFAULT 'phone',
  intake_status            text        NOT NULL DEFAULT 'none',
  last_contact_at          timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT customers_status_check
    CHECK (status IN ('new_lead', 'contacted', 'follow_up_needed', 'offer_drafted', 'offer_sent', 'won', 'lost')),

  CONSTRAINT customers_preferred_contact_method_check
    CHECK (preferred_contact_method IN ('viber', 'email', 'phone')),

  CONSTRAINT customers_intake_status_check
    CHECK (intake_status IN ('none', 'pending', 'sent', 'opened', 'submitted', 'expired', 'revoked')),

  CONSTRAINT customers_source_check
    CHECK (source IS NULL OR source IN (
      'facebook_ads', 'google_ads', 'website_form', 'referral',
      'inbound_call', 'missed_call', 'manual_entry', 'other'
    ))
);

CREATE INDEX IF NOT EXISTS customers_business_id_idx
  ON public.customers (business_id);

CREATE INDEX IF NOT EXISTS customers_business_phone_idx
  ON public.customers (business_id, phone);

CREATE INDEX IF NOT EXISTS customers_business_mobile_phone_idx
  ON public.customers (business_id, mobile_phone);

CREATE INDEX IF NOT EXISTS customers_business_status_idx
  ON public.customers (business_id, status);

CREATE INDEX IF NOT EXISTS customers_business_crm_number_idx
  ON public.customers (business_id, crm_number);

-- ---------------------------------------------------------------------------
-- communications
-- ---------------------------------------------------------------------------
-- Outbound/inbound communication log for calls, SMS, Viber, and email.
-- Serves as the backbone of the customer timeline.
-- customer_id is nullable to allow unmatched inbound events before matching.
-- Replaces the localStorage communications array and extends channel to include viber.

CREATE TABLE IF NOT EXISTS public.communications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  channel     text        NOT NULL,
  direction   text        NOT NULL,
  status      text        NOT NULL,
  phone       text,
  summary     text,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT communications_channel_check
    CHECK (channel IN ('call', 'sms', 'viber', 'email')),

  CONSTRAINT communications_direction_check
    CHECK (direction IN ('inbound', 'outbound')),

  CONSTRAINT communications_status_check
    CHECK (status IN ('started', 'sent', 'delivered', 'seen', 'failed', 'completed'))
);

CREATE INDEX IF NOT EXISTS communications_business_customer_idx
  ON public.communications (business_id, customer_id);

CREATE INDEX IF NOT EXISTS communications_business_channel_created_idx
  ON public.communications (business_id, channel, created_at);

CREATE INDEX IF NOT EXISTS communications_business_created_idx
  ON public.communications (business_id, created_at);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
-- Follow-up tasks and appointments. Replaces the localStorage tasks array.
-- status includes ai_draft for AI-proposed tasks pending user confirmation.
-- offer_id and source_brief_id are bare uuid columns without FK constraints;
-- the referenced tables (offers, ai_briefs) are deferred to later migrations.
-- FK constraints for those columns will be added via ALTER TABLE when
-- the referenced tables are created.

CREATE TABLE IF NOT EXISTS public.tasks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id     uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  offer_id        uuid,
  source_brief_id uuid,
  title           text        NOT NULL,
  type            text        NOT NULL,
  status          text        NOT NULL DEFAULT 'open',
  priority        text        NOT NULL DEFAULT 'normal',
  due_date        date        NOT NULL,
  due_time        text,
  note            text,
  created_from_ai boolean     NOT NULL DEFAULT false,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tasks_type_check
    CHECK (type IN (
      'call_back', 'send_offer', 'follow_up_offer', 'ask_for_photos_documents',
      'book_appointment', 'visit_customer', 'wait_for_reply', 'other'
    )),

  CONSTRAINT tasks_status_check
    CHECK (status IN ('open', 'completed', 'cancelled', 'ai_draft')),

  CONSTRAINT tasks_priority_check
    CHECK (priority IN ('low', 'normal', 'high')),

  CONSTRAINT tasks_due_time_format_check
    CHECK (due_time IS NULL OR due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

CREATE INDEX IF NOT EXISTS tasks_business_customer_status_idx
  ON public.tasks (business_id, customer_id, status);

CREATE INDEX IF NOT EXISTS tasks_business_due_status_idx
  ON public.tasks (business_id, due_date, status);

CREATE INDEX IF NOT EXISTS tasks_business_status_idx
  ON public.tasks (business_id, status);

-- ---------------------------------------------------------------------------
-- provider_webhook_events
-- ---------------------------------------------------------------------------
-- Immutable raw event log for all provider webhook payloads.
-- Enables idempotency, replay, and audit for Apifon, Telnyx, and future PBX.
-- event_id is nullable because not all providers include a stable event ID.
-- The partial unique index enforces idempotency when event_id is present.
-- No authenticated RLS policies: only service_role may access this table.

CREATE TABLE IF NOT EXISTS public.provider_webhook_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      text        NOT NULL,
  event_id      text,
  event_type    text,
  payload       jsonb       NOT NULL,
  processed     boolean     NOT NULL DEFAULT false,
  processed_at  timestamptz,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT provider_webhook_events_provider_check
    CHECK (provider IN ('apifon', 'telnyx', 'pbx'))
);

-- Partial unique index: only enforce uniqueness when event_id is not null.
-- This prevents duplicate processing of the same provider event.
CREATE UNIQUE INDEX IF NOT EXISTS provider_webhook_events_provider_event_id_unique
  ON public.provider_webhook_events (provider, event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_webhook_events_processed_created_idx
  ON public.provider_webhook_events (processed, created_at);

CREATE INDEX IF NOT EXISTS provider_webhook_events_created_idx
  ON public.provider_webhook_events (created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- All four tables have RLS enabled.
-- CRM tables (customers, communications, tasks) use business_users membership.
-- provider_webhook_events has RLS enabled but NO authenticated policies:
-- only service_role (which bypasses RLS) may read or write it server-side.

ALTER TABLE public.customers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_webhook_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS: customers
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "customers_select_business_members" ON public.customers;
CREATE POLICY "customers_select_business_members"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "customers_insert_business_members" ON public.customers;
CREATE POLICY "customers_insert_business_members"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "customers_update_business_members" ON public.customers;
CREATE POLICY "customers_update_business_members"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

-- DELETE policy intentionally omitted in Phase 3.

-- ---------------------------------------------------------------------------
-- RLS: communications
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "communications_select_business_members" ON public.communications;
CREATE POLICY "communications_select_business_members"
  ON public.communications
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "communications_insert_business_members" ON public.communications;
CREATE POLICY "communications_insert_business_members"
  ON public.communications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "communications_update_business_members" ON public.communications;
CREATE POLICY "communications_update_business_members"
  ON public.communications
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

-- DELETE policy intentionally omitted in Phase 3.

-- ---------------------------------------------------------------------------
-- RLS: tasks
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "tasks_select_business_members" ON public.tasks;
CREATE POLICY "tasks_select_business_members"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tasks_insert_business_members" ON public.tasks;
CREATE POLICY "tasks_insert_business_members"
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tasks_update_business_members" ON public.tasks;
CREATE POLICY "tasks_update_business_members"
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

-- DELETE policy intentionally omitted in Phase 3.

-- ---------------------------------------------------------------------------
-- RLS: provider_webhook_events
-- ---------------------------------------------------------------------------
-- No authenticated policies.
-- service_role bypasses RLS and accesses this table server-side only.
-- Authenticated users cannot read or write raw provider payloads.

-- (No policies created for provider_webhook_events by design.)

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- authenticated role: DML rights on CRM tables only.
-- NO grant to authenticated on provider_webhook_events.
-- service_role: full access on all four tables.

GRANT SELECT, INSERT, UPDATE ON public.customers               TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.communications          TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tasks                   TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers               TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communications          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks                   TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_webhook_events TO service_role;


-- ====================================================================
-- 004_harden_crm_core_grants.sql
-- ====================================================================
-- yorgos.ai Backend Phase 3 CRM Core Grants Hardening
-- Corrects role grants after 003_crm_core.sql.
-- 003 has already been applied, so this migration must be additive/corrective only.
--
-- Problem: after 003 was applied, role_table_grants showed extra privileges for
-- authenticated on customers, communications, tasks, and provider_webhook_events:
--   REFERENCES, TRIGGER, TRUNCATE
-- These are likely inherited from default role settings on table creation.
--
-- This migration explicitly revokes all privileges from authenticated and service_role
-- on the four CRM core tables, then re-grants only the intended permissions.
-- REVOKE/GRANT is idempotent and safe to re-run.
--
-- RLS is already enabled and correct from 003. This migration does not change RLS.

-- ---------------------------------------------------------------------------
-- authenticated: customers
-- ---------------------------------------------------------------------------
-- authenticated should have SELECT, INSERT, UPDATE only.
-- TRUNCATE, REFERENCES, and TRIGGER are not appropriate for application users.

REVOKE ALL PRIVILEGES ON TABLE public.customers FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.customers TO authenticated;

-- ---------------------------------------------------------------------------
-- authenticated: communications
-- ---------------------------------------------------------------------------

REVOKE ALL PRIVILEGES ON TABLE public.communications FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.communications TO authenticated;

-- ---------------------------------------------------------------------------
-- authenticated: tasks
-- ---------------------------------------------------------------------------

REVOKE ALL PRIVILEGES ON TABLE public.tasks FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tasks TO authenticated;

-- ---------------------------------------------------------------------------
-- authenticated: provider_webhook_events
-- ---------------------------------------------------------------------------
-- provider_webhook_events is service-role only.
-- authenticated must have no privileges on this table.
-- Raw provider event payloads must not be accessible to application users.

REVOKE ALL PRIVILEGES ON TABLE public.provider_webhook_events FROM authenticated;

-- No GRANT to authenticated for provider_webhook_events.

-- ---------------------------------------------------------------------------
-- service_role: all four tables
-- ---------------------------------------------------------------------------
-- service_role is used server-side only and bypasses RLS.
-- Normalize to exactly SELECT, INSERT, UPDATE, DELETE.

REVOKE ALL PRIVILEGES ON TABLE public.customers               FROM service_role;
REVOKE ALL PRIVILEGES ON TABLE public.communications          FROM service_role;
REVOKE ALL PRIVILEGES ON TABLE public.tasks                   FROM service_role;
REVOKE ALL PRIVILEGES ON TABLE public.provider_webhook_events FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers               TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.communications          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks                   TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.provider_webhook_events TO service_role;


-- ====================================================================
-- 005_customer_intake_tokens.sql
-- ====================================================================
-- yorgos.ai Option 2 Live Demo
-- Secure public intake links for customers created from inbound calls.
--
-- This table stores only token hashes, never raw public tokens.
-- Public intake pages must call server API routes that use service_role.
-- No authenticated or anonymous policies are created for this table.

CREATE TABLE IF NOT EXISTS public.customer_intake_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id   uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token_hash    text        NOT NULL,
  status        text        NOT NULL DEFAULT 'pending',
  sent_channel  text,
  sent_to_phone text,
  expires_at    timestamptz NOT NULL,
  opened_at     timestamptz,
  submitted_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT customer_intake_tokens_status_check
    CHECK (status IN ('pending', 'sent', 'opened', 'submitted', 'expired', 'revoked')),

  CONSTRAINT customer_intake_tokens_sent_channel_check
    CHECK (sent_channel IS NULL OR sent_channel IN ('viber', 'sms', 'manual'))
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_intake_tokens_token_hash_unique
  ON public.customer_intake_tokens (token_hash);

CREATE INDEX IF NOT EXISTS customer_intake_tokens_business_customer_idx
  ON public.customer_intake_tokens (business_id, customer_id);

CREATE INDEX IF NOT EXISTS customer_intake_tokens_status_expires_idx
  ON public.customer_intake_tokens (status, expires_at);

CREATE INDEX IF NOT EXISTS customer_intake_tokens_created_idx
  ON public.customer_intake_tokens (created_at);

ALTER TABLE public.customer_intake_tokens ENABLE ROW LEVEL SECURITY;

-- No authenticated or anon policies by design.
-- Intake token lookup and customer updates happen only through trusted server API routes.

REVOKE ALL PRIVILEGES ON TABLE public.customer_intake_tokens FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.customer_intake_tokens FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.customer_intake_tokens FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_intake_tokens TO service_role;


-- ====================================================================
-- 006_viber_messages.sql
-- ====================================================================
-- yorgos.ai Viber message persistence for Apifon intake delivery.
-- Stores one row per outbound Viber message sent, skipped, or failed.
-- Status fields are updated by the Apifon status callback webhook.
-- No authenticated or anon policies: only service_role accesses this table.
--
-- Safe to run after 003_crm_core.sql, 004_harden_crm_core_grants.sql,
-- and 005_customer_intake_tokens.sql.
-- Uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS throughout.

CREATE TABLE IF NOT EXISTS public.viber_messages (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id            uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id            uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  communication_id       uuid        REFERENCES public.communications(id) ON DELETE SET NULL,
  intake_token_id        uuid        REFERENCES public.customer_intake_tokens(id) ON DELETE SET NULL,
  provider               text        NOT NULL DEFAULT 'apifon',
  provider_request_id    text,
  provider_message_id    text,
  reference_id           text,
  recipient_phone        text,
  sender_id              text,
  status                 text        NOT NULL DEFAULT 'created',
  status_code            text,
  status_text            text,
  last_provider_event_id uuid        REFERENCES public.provider_webhook_events(id) ON DELETE SET NULL,
  raw_send_response      jsonb,
  raw_status_payload     jsonb,
  error                  text,
  sent_at                timestamptz,
  delivered_at           timestamptz,
  failed_at              timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Business + customer timeline queries
CREATE INDEX IF NOT EXISTS viber_messages_business_customer_created_idx
  ON public.viber_messages (business_id, customer_id, created_at);

-- Intake token lookup
CREATE INDEX IF NOT EXISTS viber_messages_intake_token_idx
  ON public.viber_messages (intake_token_id)
  WHERE intake_token_id IS NOT NULL;

-- Status monitoring
CREATE INDEX IF NOT EXISTS viber_messages_status_created_idx
  ON public.viber_messages (status, created_at);

-- Lookup by provider_message_id for Apifon status callback matching.
-- Partial unique: one row per provider + provider_message_id when present.
CREATE UNIQUE INDEX IF NOT EXISTS viber_messages_provider_message_id_unique
  ON public.viber_messages (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- Lookup by provider_request_id for Apifon status callback matching.
-- Partial unique: safe because Phase 3 sends to exactly one subscriber per request.
CREATE UNIQUE INDEX IF NOT EXISTS viber_messages_provider_request_id_unique
  ON public.viber_messages (provider, provider_request_id)
  WHERE provider_request_id IS NOT NULL;

-- Non-unique index for reference_id fallback lookups
CREATE INDEX IF NOT EXISTS viber_messages_reference_id_idx
  ON public.viber_messages (reference_id)
  WHERE reference_id IS NOT NULL;

ALTER TABLE public.viber_messages ENABLE ROW LEVEL SECURITY;

-- No authenticated or anon policies by design.
-- Viber message creation and status updates happen only through trusted server routes.

REVOKE ALL PRIVILEGES ON TABLE public.viber_messages FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.viber_messages FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.viber_messages FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.viber_messages TO service_role;


-- ====================================================================
-- 007_offers_core.sql
-- ====================================================================
-- yorgos.ai Backend Phase 5 Offers Core
-- Adds public.offers and public.offer_items tables.
-- Also backfills the deferred FK from public.tasks.offer_id to public.offers(id).
--
-- Safe to run after 003_crm_core.sql.
-- Uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS throughout.
-- Policy names are explicit; DROP POLICY IF EXISTS is used before each CREATE POLICY.
-- updated_at columns are managed by the API layer, not by triggers, consistent with Phase 3.
-- related_call_id is stored as bare uuid (no FK) because the calls/recordings table
-- is deferred to a later migration.

-- ---------------------------------------------------------------------------
-- offers
-- ---------------------------------------------------------------------------
-- One row per offer/quotation document.
-- Replaces the localStorage offers array.

CREATE TABLE IF NOT EXISTS public.offers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id     uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  related_task_id uuid        REFERENCES public.tasks(id) ON DELETE SET NULL,
  related_call_id uuid,
  offer_number    text        NOT NULL,
  status          text        NOT NULL DEFAULT 'draft',
  offer_date      date        NOT NULL DEFAULT current_date,
  valid_until     date,
  subtotal        numeric     NOT NULL DEFAULT 0,
  vat_rate        numeric     NOT NULL DEFAULT 24,
  vat_amount      numeric     NOT NULL DEFAULT 0,
  total           numeric     NOT NULL DEFAULT 0,
  notes           text,
  terms           text,
  acceptance_text text,
  viber_draft     text,
  email_subject   text,
  email_body      text,
  created_from_ai boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT offers_status_check
    CHECK (status IN (
      'draft', 'ready_to_send', 'sent_manually', 'accepted', 'rejected', 'expired'
    )),

  CONSTRAINT offers_subtotal_nonneg    CHECK (subtotal   >= 0),
  CONSTRAINT offers_vat_rate_nonneg    CHECK (vat_rate   >= 0),
  CONSTRAINT offers_vat_amount_nonneg  CHECK (vat_amount >= 0),
  CONSTRAINT offers_total_nonneg       CHECK (total      >= 0),

  -- Required so offer_items can FK on (business_id, id) to enforce tenant safety.
  CONSTRAINT offers_business_id_key    UNIQUE (business_id, id)
);

-- Unique offer number per business. Also serves as the index for number lookups.
CREATE UNIQUE INDEX IF NOT EXISTS offers_business_number_unique
  ON public.offers (business_id, offer_number);

CREATE INDEX IF NOT EXISTS offers_business_customer_status_idx
  ON public.offers (business_id, customer_id, status);

CREATE INDEX IF NOT EXISTS offers_business_status_date_idx
  ON public.offers (business_id, status, offer_date);

-- ---------------------------------------------------------------------------
-- offer_items
-- ---------------------------------------------------------------------------
-- Line items for each offer, ordered by sort_order within an offer.

CREATE TABLE IF NOT EXISTS public.offer_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  offer_id    uuid        NOT NULL,
  description text        NOT NULL,
  quantity    numeric     NOT NULL DEFAULT 1,
  unit_price  numeric     NOT NULL DEFAULT 0,
  line_total  numeric     NOT NULL DEFAULT 0,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT offer_items_quantity_pos       CHECK (quantity    > 0),
  CONSTRAINT offer_items_unit_price_nonneg  CHECK (unit_price  >= 0),
  CONSTRAINT offer_items_line_total_nonneg  CHECK (line_total  >= 0),

  -- Composite FK: guarantees offer_id belongs to the same business_id tenant.
  -- Replaces a plain offer_id -> offers(id) FK, which would allow cross-tenant references.
  CONSTRAINT offer_items_business_offer_fk
    FOREIGN KEY (business_id, offer_id)
    REFERENCES public.offers(business_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS offer_items_business_offer_sort_idx
  ON public.offer_items (business_id, offer_id, sort_order);

-- ---------------------------------------------------------------------------
-- Backfill deferred FK: tasks.offer_id -> offers(id)
-- ---------------------------------------------------------------------------
-- tasks was created with offer_id uuid (no FK) because offers did not exist yet.
-- Now that offers exists, add the constraint idempotently.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  constraint_name = 'tasks_offer_id_fkey'
      AND  table_schema    = 'public'
      AND  table_name      = 'tasks'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_offer_id_fkey
      FOREIGN KEY (offer_id)
      REFERENCES public.offers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.offers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_items ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS: offers
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "offers_select_business_members" ON public.offers;
CREATE POLICY "offers_select_business_members"
  ON public.offers
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "offers_insert_business_members" ON public.offers;
CREATE POLICY "offers_insert_business_members"
  ON public.offers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "offers_update_business_members" ON public.offers;
CREATE POLICY "offers_update_business_members"
  ON public.offers
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

-- DELETE policy intentionally omitted, consistent with Phase 3 CRM tables.

-- ---------------------------------------------------------------------------
-- RLS: offer_items
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "offer_items_select_business_members" ON public.offer_items;
CREATE POLICY "offer_items_select_business_members"
  ON public.offer_items
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "offer_items_insert_business_members" ON public.offer_items;
CREATE POLICY "offer_items_insert_business_members"
  ON public.offer_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "offer_items_update_business_members" ON public.offer_items;
CREATE POLICY "offer_items_update_business_members"
  ON public.offer_items
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

-- DELETE policy intentionally omitted, consistent with Phase 3 CRM tables.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON public.offers      TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.offer_items TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers      TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_items TO service_role;


-- ====================================================================
-- 008_offer_response_tokens.sql
-- ====================================================================
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


-- ====================================================================
-- 009_appointment_response_tokens.sql
-- ====================================================================
-- yorgos.ai Backend Phase 5 Appointment Response Tokens
-- Secure public links that let customers accept, decline, or request a time change
-- for a scheduled appointment (stored in public.tasks).
--
-- Raw public tokens are never stored. Only SHA-256 hashes are written to this table.
-- Public appointment-response pages must call server API routes that use service_role.
-- No authenticated or anonymous policies are created for this table by design.
-- See src/lib/server/appointment-response-tokens.ts for the server-side helper.

-- ---------------------------------------------------------------------------
-- Ensure public.tasks has UNIQUE (business_id, id) so we can create a composite FK.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conrelid = 'public.tasks'::regclass
    AND    conname  = 'tasks_business_id_id_key'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_business_id_id_key UNIQUE (business_id, id);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Main table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.appointment_response_tokens (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id          uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  task_id              uuid        NOT NULL,
  token_hash           text        NOT NULL,
  status               text        NOT NULL DEFAULT 'pending',
  sent_channel         text        NOT NULL DEFAULT 'manual',
  sent_to              text,
  expires_at           timestamptz NOT NULL,
  opened_at            timestamptz,
  responded_at         timestamptz,
  response             text,
  response_comment     text,
  requested_due_date   date,
  requested_due_time   text,
  revoked_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  -- Composite FK: guarantees task_id belongs to the same business_id tenant.
  -- Requires the UNIQUE (business_id, id) constraint on public.tasks (added above).
  CONSTRAINT appointment_response_tokens_business_task_fk
    FOREIGN KEY (business_id, task_id)
    REFERENCES public.tasks(business_id, id)
    ON DELETE CASCADE,

  CONSTRAINT appointment_response_tokens_status_check
    CHECK (status IN ('pending', 'sent', 'opened', 'accepted', 'declined',
                      'time_change_requested', 'expired', 'revoked')),

  -- response is only written when the customer makes a final decision.
  CONSTRAINT appointment_response_tokens_response_check
    CHECK (response IS NULL OR response IN ('accepted', 'declined', 'time_change_requested')),

  CONSTRAINT appointment_response_tokens_sent_channel_check
    CHECK (sent_channel IN ('viber', 'sms', 'email', 'manual')),

  -- HH:MM format validation for requested_due_time.
  CONSTRAINT appointment_response_tokens_requested_due_time_check
    CHECK (requested_due_time IS NULL OR
           requested_due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

COMMENT ON TABLE public.appointment_response_tokens IS
  'Public appointment-response pages must call server API routes using service_role. Raw public tokens are never stored.';
-- Each raw token maps to exactly one hash row.
CREATE UNIQUE INDEX IF NOT EXISTS appointment_response_tokens_token_hash_unique
  ON public.appointment_response_tokens (token_hash);

CREATE INDEX IF NOT EXISTS appointment_response_tokens_business_task_idx
  ON public.appointment_response_tokens (business_id, task_id);

CREATE INDEX IF NOT EXISTS appointment_response_tokens_status_expires_idx
  ON public.appointment_response_tokens (status, expires_at);

CREATE INDEX IF NOT EXISTS appointment_response_tokens_created_idx
  ON public.appointment_response_tokens (created_at);

ALTER TABLE public.appointment_response_tokens ENABLE ROW LEVEL SECURITY;

-- No authenticated or anon policies by design.
-- Token lookup and response recording happen only through trusted server API routes
-- that use the service_role key. This prevents customers from reading or mutating
-- appointment_response_tokens rows directly through the Supabase client.

REVOKE ALL PRIVILEGES ON TABLE public.appointment_response_tokens FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.appointment_response_tokens FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.appointment_response_tokens FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.appointment_response_tokens TO service_role;


-- ====================================================================
-- 010_phone_number_pool.sql
-- ====================================================================
-- yorgos.ai Phone Number Pool
-- Adds managed_phone_numbers (admin-populated pool) and business_phone_numbers
-- (per-business assignment). Adds the atomic assignment function
-- public.assign_available_phone_number.
--
-- Safe to run after 001_initial.sql.
-- Uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS throughout.
-- Policy names are explicit. DROP POLICY IF EXISTS precedes each CREATE POLICY.
-- managed_phone_numbers is not accessible to authenticated users.
-- Pool inventory is admin/service_role only.
-- business_phone_numbers is readable by business members via RLS but
-- writable only by service_role (assignment is backend-only).

-- ---------------------------------------------------------------------------
-- managed_phone_numbers
-- ---------------------------------------------------------------------------
-- Pool of Inter Telecom (or future provider) numbers imported by an admin.
-- One row per E.164 number. Status moves from available to assigned when the
-- assignment function runs after a business is created.
-- No authenticated RLS policies: only service_role may read or write.

CREATE TABLE IF NOT EXISTS public.managed_phone_numbers (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  e164_number  text        NOT NULL,
  provider     text        NOT NULL DEFAULT 'intertelecom',
  provider_ref text,
  status       text        NOT NULL DEFAULT 'available',
  imported_at  timestamptz NOT NULL DEFAULT now(),
  assigned_at  timestamptz,
  retired_at   timestamptz,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT managed_phone_numbers_e164_unique
    UNIQUE (e164_number),

  CONSTRAINT managed_phone_numbers_status_check
    CHECK (status IN ('available', 'assigned', 'reserved', 'retired'))
);

CREATE INDEX IF NOT EXISTS managed_phone_numbers_status_idx
  ON public.managed_phone_numbers (status);

CREATE INDEX IF NOT EXISTS managed_phone_numbers_provider_idx
  ON public.managed_phone_numbers (provider);

-- ---------------------------------------------------------------------------
-- business_phone_numbers
-- ---------------------------------------------------------------------------
-- One row per business that has been assigned a managed number.
-- Created by the assignment function, never by authenticated users.
-- Business members may SELECT their own row only.

CREATE TABLE IF NOT EXISTS public.business_phone_numbers (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid        NOT NULL REFERENCES public.businesses(id)           ON DELETE CASCADE,
  managed_phone_number_id uuid        NOT NULL REFERENCES public.managed_phone_numbers(id),
  e164_number             text        NOT NULL,
  provider                text        NOT NULL DEFAULT 'intertelecom',
  status                  text        NOT NULL DEFAULT 'active',
  forward_to              text,
  recording_enabled       boolean     NOT NULL DEFAULT false,
  assigned_at             timestamptz NOT NULL DEFAULT now(),
  released_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT business_phone_numbers_business_id_unique
    UNIQUE (business_id),

  CONSTRAINT business_phone_numbers_managed_phone_number_id_unique
    UNIQUE (managed_phone_number_id),

  CONSTRAINT business_phone_numbers_e164_unique
    UNIQUE (e164_number),

  CONSTRAINT business_phone_numbers_status_check
    CHECK (status IN ('active', 'suspended', 'released'))
);

CREATE INDEX IF NOT EXISTS business_phone_numbers_business_id_idx
  ON public.business_phone_numbers (business_id);

CREATE INDEX IF NOT EXISTS business_phone_numbers_e164_idx
  ON public.business_phone_numbers (e164_number);

CREATE INDEX IF NOT EXISTS business_phone_numbers_status_idx
  ON public.business_phone_numbers (status);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.managed_phone_numbers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_phone_numbers ENABLE ROW LEVEL SECURITY;

-- managed_phone_numbers: no authenticated policies by design.
-- Pool inventory must not be visible to application users.
-- service_role bypasses RLS and is the only accessor.

-- business_phone_numbers: SELECT for business members only.
-- No authenticated INSERT/UPDATE/DELETE. Assignment is backend-only.

DROP POLICY IF EXISTS "business_phone_numbers_select_business_members" ON public.business_phone_numbers;
CREATE POLICY "business_phone_numbers_select_business_members"
  ON public.business_phone_numbers
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- managed_phone_numbers: no grant to authenticated or anon.
-- service_role has full access.

REVOKE ALL PRIVILEGES ON TABLE public.managed_phone_numbers   FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.managed_phone_numbers   FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.managed_phone_numbers   FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.managed_phone_numbers TO service_role;

-- business_phone_numbers: authenticated may SELECT (RLS enforces per-business scope).
-- No INSERT/UPDATE/DELETE for authenticated. service_role has full access.

REVOKE ALL PRIVILEGES ON TABLE public.business_phone_numbers  FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.business_phone_numbers  FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.business_phone_numbers  FROM service_role;

GRANT SELECT                             ON TABLE public.business_phone_numbers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE     ON TABLE public.business_phone_numbers TO service_role;

-- ---------------------------------------------------------------------------
-- Atomic phone number assignment function
-- ---------------------------------------------------------------------------
-- Called server-side via service_role RPC immediately after a business is created.
-- Idempotent: if the business already has an active number, returns it unchanged.
-- Concurrency-safe: uses FOR UPDATE SKIP LOCKED on managed_phone_numbers.
-- SECURITY DEFINER with explicit search_path prevents search-path injection.
-- Execute is restricted to service_role only.

CREATE OR REPLACE FUNCTION public.assign_available_phone_number(
  p_business_id uuid
)
RETURNS TABLE (
  assigned                boolean,
  managed_phone_number_id uuid,
  e164_number             text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_mpn_id  uuid;
  v_existing_e164    text;
  v_pool_id          uuid;
  v_pool_e164        text;
  v_pool_provider    text;
BEGIN
  -- Idempotency check: if this business already has an active assigned number, return it.
  SELECT bpn.managed_phone_number_id, bpn.e164_number
  INTO   v_existing_mpn_id, v_existing_e164
  FROM   public.business_phone_numbers bpn
  WHERE  bpn.business_id = p_business_id
    AND  bpn.status = 'active'
  LIMIT  1;

  IF v_existing_mpn_id IS NOT NULL THEN
    RETURN QUERY SELECT true, v_existing_mpn_id, v_existing_e164;
    RETURN;
  END IF;

  -- Attempt to lock one available number from the pool.
  -- FOR UPDATE SKIP LOCKED ensures two concurrent calls pick different rows.
  SELECT   mpn.id, mpn.e164_number, mpn.provider
  INTO     v_pool_id, v_pool_e164, v_pool_provider
  FROM     public.managed_phone_numbers mpn
  WHERE    mpn.status = 'available'
  ORDER BY mpn.imported_at ASC
  LIMIT    1
  FOR UPDATE SKIP LOCKED;

  -- Pool is empty or all available rows are locked by another transaction.
  IF v_pool_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Mark pool number as assigned.
  UPDATE public.managed_phone_numbers
  SET    status      = 'assigned',
         assigned_at = now(),
         updated_at  = now()
  WHERE  id = v_pool_id;

  -- Insert business assignment row.
  INSERT INTO public.business_phone_numbers (
    business_id,
    managed_phone_number_id,
    e164_number,
    provider,
    status,
    assigned_at
  ) VALUES (
    p_business_id,
    v_pool_id,
    v_pool_e164,
    v_pool_provider,
    'active',
    now()
  );

  -- Populate businesses.business_phone_number for quick single-column access.
  UPDATE public.businesses
  SET    business_phone_number = v_pool_e164
  WHERE  id = p_business_id;

  RETURN QUERY SELECT true, v_pool_id, v_pool_e164;
END;
$$;

-- Restrict execute: revoke from PUBLIC and authenticated, grant only to service_role.
-- SECURITY DEFINER functions are executable by PUBLIC by default in PostgreSQL,
-- so an explicit revoke is required.
REVOKE EXECUTE ON FUNCTION public.assign_available_phone_number(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_available_phone_number(uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.assign_available_phone_number(uuid) TO service_role;


-- ====================================================================
-- 011_browser_sip_endpoints.sql
-- ====================================================================
-- yorgos.ai Browser SIP Endpoint Metadata
-- Adds browser_sip_endpoints (per-business endpoint metadata for future WebRTC calling).
-- Adds the idempotent function public.ensure_browser_sip_endpoint.
--
-- Safe to run after 010_phone_number_pool.sql.
-- Uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS throughout.
-- Policy names are explicit. DROP POLICY IF EXISTS precedes each CREATE POLICY.
--
-- IMPORTANT: This table stores endpoint metadata only.
-- No SIP password column. No trunk/provider credentials. No password hash.
-- Password provisioning is deferred to a future migration after Asterisk WSS
-- is confirmed working and the managed number model is commercially confirmed.
--
-- browser_sip_endpoints is readable by business members via RLS but
-- writable only by service_role (provisioning is backend-only).

-- ---------------------------------------------------------------------------
-- browser_sip_endpoints
-- ---------------------------------------------------------------------------
-- One row per business browser SIP endpoint.
-- Created by ensure_browser_sip_endpoint, never by authenticated users.
-- Status lifecycle: planned -> active -> suspended | revoked.

CREATE TABLE IF NOT EXISTS public.browser_sip_endpoints (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid        NOT NULL REFERENCES public.businesses(id)             ON DELETE CASCADE,
  business_phone_number_id uuid       REFERENCES public.business_phone_numbers(id)          ON DELETE SET NULL,
  user_id                 uuid        REFERENCES auth.users(id)                             ON DELETE SET NULL,
  sip_username            text        NOT NULL,
  sip_realm               text,
  wss_url                 text,
  endpoint_type           text        NOT NULL DEFAULT 'browser',
  status                  text        NOT NULL DEFAULT 'planned',
  expires_at              timestamptz,
  last_issued_at          timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT browser_sip_endpoints_sip_username_unique
    UNIQUE (sip_username),

  CONSTRAINT browser_sip_endpoints_status_check
    CHECK (status IN ('planned', 'active', 'suspended', 'revoked')),

  CONSTRAINT browser_sip_endpoints_endpoint_type_check
    CHECK (endpoint_type IN ('browser'))
);

CREATE INDEX IF NOT EXISTS browser_sip_endpoints_business_id_idx
  ON public.browser_sip_endpoints (business_id);

CREATE INDEX IF NOT EXISTS browser_sip_endpoints_business_phone_number_id_idx
  ON public.browser_sip_endpoints (business_phone_number_id);

CREATE INDEX IF NOT EXISTS browser_sip_endpoints_user_id_idx
  ON public.browser_sip_endpoints (user_id);

CREATE INDEX IF NOT EXISTS browser_sip_endpoints_status_idx
  ON public.browser_sip_endpoints (status);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.browser_sip_endpoints ENABLE ROW LEVEL SECURITY;

-- browser_sip_endpoints: SELECT for business members only.
-- Authenticated users may read endpoint rows for businesses they belong to
-- through business_users. No authenticated INSERT/UPDATE/DELETE.
-- Provisioning is backend-only via service_role.

DROP POLICY IF EXISTS "browser_sip_endpoints_select_business_members" ON public.browser_sip_endpoints;
CREATE POLICY "browser_sip_endpoints_select_business_members"
  ON public.browser_sip_endpoints
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- browser_sip_endpoints: authenticated may SELECT (RLS enforces per-business scope).
-- No INSERT/UPDATE/DELETE for authenticated. service_role has full access.

REVOKE ALL PRIVILEGES ON TABLE public.browser_sip_endpoints FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.browser_sip_endpoints FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.browser_sip_endpoints FROM service_role;

GRANT SELECT                         ON TABLE public.browser_sip_endpoints TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.browser_sip_endpoints TO service_role;

-- ---------------------------------------------------------------------------
-- Idempotent browser SIP endpoint creation function
-- ---------------------------------------------------------------------------
-- Called server-side via service_role RPC when the browser requests endpoint
-- readiness state.
-- Idempotent: if the business already has a non-revoked endpoint, returns it.
-- Only creates an endpoint if the business has an active business_phone_numbers row.
-- If no active number is assigned, returns an empty result set (0 rows).
-- sip_username is deterministic: 'biz_' || business_id without hyphens.
-- No SIP password is generated or stored in this slice.
-- SECURITY DEFINER with explicit search_path prevents search-path injection.
-- Execute is restricted to service_role only.

CREATE OR REPLACE FUNCTION public.ensure_browser_sip_endpoint(
  p_business_id uuid,
  p_user_id     uuid DEFAULT NULL
)
RETURNS TABLE (
  sip_username    text,
  status          text,
  wss_url         text,
  expires_at      timestamptz,
  last_issued_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bpn_id         uuid;
  v_computed_user  text;
BEGIN
  -- Require an active business_phone_numbers row before creating any endpoint.
  SELECT bpn.id
  INTO   v_bpn_id
  FROM   public.business_phone_numbers bpn
  WHERE  bpn.business_id = p_business_id
    AND  bpn.status = 'active'
  LIMIT  1;

  -- No active number assigned. Return empty result to signal the caller.
  IF v_bpn_id IS NULL THEN
    RETURN;
  END IF;

  -- Deterministic sip_username derived from business_id. Not a secret.
  v_computed_user := 'biz_' || replace(p_business_id::text, '-', '');

  -- Insert a planned endpoint if no non-revoked endpoint exists for this business.
  -- ON CONFLICT (sip_username) DO NOTHING handles the concurrent-insert race condition:
  -- if two calls race past the WHERE NOT EXISTS check, the loser is silently ignored
  -- and the subsequent SELECT returns the winner's row.
  INSERT INTO public.browser_sip_endpoints (
    business_id,
    business_phone_number_id,
    user_id,
    sip_username,
    status
  )
  SELECT
    p_business_id,
    v_bpn_id,
    p_user_id,
    v_computed_user,
    'planned'
  WHERE NOT EXISTS (
    SELECT 1
    FROM   public.browser_sip_endpoints bse
    WHERE  bse.business_id = p_business_id
      AND  bse.status != 'revoked'
  )
  ON CONFLICT (sip_username) DO NOTHING;

  -- Return the current non-revoked endpoint for this business.
  RETURN QUERY
    SELECT bse.sip_username,
           bse.status,
           bse.wss_url,
           bse.expires_at,
           bse.last_issued_at
    FROM   public.browser_sip_endpoints bse
    WHERE  bse.business_id = p_business_id
      AND  bse.status != 'revoked'
    LIMIT  1;
END;
$$;

-- Restrict execute: revoke from PUBLIC and authenticated, grant only to service_role.
-- SECURITY DEFINER functions are executable by PUBLIC by default in PostgreSQL,
-- so an explicit revoke is required.
REVOKE EXECUTE ON FUNCTION public.ensure_browser_sip_endpoint(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_browser_sip_endpoint(uuid, uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_browser_sip_endpoint(uuid, uuid) TO service_role;


-- ====================================================================
-- 012_call_processing_audit.sql
-- ====================================================================
-- Track D: Call Processing Audit Fields
-- Adds nullable lifecycle timestamps and an error code column to communications.
-- These fields let the pbx-recording pipeline record when each processing stage
-- completed and confirm that audio/transcript were never persisted.
--
-- Audio and transcript are held in RAM only during the recording request.
-- Neither is written to any storage or database column.
-- The discarded_at timestamps record the moment the pipeline confirmed this.
--
-- All columns are nullable. Existing rows are not backfilled.
-- Idempotent: ADD COLUMN IF NOT EXISTS throughout.
-- No RLS changes, no grant changes, no indexes in this slice.

-- recording_received_at: set when the pbx-recording endpoint accepts the audio upload.
ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS recording_received_at timestamptz;

-- transcription_started_at: set immediately before audio is sent to the transcription API.
ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS transcription_started_at timestamptz;

-- brief_created_at: set after the AI brief text is returned and validated.
ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS brief_created_at timestamptz;

-- audio_discarded_at: set after the brief is saved to the database.
-- Confirms that the audio file was processed and not persisted anywhere.
-- Audio arrived in RAM only and was discarded when the request handler returned.
ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS audio_discarded_at timestamptz;

-- transcript_discarded_at: set alongside audio_discarded_at after brief is saved.
-- Confirms that transcript text was used only for brief generation and not retained.
ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS transcript_discarded_at timestamptz;

-- processing_failed_at: set on any terminal failure in the recording pipeline.
-- Null means the pipeline either succeeded or has not yet run for this row.
ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS processing_failed_at timestamptz;

-- processing_error_code: short machine-readable error category, set alongside
-- processing_failed_at. Contains only safe non-secret strings such as
-- 'transcription_failed', 'brief_generation_failed', or 'communication_not_found'.
-- Never contains secrets, tokens, API responses, or caller data.
ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS processing_error_code text;


-- ====================================================================
-- 013_phone_number_pool_v2.sql
-- ====================================================================
-- Track B: Phone Number Pool v2
-- Adds city support, extended lifecycle (cooling_down, suspended),
-- number_type for future customer-ported numbers, cooldown timestamps,
-- and an assignment history table.
--
-- Safe to run after 010_phone_number_pool.sql.
-- All column additions use ADD COLUMN IF NOT EXISTS.
-- CHECK constraint changes use DO blocks for idempotency.
-- No backfill. No application code changes. No billing schema.
-- The existing assign_available_phone_number function is not changed.

-- ---------------------------------------------------------------------------
-- managed_phone_numbers: new columns
-- ---------------------------------------------------------------------------

-- city is nullable because current businesses only have a free-text address field.
-- Populate via the admin import API when adding numbers to a city-specific pool.
-- Used by the assignment function in a future slice to prefer city-matched numbers.
ALTER TABLE public.managed_phone_numbers
  ADD COLUMN IF NOT EXISTS city text;

-- number_type supports platform-owned numbers now and customer-ported numbers later.
-- All existing rows default to platform_owned. customer_ported support comes in a later slice.
ALTER TABLE public.managed_phone_numbers
  ADD COLUMN IF NOT EXISTS number_type text NOT NULL DEFAULT 'platform_owned';

-- cooling_down_since: set when the number enters cooling_down status after a release.
-- available_after: stored (not computed) as cooling_down_since + 18 months.
--   Stored at release/cancellation time so the policy period can be reviewed
--   independently of historical rows.
ALTER TABLE public.managed_phone_numbers
  ADD COLUMN IF NOT EXISTS cooling_down_since timestamptz;

ALTER TABLE public.managed_phone_numbers
  ADD COLUMN IF NOT EXISTS available_after timestamptz;

-- ---------------------------------------------------------------------------
-- managed_phone_numbers: status CHECK constraint
-- ---------------------------------------------------------------------------

-- Drop the old constraint from 010_phone_number_pool.sql which only allowed
-- available, assigned, reserved, retired.
-- The replacement below adds suspended and cooling_down.
ALTER TABLE public.managed_phone_numbers
  DROP CONSTRAINT IF EXISTS managed_phone_numbers_status_check;

-- New status check. Named v2 so the DO block can detect it idempotently.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'managed_phone_numbers_status_check_v2'
      AND conrelid = 'public.managed_phone_numbers'::regclass
  ) THEN
    ALTER TABLE public.managed_phone_numbers
      ADD CONSTRAINT managed_phone_numbers_status_check_v2
        CHECK (status IN (
          'available',
          'assigned',
          'reserved',
          'suspended',
          'cooling_down',
          'retired'
        ));
  END IF;
END;
$$;

-- number_type check. DO block for idempotency.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'managed_phone_numbers_number_type_check'
      AND conrelid = 'public.managed_phone_numbers'::regclass
  ) THEN
    ALTER TABLE public.managed_phone_numbers
      ADD CONSTRAINT managed_phone_numbers_number_type_check
        CHECK (number_type IN ('platform_owned', 'customer_ported'));
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- businesses: city column
-- ---------------------------------------------------------------------------

-- city is nullable free-text, consistent with the existing address column style.
-- Populated during onboarding in a future slice.
-- Matched against managed_phone_numbers.city for city-based assignment.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS city text;

-- ---------------------------------------------------------------------------
-- business_phone_number_assignment_history
-- ---------------------------------------------------------------------------
-- Append-only log. One row per assignment lifecycle event.
-- Records each time a managed number was assigned to a business and later released.
-- Rows are never updated in place: new rows are inserted on assignment and release.
-- service_role only in this slice: not exposed to authenticated users yet.

CREATE TABLE IF NOT EXISTS public.business_phone_number_assignment_history (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid        NOT NULL
    REFERENCES public.businesses(id) ON DELETE CASCADE,
  managed_phone_number_id uuid
    REFERENCES public.managed_phone_numbers(id) ON DELETE SET NULL,
  e164_number             text        NOT NULL,
  provider                text        NOT NULL DEFAULT 'intertelecom',
  status                  text        NOT NULL DEFAULT 'assigned',
  assigned_at             timestamptz NOT NULL DEFAULT now(),
  released_at             timestamptz,
  release_reason          text,
  cooling_down_until      timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bpnah_status_check
    CHECK (status IN ('assigned', 'released', 'cooling_down'))
);

CREATE INDEX IF NOT EXISTS bpnah_business_id_idx
  ON public.business_phone_number_assignment_history (business_id);

CREATE INDEX IF NOT EXISTS bpnah_managed_phone_number_id_idx
  ON public.business_phone_number_assignment_history (managed_phone_number_id);

CREATE INDEX IF NOT EXISTS bpnah_e164_number_idx
  ON public.business_phone_number_assignment_history (e164_number);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.business_phone_number_assignment_history ENABLE ROW LEVEL SECURITY;

-- No authenticated RLS policies: assignment history is internal.
-- service_role bypasses RLS and is the only accessor in this slice.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL PRIVILEGES ON TABLE public.business_phone_number_assignment_history FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.business_phone_number_assignment_history FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.business_phone_number_assignment_history FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.business_phone_number_assignment_history TO service_role;


-- ====================================================================
-- 014_city_based_phone_assignment.sql
-- ====================================================================
-- Track B: City-based phone number assignment
-- Replaces the single-argument assign_available_phone_number(p_business_id) with a
-- two-argument version that accepts an optional city hint.
--
-- Backward compatibility:
--   Old call: assign_available_phone_number(p_business_id)
--     -> p_city defaults to NULL, behavior is identical to previous version.
--   New call: assign_available_phone_number(p_business_id, p_city)
--     -> prefers an available number tagged with that city; falls back to global pool.
--
-- The old single-argument overload is dropped first to prevent ambiguity.
-- All other application code is unchanged.

-- ---------------------------------------------------------------------------
-- Drop old single-argument function
-- ---------------------------------------------------------------------------
-- Required: PostgreSQL cannot replace a function by adding a defaulted parameter
-- without leaving both overloads. Dropping the old signature ensures only one
-- version exists and the existing single-argument RPC call resolves cleanly.

DROP FUNCTION IF EXISTS public.assign_available_phone_number(uuid);

-- ---------------------------------------------------------------------------
-- New function: assign_available_phone_number(p_business_id, p_city)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assign_available_phone_number(
  p_business_id uuid,
  p_city        text DEFAULT NULL
)
RETURNS TABLE (
  assigned                boolean,
  managed_phone_number_id uuid,
  e164_number             text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_mpn_id  uuid;
  v_existing_e164    text;
  v_pool_id          uuid;
  v_pool_e164        text;
  v_pool_provider    text;
  v_trimmed_city     text;
BEGIN
  -- Idempotency: if this business already has an active assignment, return it unchanged.
  SELECT bpn.managed_phone_number_id, bpn.e164_number
  INTO   v_existing_mpn_id, v_existing_e164
  FROM   public.business_phone_numbers bpn
  WHERE  bpn.business_id = p_business_id
    AND  bpn.status = 'active'
  LIMIT  1;

  IF v_existing_mpn_id IS NOT NULL THEN
    RETURN QUERY SELECT true, v_existing_mpn_id, v_existing_e164;
    RETURN;
  END IF;

  -- Normalise city hint: collapse empty string and surrounding whitespace to NULL.
  v_trimmed_city := NULLIF(TRIM(COALESCE(p_city, '')), '');

  -- Step 1 (city match): if a city hint is present, try to lock the oldest available
  -- platform_owned number whose city matches case-insensitively.
  -- NULL city on a pool number is never matched (LOWER(NULL) IS NULL).
  IF v_trimmed_city IS NOT NULL THEN
    SELECT   mpn.id, mpn.e164_number, mpn.provider
    INTO     v_pool_id, v_pool_e164, v_pool_provider
    FROM     public.managed_phone_numbers mpn
    WHERE    mpn.status      = 'available'
      AND    mpn.number_type = 'platform_owned'
      AND    LOWER(TRIM(mpn.city)) = LOWER(v_trimmed_city)
    ORDER BY mpn.imported_at ASC
    LIMIT    1
    FOR UPDATE SKIP LOCKED;
  END IF;

  -- Step 2 (global fallback): if no city-matched number was found, pick the oldest
  -- available platform_owned number regardless of city.
  IF v_pool_id IS NULL THEN
    SELECT   mpn.id, mpn.e164_number, mpn.provider
    INTO     v_pool_id, v_pool_e164, v_pool_provider
    FROM     public.managed_phone_numbers mpn
    WHERE    mpn.status      = 'available'
      AND    mpn.number_type = 'platform_owned'
    ORDER BY mpn.imported_at ASC
    LIMIT    1
    FOR UPDATE SKIP LOCKED;
  END IF;

  -- Pool exhausted or all candidate rows are locked by a concurrent transaction.
  IF v_pool_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Mark the pool number as assigned. Clear any residual cooldown fields that
  -- could be present if the number was previously released.
  UPDATE public.managed_phone_numbers
  SET    status             = 'assigned',
         assigned_at        = now(),
         cooling_down_since = NULL,
         available_after    = NULL,
         updated_at         = now()
  WHERE  id = v_pool_id;

  -- Insert the business assignment row.
  INSERT INTO public.business_phone_numbers (
    business_id,
    managed_phone_number_id,
    e164_number,
    provider,
    status,
    assigned_at
  ) VALUES (
    p_business_id,
    v_pool_id,
    v_pool_e164,
    v_pool_provider,
    'active',
    now()
  );

  -- Update the denormalised column on businesses for fast single-column access.
  -- Also backfill businesses.city from the hint when the business has none yet.
  -- This does not overwrite a city the business already has.
  UPDATE public.businesses
  SET    business_phone_number = v_pool_e164,
         city = CASE
                  WHEN v_trimmed_city IS NOT NULL AND city IS NULL THEN v_trimmed_city
                  ELSE city
                END
  WHERE  id = p_business_id;

  -- Append an assignment record to the history log.
  INSERT INTO public.business_phone_number_assignment_history (
    business_id,
    managed_phone_number_id,
    e164_number,
    provider,
    status,
    assigned_at
  ) VALUES (
    p_business_id,
    v_pool_id,
    v_pool_e164,
    v_pool_provider,
    'assigned',
    now()
  );

  RETURN QUERY SELECT true, v_pool_id, v_pool_e164;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Apply the same access model as migration 010: service_role only.
-- The function is SECURITY DEFINER so it runs as the definer regardless,
-- but restricting EXECUTE prevents unauthorised direct calls.

REVOKE EXECUTE ON FUNCTION public.assign_available_phone_number(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_available_phone_number(uuid, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.assign_available_phone_number(uuid, text) TO service_role;


-- ====================================================================
-- 015_release_phone_number_cooldown.sql
-- ====================================================================
-- Track B: Release business phone number into 18-month cooldown
--
-- Adds public.release_business_phone_number(p_business_id, p_release_reason).
--
-- Behavior by number_type:
--   platform_owned  -> status = 'cooling_down' for 18 months; cannot be reassigned
--                      until available_after has elapsed (a separate admin process
--                      moves it back to 'available').
--   customer_ported -> no platform cooldown; status management left to operator;
--                      assignment row is released and history is recorded.
--
-- This function does NOT add billing logic, does NOT expire cooldown automatically,
-- and does NOT touch the assign_available_phone_number function.

-- ---------------------------------------------------------------------------
-- Function: release_business_phone_number
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.release_business_phone_number(
  p_business_id   uuid,
  p_release_reason text DEFAULT 'cancelled'
)
RETURNS TABLE (
  released                boolean,
  managed_phone_number_id uuid,
  e164_number             text,
  available_after         timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bpn_mpn_id    uuid;
  v_bpn_e164      text;
  v_number_type   text;
  v_provider      text;
  v_now           timestamptz;
  v_available_after timestamptz;
BEGIN
  v_now := now();

  -- Find and lock the active business_phone_numbers row.
  -- FOR UPDATE prevents a concurrent release or re-assignment from racing.
  SELECT bpn.managed_phone_number_id, bpn.e164_number
  INTO   v_bpn_mpn_id, v_bpn_e164
  FROM   public.business_phone_numbers bpn
  WHERE  bpn.business_id = p_business_id
    AND  bpn.status = 'active'
  FOR UPDATE;

  -- No active assignment: nothing to release.
  IF v_bpn_mpn_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- Lock the managed_phone_numbers row to prevent concurrent assignment.
  SELECT mpn.number_type, mpn.provider
  INTO   v_number_type, v_provider
  FROM   public.managed_phone_numbers mpn
  WHERE  mpn.id = v_bpn_mpn_id
  FOR UPDATE;

  -- ---------------------------------------------------------------------------
  -- platform_owned: enter 18-month cooling_down period
  -- ---------------------------------------------------------------------------
  IF v_number_type = 'platform_owned' THEN

    v_available_after := v_now + interval '18 months';

    -- Move pool number into cooling_down state.
    UPDATE public.managed_phone_numbers
    SET    status             = 'cooling_down',
           cooling_down_since = v_now,
           available_after    = v_available_after,
           assigned_at        = NULL,
           updated_at         = v_now
    WHERE  id = v_bpn_mpn_id;

    -- Mark business assignment as released.
    UPDATE public.business_phone_numbers
    SET    status      = 'released',
           released_at = v_now,
           updated_at  = v_now
    WHERE  business_id = p_business_id
      AND  status      = 'active';

    -- Clear the denormalised column on businesses.
    UPDATE public.businesses
    SET    business_phone_number = NULL
    WHERE  id = p_business_id;

    -- Append history record.
    INSERT INTO public.business_phone_number_assignment_history (
      business_id,
      managed_phone_number_id,
      e164_number,
      provider,
      status,
      released_at,
      release_reason,
      cooling_down_until
    ) VALUES (
      p_business_id,
      v_bpn_mpn_id,
      v_bpn_e164,
      v_provider,
      'cooling_down',
      v_now,
      p_release_reason,
      v_available_after
    );

    RETURN QUERY SELECT true, v_bpn_mpn_id, v_bpn_e164, v_available_after;
    RETURN;

  END IF;

  -- ---------------------------------------------------------------------------
  -- customer_ported: release without platform cooldown
  -- No automatic status change on managed_phone_numbers; operator handles porting.
  -- ---------------------------------------------------------------------------

  -- Mark business assignment as released.
  UPDATE public.business_phone_numbers
  SET    status      = 'released',
         released_at = v_now,
         updated_at  = v_now
  WHERE  business_id = p_business_id
    AND  status      = 'active';

  -- Clear the denormalised column on businesses.
  UPDATE public.businesses
  SET    business_phone_number = NULL
  WHERE  id = p_business_id;

  -- Append history record with status = 'released' (no cooldown).
  INSERT INTO public.business_phone_number_assignment_history (
    business_id,
    managed_phone_number_id,
    e164_number,
    provider,
    status,
    released_at,
    release_reason
  ) VALUES (
    p_business_id,
    v_bpn_mpn_id,
    v_bpn_e164,
    v_provider,
    'released',
    v_now,
    p_release_reason
  );

  RETURN QUERY SELECT true, v_bpn_mpn_id, v_bpn_e164, NULL::timestamptz;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Same access model as assign_available_phone_number: service_role only.
-- SECURITY DEFINER functions are PUBLIC-executable by default; explicit revoke required.

REVOKE EXECUTE ON FUNCTION public.release_business_phone_number(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_business_phone_number(uuid, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.release_business_phone_number(uuid, text) TO service_role;


-- ====================================================================
-- 016_expire_phone_number_cooldowns.sql
-- ====================================================================
-- Track B: Expire phone number cooldowns
--
-- Adds public.expire_phone_number_cooldowns(p_limit).
--
-- Purpose: move platform_owned numbers from status = 'cooling_down' back to
-- status = 'available' once their 18-month available_after window has elapsed.
--
-- This function is intentionally side-effect-only (no UI, no scheduler, no cron).
-- George or a service-role backend job calls it on demand or on a schedule.
-- It never touches customer_ported, assigned, suspended, reserved, or retired rows.

-- ---------------------------------------------------------------------------
-- Function: expire_phone_number_cooldowns
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.expire_phone_number_cooldowns(
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  processed_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit     integer;
  v_processed integer;
BEGIN
  -- Normalize p_limit: default 100, cap at 500.
  v_limit := CASE
    WHEN p_limit IS NULL OR p_limit < 1 THEN 100
    WHEN p_limit > 500               THEN 500
    ELSE p_limit
  END;

  -- Select eligible rows with FOR UPDATE SKIP LOCKED so concurrent calls
  -- do not race on the same rows. ORDER BY available_after ASC ensures the
  -- oldest cooldowns are restored first (FIFO).
  WITH eligible AS (
    SELECT id
    FROM   public.managed_phone_numbers
    WHERE  status        = 'cooling_down'
      AND  number_type   = 'platform_owned'
      AND  available_after IS NOT NULL
      AND  available_after <= now()
    ORDER BY available_after ASC
    LIMIT  v_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.managed_phone_numbers mpn
  SET    status             = 'available',
         cooling_down_since = NULL,
         available_after    = NULL,
         assigned_at        = NULL,
         updated_at         = now()
  FROM   eligible
  WHERE  mpn.id = eligible.id;

  GET DIAGNOSTICS v_processed = ROW_COUNT;

  -- History rows are not written here.
  -- business_phone_number_assignment_history.status has a CHECK constraint
  -- that only permits ('assigned', 'released', 'cooling_down'). An 'available'
  -- or 'expiry' transition status would violate that constraint. Expiry audit
  -- can be added later by extending the history schema with a dedicated
  -- transition column or by adding a separate phone_number_expiry_log table.

  RETURN QUERY SELECT v_processed;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Same access model as assign_available_phone_number and
-- release_business_phone_number: service_role only.

REVOKE EXECUTE ON FUNCTION public.expire_phone_number_cooldowns(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_phone_number_cooldowns(integer) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.expire_phone_number_cooldowns(integer) TO service_role;


-- ====================================================================
-- 017_package_voucher_activation.sql
-- ====================================================================
-- App v0.1 Activation: Package, Voucher, and Subscription Foundation
--
-- Creates four tables:
--   package_plans          - selectable plan keys (starter, pro, team)
--   voucher_codes          - optional pilot/demo voucher codes (admin-inserted)
--   voucher_redemptions    - records which user/business redeemed a voucher
--   business_subscriptions - selected package per business
--
-- No Stripe or payment provider fields are included beyond future-friendly
-- nullable placeholders (billing_provider, billing_ref).
--
-- Uses CREATE TABLE IF NOT EXISTS throughout for safe re-runs.
-- UNIQUE constraints are named explicitly.
-- RLS is enabled on all four tables.
-- service_role bypasses RLS and is used by all API routes.
-- Authenticated users may read active plan keys only.
-- Voucher codes and redemptions are service_role only.
-- Business owners may read their own subscription row.

-- ---------------------------------------------------------------------------
-- package_plans
-- ---------------------------------------------------------------------------
-- Public plan catalog. Rows are seeded below.
-- Authenticated users are granted SELECT on active rows so the frontend
-- can display plan names without an API round-trip if needed in future.

CREATE TABLE IF NOT EXISTS public.package_plans (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key   text    NOT NULL,
  name       text    NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT package_plans_plan_key_unique UNIQUE (plan_key)
);

CREATE INDEX IF NOT EXISTS package_plans_active_idx
  ON public.package_plans (active);

-- Seed non-secret public plan keys. ON CONFLICT DO NOTHING makes this safe
-- to run repeatedly.
INSERT INTO public.package_plans (plan_key, name, sort_order)
VALUES
  ('starter', 'Starter', 1),
  ('pro',     'Pro',     2),
  ('team',    'Team',    3)
ON CONFLICT (plan_key) DO NOTHING;

ALTER TABLE public.package_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS package_plans_read_authenticated ON public.package_plans;
CREATE POLICY package_plans_read_authenticated
  ON public.package_plans
  FOR SELECT
  TO authenticated
  USING (active = true);

-- ---------------------------------------------------------------------------
-- voucher_codes
-- ---------------------------------------------------------------------------
-- Admin-inserted pilot and demo vouchers. No real codes are seeded here.
-- Authenticated users cannot SELECT this table: service_role only.

CREATE TABLE IF NOT EXISTS public.voucher_codes (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text    NOT NULL,
  description         text,
  -- voucher_type controls the subscription status granted on redemption.
  -- 'pilot'   -> status = 'trialing'
  -- 'demo'    -> status = 'trialing'
  -- 'partner' -> status = 'trialing'
  voucher_type        text    NOT NULL DEFAULT 'pilot',
  active              boolean NOT NULL DEFAULT true,
  max_redemptions     integer,           -- NULL means unlimited
  current_redemptions integer NOT NULL DEFAULT 0,
  expires_at          timestamptz,       -- NULL means no expiry
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT voucher_codes_code_unique UNIQUE (code),

  CONSTRAINT voucher_codes_voucher_type_check
    CHECK (voucher_type IN ('pilot', 'demo', 'partner')),

  CONSTRAINT voucher_codes_redemptions_check
    CHECK (current_redemptions >= 0)
);

CREATE INDEX IF NOT EXISTS voucher_codes_code_idx
  ON public.voucher_codes (code);

CREATE INDEX IF NOT EXISTS voucher_codes_active_idx
  ON public.voucher_codes (active);

ALTER TABLE public.voucher_codes ENABLE ROW LEVEL SECURITY;
-- No authenticated policies: service_role only.

-- ---------------------------------------------------------------------------
-- voucher_redemptions
-- ---------------------------------------------------------------------------
-- One row per business that used a voucher.
-- UNIQUE on business_id prevents double redemption.

CREATE TABLE IF NOT EXISTS public.voucher_redemptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_code_id uuid NOT NULL REFERENCES public.voucher_codes(id),
  user_id         uuid NOT NULL,
  business_id     uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  redeemed_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT voucher_redemptions_business_unique UNIQUE (business_id)
);

CREATE INDEX IF NOT EXISTS voucher_redemptions_voucher_code_id_idx
  ON public.voucher_redemptions (voucher_code_id);

CREATE INDEX IF NOT EXISTS voucher_redemptions_user_id_idx
  ON public.voucher_redemptions (user_id);

ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;
-- No authenticated policies: service_role only.

-- ---------------------------------------------------------------------------
-- business_subscriptions
-- ---------------------------------------------------------------------------
-- One row per business. UNIQUE on business_id enforces at most one subscription.
-- billing_provider and billing_ref are future-friendly placeholders for Stripe
-- or another payment provider. They are nullable and unused in this slice.

CREATE TABLE IF NOT EXISTS public.business_subscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  -- plan_key references package_plans. Text FK is intentional: plan keys are
  -- stable identifiers that the UI and API pass by value.
  plan_key         text NOT NULL REFERENCES public.package_plans(plan_key),
  -- status lifecycle: pending_manual_review -> trialing or active -> cancelled.
  -- pending_manual_review: no valid voucher; George confirms manually.
  -- trialing: activated via a valid voucher.
  -- active: billing confirmed (not used in this slice).
  -- cancelled: subscription ended.
  status           text NOT NULL DEFAULT 'pending_manual_review',
  voucher_code_id  uuid REFERENCES public.voucher_codes(id),
  -- Future-friendly billing placeholders. Not populated in this slice.
  billing_provider text,
  billing_ref      text,
  trial_ends_at    timestamptz,
  cancelled_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT business_subscriptions_business_unique UNIQUE (business_id),

  CONSTRAINT business_subscriptions_status_check
    CHECK (status IN (
      'pending_manual_review',
      'trialing',
      'active',
      'cancelled'
    ))
);

CREATE INDEX IF NOT EXISTS business_subscriptions_business_id_idx
  ON public.business_subscriptions (business_id);

CREATE INDEX IF NOT EXISTS business_subscriptions_status_idx
  ON public.business_subscriptions (status);

ALTER TABLE public.business_subscriptions ENABLE ROW LEVEL SECURITY;

-- Business owner may read their own subscription row.
DROP POLICY IF EXISTS business_subscriptions_read_owner ON public.business_subscriptions;
CREATE POLICY business_subscriptions_read_owner
  ON public.business_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );


-- ====================================================================
-- 018_pending_number_requests.sql
-- ====================================================================
-- App v0.1 Number Readiness: Pending Phone Number Requests
--
-- Creates phone_number_requests to track businesses that completed onboarding
-- but do not yet have an assigned managed number.
--
-- Statuses: pending, resolved, cancelled
-- Sources:  onboarding, number_page, admin
--
-- RLS: enabled.
--   Authenticated business owners may SELECT their own rows.
--   All inserts and updates are handled by service_role API routes.
--   No authenticated insert or update policies are added.
--
-- No real phone numbers or provider data are seeded here.

CREATE TABLE IF NOT EXISTS public.phone_number_requests (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id              uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  requested_city           text,
  status                   text        NOT NULL DEFAULT 'pending',
  source                   text        NOT NULL DEFAULT 'onboarding',
  resolved_phone_number_id uuid,
  resolved_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT phone_number_requests_status_check
    CHECK (status IN ('pending', 'resolved', 'cancelled')),

  CONSTRAINT phone_number_requests_source_check
    CHECK (source IN ('onboarding', 'number_page', 'admin'))
);

-- At most one pending request per business at a time.
-- Partial unique index: only one row with status = 'pending' per business_id is allowed.
CREATE UNIQUE INDEX IF NOT EXISTS phone_number_requests_pending_business_unique
  ON public.phone_number_requests (business_id)
  WHERE (status = 'pending');

-- Useful for admin queries filtering by status.
CREATE INDEX IF NOT EXISTS phone_number_requests_status_idx
  ON public.phone_number_requests (status);

-- Useful for admin queries by requested city.
CREATE INDEX IF NOT EXISTS phone_number_requests_requested_city_idx
  ON public.phone_number_requests (requested_city);

-- Useful for ordering requests chronologically.
CREATE INDEX IF NOT EXISTS phone_number_requests_created_at_idx
  ON public.phone_number_requests (created_at DESC);

ALTER TABLE public.phone_number_requests ENABLE ROW LEVEL SECURITY;

-- Business owners may read their own number requests.
-- No authenticated insert or update policy: service_role API routes handle writes.
DROP POLICY IF EXISTS phone_number_requests_read_owner ON public.phone_number_requests;
CREATE POLICY phone_number_requests_read_owner
  ON public.phone_number_requests
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );


-- ====================================================================
-- 019_resolve_number_requests_on_assignment.sql
-- ====================================================================
-- Resolve pending phone number requests on assignment
--
-- Extends assign_available_phone_number to atomically resolve any pending
-- phone_number_requests row for a business when a number is successfully
-- assigned to that business.
--
-- Two resolution points are added:
--
--   1. Idempotency path: the business already has an active assigned number.
--      Resolves any stale pending request so admin views stay clean.
--
--   2. New assignment path: a fresh number is assigned from the pool.
--      Resolves the pending request in the same transaction as the assignment.
--
-- The no-number-available path (pool exhausted) is unchanged: no pending
-- request is resolved, and the function still returns (false, NULL, NULL).
--
-- This migration uses CREATE OR REPLACE FUNCTION and is safe to re-run.
-- All existing assignment behavior from migration 014 is preserved verbatim.
-- No other functions are modified.

-- ---------------------------------------------------------------------------
-- Drop old single-argument overload (mirror of migration 014 safety drop).
-- Should already be absent, but kept for defensive idempotency.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.assign_available_phone_number(uuid);

-- ---------------------------------------------------------------------------
-- assign_available_phone_number(p_business_id, p_city)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assign_available_phone_number(
  p_business_id uuid,
  p_city        text DEFAULT NULL
)
RETURNS TABLE (
  assigned                boolean,
  managed_phone_number_id uuid,
  e164_number             text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_mpn_id  uuid;
  v_existing_e164    text;
  v_pool_id          uuid;
  v_pool_e164        text;
  v_pool_provider    text;
  v_trimmed_city     text;
BEGIN
  -- Idempotency: if this business already has an active assignment, return it unchanged.
  SELECT bpn.managed_phone_number_id, bpn.e164_number
  INTO   v_existing_mpn_id, v_existing_e164
  FROM   public.business_phone_numbers bpn
  WHERE  bpn.business_id = p_business_id
    AND  bpn.status = 'active'
  LIMIT  1;

  IF v_existing_mpn_id IS NOT NULL THEN
    -- Resolve any stale pending request for this business.
    -- No-op when there is no pending request.
    UPDATE public.phone_number_requests
    SET    status                   = 'resolved',
           resolved_at              = now(),
           resolved_phone_number_id = v_existing_mpn_id,
           updated_at               = now()
    WHERE  business_id = p_business_id
      AND  status      = 'pending';

    RETURN QUERY SELECT true, v_existing_mpn_id, v_existing_e164;
    RETURN;
  END IF;

  -- Normalise city hint: collapse empty string and surrounding whitespace to NULL.
  v_trimmed_city := NULLIF(TRIM(COALESCE(p_city, '')), '');

  -- Step 1 (city match): if a city hint is present, try to lock the oldest available
  -- platform_owned number whose city matches case-insensitively.
  -- NULL city on a pool number is never matched (LOWER(NULL) IS NULL).
  IF v_trimmed_city IS NOT NULL THEN
    SELECT   mpn.id, mpn.e164_number, mpn.provider
    INTO     v_pool_id, v_pool_e164, v_pool_provider
    FROM     public.managed_phone_numbers mpn
    WHERE    mpn.status      = 'available'
      AND    mpn.number_type = 'platform_owned'
      AND    LOWER(TRIM(mpn.city)) = LOWER(v_trimmed_city)
    ORDER BY mpn.imported_at ASC
    LIMIT    1
    FOR UPDATE SKIP LOCKED;
  END IF;

  -- Step 2 (global fallback): if no city-matched number was found, pick the oldest
  -- available platform_owned number regardless of city.
  IF v_pool_id IS NULL THEN
    SELECT   mpn.id, mpn.e164_number, mpn.provider
    INTO     v_pool_id, v_pool_e164, v_pool_provider
    FROM     public.managed_phone_numbers mpn
    WHERE    mpn.status      = 'available'
      AND    mpn.number_type = 'platform_owned'
    ORDER BY mpn.imported_at ASC
    LIMIT    1
    FOR UPDATE SKIP LOCKED;
  END IF;

  -- Pool exhausted or all candidate rows are locked by a concurrent transaction.
  -- Do not resolve any pending request: the business still needs a number.
  IF v_pool_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Mark the pool number as assigned. Clear any residual cooldown fields that
  -- could be present if the number was previously released.
  UPDATE public.managed_phone_numbers
  SET    status             = 'assigned',
         assigned_at        = now(),
         cooling_down_since = NULL,
         available_after    = NULL,
         updated_at         = now()
  WHERE  id = v_pool_id;

  -- Insert the business assignment row.
  INSERT INTO public.business_phone_numbers (
    business_id,
    managed_phone_number_id,
    e164_number,
    provider,
    status,
    assigned_at
  ) VALUES (
    p_business_id,
    v_pool_id,
    v_pool_e164,
    v_pool_provider,
    'active',
    now()
  );

  -- Update the denormalised column on businesses for fast single-column access.
  -- Also backfill businesses.city from the hint when the business has none yet.
  -- This does not overwrite a city the business already has.
  UPDATE public.businesses
  SET    business_phone_number = v_pool_e164,
         city = CASE
                  WHEN v_trimmed_city IS NOT NULL AND city IS NULL THEN v_trimmed_city
                  ELSE city
                END
  WHERE  id = p_business_id;

  -- Append an assignment record to the history log.
  INSERT INTO public.business_phone_number_assignment_history (
    business_id,
    managed_phone_number_id,
    e164_number,
    provider,
    status,
    assigned_at
  ) VALUES (
    p_business_id,
    v_pool_id,
    v_pool_e164,
    v_pool_provider,
    'assigned',
    now()
  );

  -- Resolve any pending phone number request for this business.
  -- v_pool_id is the managed_phone_numbers.id just assigned.
  -- No-op when there is no pending request.
  UPDATE public.phone_number_requests
  SET    status                   = 'resolved',
         resolved_at              = now(),
         resolved_phone_number_id = v_pool_id,
         updated_at               = now()
  WHERE  business_id = p_business_id
    AND  status      = 'pending';

  RETURN QUERY SELECT true, v_pool_id, v_pool_e164;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Identical to migration 014: service_role only.
-- SECURITY DEFINER functions are PUBLIC-executable by default in PostgreSQL;
-- explicit revoke is required.

REVOKE EXECUTE ON FUNCTION public.assign_available_phone_number(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_available_phone_number(uuid, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.assign_available_phone_number(uuid, text) TO service_role;


-- ====================================================================
-- 020_backfill_subscriptions_for_existing_businesses.sql
-- ====================================================================
-- App v0.1 Backfill: business_subscriptions for pre-existing businesses
--
-- Inserts a pending_manual_review subscription row for every business that
-- was created before migration 017 introduced the package/subscription system
-- and therefore has no business_subscriptions row.
--
-- This backfill:
--   - Does NOT grant paid or trialing status automatically.
--   - Sets status = 'pending_manual_review' so admin review remains required
--     before the business gains full access through AppShell activation guard.
--   - Uses the 'starter' plan key as the default baseline plan for all
--     backfilled rows. George may promote individual businesses to 'trialing'
--     or 'active' via a manual UPDATE in the Supabase SQL Editor.
--   - Is idempotent: businesses that already have a subscription row are not
--     touched. The NOT EXISTS predicate and ON CONFLICT DO NOTHING clause both
--     guard against double-insertion.
--   - Inserts zero rows if the 'starter' plan key is absent from package_plans
--     or is marked active = false. A CROSS JOIN against an empty subquery
--     returns zero rows without raising an error.
--
-- No RLS policies or grants are added or modified here.
-- RLS and service_role grants for business_subscriptions were fully established
-- in migration 017 and remain unchanged.

INSERT INTO public.business_subscriptions (
  business_id,
  plan_key,
  status,
  created_at,
  updated_at
)
SELECT
  b.id,
  pp.plan_key,
  'pending_manual_review',
  now(),
  now()
FROM public.businesses AS b
CROSS JOIN (
  SELECT plan_key
  FROM   public.package_plans
  WHERE  plan_key = 'starter'
    AND  active   = true
  LIMIT  1
) AS pp
WHERE NOT EXISTS (
  SELECT 1
  FROM   public.business_subscriptions s
  WHERE  s.business_id = b.id
)
ON CONFLICT (business_id) DO NOTHING;


-- ====================================================================
-- 021_grant_service_role_on_activation_tables.sql
-- ====================================================================
-- Corrective grants for migration 017 (activation/package tables) and
-- migration 018 (phone_number_requests).
--
-- Migration 017 enabled RLS and created policies for the four activation
-- tables but omitted explicit GRANT statements. Without a GRANT, PostgreSQL
-- denies table access at the privilege level before RLS is even evaluated.
-- This caused service_role API routes (which bypass RLS) to receive a
-- permission-denied error when querying business_subscriptions, package_plans,
-- voucher_codes, and voucher_redemptions.
--
-- Migration 018 has the same omission for phone_number_requests.
--
-- This migration adds the minimum required grants:
--   service_role: SELECT, INSERT, UPDATE on all five tables.
--     service_role is used by all server-side API routes (createServerSupabaseClient).
--     DELETE is intentionally not granted, consistent with the phone pool migrations.
--   authenticated: SELECT on tables that have authenticated RLS policies.
--     Without a base GRANT, RLS policies for the authenticated role are unreachable.
--     Only tables with explicit authenticated policies in migration 017/018 receive
--     this grant. voucher_codes and voucher_redemptions are service_role only and
--     are not granted to authenticated.
--
-- No tables are altered.
-- No RLS policies are modified.
-- No anon grants are added.
-- This migration is safe to re-run (GRANT is idempotent in PostgreSQL).

-- ---------------------------------------------------------------------------
-- service_role grants
-- Required by createServerSupabaseClient used in all server-side API routes.
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON public.package_plans          TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.voucher_codes          TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.voucher_redemptions    TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.business_subscriptions TO service_role;

-- phone_number_requests (migration 018): same missing grant pattern.
GRANT SELECT, INSERT, UPDATE ON public.phone_number_requests  TO service_role;

-- ---------------------------------------------------------------------------
-- authenticated grants
-- Required so that RLS policies defined in migration 017 and 018 are reachable.
-- A permissive RLS policy is dead without a base GRANT on the table.
-- ---------------------------------------------------------------------------

-- package_plans: authenticated may SELECT active rows (policy: package_plans_read_authenticated).
GRANT SELECT ON public.package_plans          TO authenticated;

-- business_subscriptions: business owner may SELECT their own row (policy: business_subscriptions_read_owner).
GRANT SELECT ON public.business_subscriptions TO authenticated;

-- phone_number_requests: business owner may SELECT their own rows (policy: phone_number_requests_read_owner).
GRANT SELECT ON public.phone_number_requests  TO authenticated;

-- voucher_codes and voucher_redemptions: no authenticated policies in migration 017.
-- service_role only. No authenticated grant added.


-- ====================================================================
-- 022_businesses_update_policy.sql
-- ====================================================================
-- Migration 022: Settings DB sync.
-- Adds UPDATE policy for authenticated business owners so that
-- PATCH /api/businesses/me can persist profile edits to the database.
-- Adds service_role UPDATE grant for server-side routes that use
-- createServerSupabaseClient (which bypasses RLS but still needs the privilege).
--
-- No table schema changes.
-- No owner_name column added (localStorage-only in this slice).
-- No logo storage added (logo_url management deferred).
-- No DELETE grants.
-- No anon grants.
--
-- GRANT is idempotent in PostgreSQL.
-- DROP POLICY IF EXISTS makes the CREATE POLICY safe to re-run.

-- Allow authenticated users to UPDATE their own business row.
GRANT UPDATE ON public.businesses TO authenticated;

-- Allow server-side routes (service_role client) to UPDATE businesses.
GRANT UPDATE ON public.businesses TO service_role;

-- UPDATE policy: a business owner may update only their own row.
DROP POLICY IF EXISTS "businesses_update_own" ON public.businesses;

CREATE POLICY "businesses_update_own"
  ON public.businesses
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());


-- ====================================================================
-- 023_businesses_structured_profile.sql
-- ====================================================================
-- Migration 023: Structured business profile fields.
-- Adds nullable text columns for legal name, trade name, owner identity split,
-- structured address fields, postal code, region and website.
--
-- Old columns (name, address, city) remain for compatibility with offers,
-- onboarding and any consumers not yet updated. No column is dropped or renamed.
-- Tax office (tax_office) remains a manual text field. No automatic DOU fill.
-- Onboarding and offer display will be updated in separate slices.
--
-- ADD COLUMN IF NOT EXISTS is idempotent; migration is safe to re-run.
-- All new columns are nullable text with no DEFAULT.
-- No indexes, no grants, no RLS changes (migration 022 already covers UPDATE).

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS legal_name        text,
  ADD COLUMN IF NOT EXISTS trade_name        text,
  ADD COLUMN IF NOT EXISTS owner_first_name  text,
  ADD COLUMN IF NOT EXISTS owner_last_name   text,
  ADD COLUMN IF NOT EXISTS address_line1     text,
  ADD COLUMN IF NOT EXISTS address_line2     text,
  ADD COLUMN IF NOT EXISTS postal_code       text,
  ADD COLUMN IF NOT EXISTS region            text,
  ADD COLUMN IF NOT EXISTS website           text;

-- Backfill: copy existing name into legal_name for rows that have a name
-- but no legal_name yet. WHERE guard makes this safe to re-run.
UPDATE public.businesses
SET legal_name = name
WHERE legal_name IS NULL AND name IS NOT NULL;

-- Backfill: copy existing address into address_line1 for rows that have an
-- address but no address_line1 yet. WHERE guard makes this safe to re-run.
UPDATE public.businesses
SET address_line1 = address
WHERE address_line1 IS NULL AND address IS NOT NULL;


-- ====================================================================
-- 024_customer_memory_fields.sql
-- ====================================================================
-- Migration 024: Customer memory fields.
-- Adds five nullable columns to public.customers for the manual memory layer.
-- These fields are for human-entered notes and status.
-- AI must remain review-first: no automatic writes to these fields from any pipeline.
--
-- All columns are nullable text or timestamptz with no DEFAULT value.
-- ADD COLUMN IF NOT EXISTS is idempotent and safe to re-run on a live table.
-- No indexes, no RLS changes, no grant changes needed.
-- The existing UPDATE policy in 003_crm_core.sql already covers new columns.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS status_summary    text,
  ADD COLUMN IF NOT EXISTS business_notes    text,
  ADD COLUMN IF NOT EXISTS personal_notes    text,
  ADD COLUMN IF NOT EXISTS next_best_action  text,
  ADD COLUMN IF NOT EXISTS memory_updated_at timestamptz;


-- ====================================================================
-- 025_customer_upload_tokens.sql
-- ====================================================================
-- yorgos.ai Slice 1 - Customer upload tokens
-- Secure public upload links for customers. Customers open the link and will
-- upload photos/videos in a later slice (Slice 2).
--
-- Raw public tokens are never stored. Only SHA-256 hashes are written to this table.
-- Public upload pages must call server API routes that use service_role.
-- No authenticated or anonymous policies are created for this table by design.
-- See src/lib/server/upload-tokens.ts for the server-side helper.

CREATE TABLE IF NOT EXISTS public.customer_upload_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id   uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token_hash    text        NOT NULL,
  status        text        NOT NULL DEFAULT 'pending',
  sent_channel  text,
  sent_to_phone text,
  expires_at    timestamptz NOT NULL,
  opened_at     timestamptz,
  completed_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT customer_upload_tokens_status_check
    CHECK (status IN ('pending', 'sent', 'opened', 'completed', 'expired', 'revoked')),

  CONSTRAINT customer_upload_tokens_sent_channel_check
    CHECK (sent_channel IS NULL OR sent_channel IN ('viber', 'sms', 'manual'))
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_upload_tokens_token_hash_unique
  ON public.customer_upload_tokens (token_hash);

CREATE INDEX IF NOT EXISTS customer_upload_tokens_business_customer_idx
  ON public.customer_upload_tokens (business_id, customer_id);

CREATE INDEX IF NOT EXISTS customer_upload_tokens_expires_idx
  ON public.customer_upload_tokens (expires_at);

CREATE INDEX IF NOT EXISTS customer_upload_tokens_status_idx
  ON public.customer_upload_tokens (status);

ALTER TABLE public.customer_upload_tokens ENABLE ROW LEVEL SECURITY;

-- No authenticated or anon policies by design.
-- Upload token lookup and status updates happen only through trusted server API routes.

REVOKE ALL PRIVILEGES ON TABLE public.customer_upload_tokens FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.customer_upload_tokens FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.customer_upload_tokens FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_upload_tokens TO service_role;


-- ====================================================================
-- 026_customer_upload_sessions.sql
-- ====================================================================
-- yorgos.ai Slice 2 - Customer upload sessions
-- Records metadata for files uploaded by customers through upload links.
-- Files are stored in Supabase Storage bucket "customer-uploads" (private).
-- Rows are written by service_role API routes only.
-- Authenticated users (business owners) can SELECT their own sessions via RLS.
--
-- Storage bucket notes:
--   * Bucket is private (public = false). No public read access.
--   * Uploads use short-lived signed upload URLs created server-side with service_role.
--   * File bytes travel directly from the customer browser to Supabase Storage.
--   * Next.js API routes do not receive file bytes.

-- ---------------------------------------------------------------------------
-- Storage bucket: customer-uploads
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-uploads',
  'customer-uploads',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp',
    'video/mp4',
    'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.customer_upload_sessions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id       uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  upload_token_id   uuid        NOT NULL REFERENCES public.customer_upload_tokens(id) ON DELETE CASCADE,
  file_count        integer     NOT NULL DEFAULT 0,
  files             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  customer_comment  text,
  uploaded_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_upload_sessions_business_customer_idx
  ON public.customer_upload_sessions (business_id, customer_id);

CREATE INDEX IF NOT EXISTS customer_upload_sessions_upload_token_idx
  ON public.customer_upload_sessions (upload_token_id);

CREATE INDEX IF NOT EXISTS customer_upload_sessions_uploaded_at_idx
  ON public.customer_upload_sessions (uploaded_at DESC);

ALTER TABLE public.customer_upload_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upload_sessions_select_business_members" ON public.customer_upload_sessions;
CREATE POLICY "upload_sessions_select_business_members"
  ON public.customer_upload_sessions
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

REVOKE ALL PRIVILEGES ON TABLE public.customer_upload_sessions FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.customer_upload_sessions FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.customer_upload_sessions FROM service_role;

GRANT SELECT ON TABLE public.customer_upload_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_upload_sessions TO service_role;


-- ====================================================================
-- 027_performance_indexes.sql
-- ====================================================================
-- yorgos.ai Performance Indexes
-- Adds covering/composite indexes on the hot filter columns used by the app's
-- list and timeline queries. All statements use CREATE INDEX IF NOT EXISTS and
-- are therefore idempotent and safe to re-run.
--
-- Only columns and tables that already exist (created in earlier migrations) are
-- indexed here:
--   * customers              (003_crm_core.sql)
--   * communications         (003_crm_core.sql)
--   * tasks                  (003_crm_core.sql)
--   * offers                 (007_offers_core.sql)
--   * customer_intake_tokens (005_customer_intake_tokens.sql)
--   * offer_response_tokens  (008_offer_response_tokens.sql)
--   * appointment_response_tokens (009_appointment_response_tokens.sql)
--
-- Note on token_hash indexes:
-- Each token table already has a UNIQUE index on (token_hash) created in its
-- original migration (e.g. customer_intake_tokens_token_hash_unique). Those
-- unique indexes already serve point lookups by token_hash, so no additional
-- token_hash index is required or created here. The unique constraints are the
-- canonical token_hash lookup path. See the per-table migrations above.

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
-- Tenant-scoped list queries filter by business_id and order by created_at DESC.

CREATE INDEX IF NOT EXISTS customers_business_id_perf_idx
  ON public.customers (business_id);

CREATE INDEX IF NOT EXISTS customers_business_created_at_desc_idx
  ON public.customers (business_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- communications
-- ---------------------------------------------------------------------------
-- Customer timeline reads the latest communications for a customer within a
-- business, newest first.

CREATE INDEX IF NOT EXISTS communications_business_customer_created_desc_idx
  ON public.communications (business_id, customer_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
-- Task lists filter by business_id + status and sort/scan by due_date.

CREATE INDEX IF NOT EXISTS tasks_business_status_due_date_idx
  ON public.tasks (business_id, status, due_date);

-- ---------------------------------------------------------------------------
-- offers
-- ---------------------------------------------------------------------------
-- Offer lists filter by business_id + status.

CREATE INDEX IF NOT EXISTS offers_business_status_idx
  ON public.offers (business_id, status);


-- ====================================================================
-- 028_rls_policies.sql
-- ====================================================================
-- yorgos.ai Row Level Security Hardening (defense-in-depth)
--
-- IMPORTANT: The application connects to Supabase using the SERVICE-ROLE key for
-- all server-side data access. The service role BYPASSES Row Level Security
-- entirely. None of the policies in this file affect the running application.
--
-- These policies exist purely as DEFENSE-IN-DEPTH. If the anon key (or a user's
-- authenticated JWT) were ever leaked and used against the Data API directly,
-- RLS must guarantee that a row is only ever visible/mutable by the owner or a
-- member of its business_id tenant. The service role is unaffected and continues
-- to have full access (it always bypasses RLS).
--
-- Ownership model (real, as defined in 001_initial.sql):
--   * businesses.owner_id           -> auth.users(id)   (the owner)
--   * business_users(business_id,    user_id, role)     (membership, incl. owner)
-- Access is granted to any user who has a business_users membership row for the
-- row's business_id. This matches the existing policy style in 003/007.
--
-- This migration is idempotent:
--   * ENABLE ROW LEVEL SECURITY is a no-op when already enabled.
--   * Each policy is dropped (IF EXISTS) and recreated.
--
-- NOTE: The token tables (customer_intake_tokens, offer_response_tokens,
-- appointment_response_tokens, customer_upload_tokens) are INTENTIONALLY left
-- with RLS enabled and NO authenticated/anon policies, exactly as their original
-- migrations created them. They hold token hashes for public links and must only
-- ever be reachable through trusted server API routes using the service role.
-- Adding an authenticated policy would WEAKEN that posture, so we deliberately do
-- not. We only (idempotently) re-assert that RLS is enabled on them here.

-- ---------------------------------------------------------------------------
-- Ensure RLS is enabled on every per-tenant table.
-- ---------------------------------------------------------------------------

ALTER TABLE public.customers                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers                      ENABLE ROW LEVEL SECURITY;

-- Token tables: RLS stays ON with no public policies (service-role only).
ALTER TABLE public.customer_intake_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_response_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_response_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_upload_tokens      ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS: customers  (defense-in-depth; mirrors 003_crm_core.sql)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "customers_select_business_members" ON public.customers;
CREATE POLICY "customers_select_business_members"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "customers_insert_business_members" ON public.customers;
CREATE POLICY "customers_insert_business_members"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "customers_update_business_members" ON public.customers;
CREATE POLICY "customers_update_business_members"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: communications  (defense-in-depth; mirrors 003_crm_core.sql)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "communications_select_business_members" ON public.communications;
CREATE POLICY "communications_select_business_members"
  ON public.communications
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "communications_insert_business_members" ON public.communications;
CREATE POLICY "communications_insert_business_members"
  ON public.communications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "communications_update_business_members" ON public.communications;
CREATE POLICY "communications_update_business_members"
  ON public.communications
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: tasks  (defense-in-depth; mirrors 003_crm_core.sql)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "tasks_select_business_members" ON public.tasks;
CREATE POLICY "tasks_select_business_members"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tasks_insert_business_members" ON public.tasks;
CREATE POLICY "tasks_insert_business_members"
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tasks_update_business_members" ON public.tasks;
CREATE POLICY "tasks_update_business_members"
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: offers  (defense-in-depth; mirrors 007_offers_core.sql)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "offers_select_business_members" ON public.offers;
CREATE POLICY "offers_select_business_members"
  ON public.offers
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "offers_insert_business_members" ON public.offers;
CREATE POLICY "offers_insert_business_members"
  ON public.offers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "offers_update_business_members" ON public.offers;
CREATE POLICY "offers_update_business_members"
  ON public.offers
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Token tables: no authenticated/anon policies by design.
-- ---------------------------------------------------------------------------
-- customer_intake_tokens, offer_response_tokens, appointment_response_tokens,
-- and customer_upload_tokens remain reachable only via the service role.
-- (No policies are created here on purpose.)


-- ====================================================================
-- 029_audit_events.sql
-- ====================================================================
-- yorgos.ai Audit Events
-- Append-only audit log of meaningful actions taken in the system.
-- Rows are written by trusted server API routes using the service role only.
--
-- RLS is enabled with NO authenticated/anon policies: only the service role
-- (which bypasses RLS) may read or write this table. This matches the pattern
-- used by provider_webhook_events (003) and the token tables (005/008/009).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.
-- business_id and actor_user_id are nullable and intentionally have NO foreign
-- key constraints, so audit rows survive deletion of the business or user they
-- reference (audit trails must outlive the entities they describe).

CREATE TABLE IF NOT EXISTS public.audit_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid,
  actor_user_id uuid,
  action        text        NOT NULL,
  entity_type   text,
  entity_id     text,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_business_created_desc_idx
  ON public.audit_events (business_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- RLS enabled, no public policies. Service role bypasses RLS and is the only
-- principal that can read or write audit events.

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- (No policies created for audit_events by design.)

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- No grants to anon or authenticated. Service role only.

REVOKE ALL PRIVILEGES ON TABLE public.audit_events FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.audit_events FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.audit_events FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_events TO service_role;


-- ====================================================================
-- 030_jobs.sql
-- ====================================================================
-- yorgos.ai Jobs Queue
-- Generic table backing a future asynchronous job queue (e.g. deferred email
-- sends, webhook retries, scheduled follow-ups). A worker process polls for
-- pending rows whose run_at is due, ordered by run_at.
--
-- Not yet wired to any worker; this migration only provisions the schema.
-- Rows are written and claimed exclusively by server-side code using the
-- service role. RLS is enabled with no public policies (service role bypasses
-- RLS), consistent with provider_webhook_events (003) and audit_events (029).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.
-- business_id is nullable with no FK so system-level jobs (not tied to a
-- tenant) can be enqueued. updated_at is managed by the API/worker layer, not
-- by a trigger, consistent with the rest of the schema.

CREATE TABLE IF NOT EXISTS public.jobs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid,
  type        text,
  payload     jsonb,
  status      text        NOT NULL DEFAULT 'pending',
  attempts    integer     NOT NULL DEFAULT 0,
  run_at      timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Worker dispatch index: find due pending jobs (filter status, order by run_at).
CREATE INDEX IF NOT EXISTS jobs_status_run_at_idx
  ON public.jobs (status, run_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- RLS enabled, no public policies. Service role bypasses RLS and is the only
-- principal that enqueues, claims, or completes jobs.

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- (No policies created for jobs by design.)

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- No grants to anon or authenticated. Service role only.

REVOKE ALL PRIVILEGES ON TABLE public.jobs FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.jobs FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.jobs FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.jobs TO service_role;

