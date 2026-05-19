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
