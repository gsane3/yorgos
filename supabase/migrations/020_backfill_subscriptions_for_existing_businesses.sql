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
