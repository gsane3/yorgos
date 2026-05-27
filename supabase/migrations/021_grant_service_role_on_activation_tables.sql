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
