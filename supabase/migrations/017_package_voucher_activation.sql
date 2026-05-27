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
