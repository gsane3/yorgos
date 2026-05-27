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
