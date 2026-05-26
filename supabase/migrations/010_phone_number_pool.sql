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
