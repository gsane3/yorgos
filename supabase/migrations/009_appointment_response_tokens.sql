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
