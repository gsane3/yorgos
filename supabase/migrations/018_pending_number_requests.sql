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
