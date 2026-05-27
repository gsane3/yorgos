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
