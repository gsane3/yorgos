-- Migration 044: Quo-inspired feature set (snippets, scheduled messages,
-- business hours / after-hours auto-reply, weekly summary toggle, pinned customers).
--
-- Applied MANUALLY via the Supabase SQL editor (do not `supabase db push`).
-- Idempotent: tables use IF NOT EXISTS, columns use ADD COLUMN IF NOT EXISTS,
-- policies use DROP ... IF EXISTS + CREATE.
--
-- All app access is via the service-role API (RLS bypassed); the membership
-- policies below are defense-in-depth, mirroring the customers table (003).

-- ===========================================================================
-- 1. message_snippets — reusable Greek text templates per business
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.message_snippets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  body        text        NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_snippets_business_sort_idx
  ON public.message_snippets (business_id, sort_order);

ALTER TABLE public.message_snippets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_snippets_rw_business_members" ON public.message_snippets;
CREATE POLICY "message_snippets_rw_business_members"
  ON public.message_snippets
  FOR ALL
  TO authenticated
  USING (
    business_id IN (SELECT bu.business_id FROM public.business_users bu WHERE bu.user_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT bu.business_id FROM public.business_users bu WHERE bu.user_id = auth.uid())
  );

-- ===========================================================================
-- 2. scheduled_messages — send-later texts (sent by the scheduled-messages cron)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id   uuid        REFERENCES public.customers(id) ON DELETE CASCADE,
  channel       text        NOT NULL DEFAULT 'auto',
  body          text        NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status        text        NOT NULL DEFAULT 'pending',
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,

  CONSTRAINT scheduled_messages_channel_check
    CHECK (channel IN ('auto', 'sms', 'viber')),
  CONSTRAINT scheduled_messages_status_check
    CHECK (status IN ('pending', 'sent', 'cancelled', 'failed'))
);

CREATE INDEX IF NOT EXISTS scheduled_messages_due_idx
  ON public.scheduled_messages (status, scheduled_for);
CREATE INDEX IF NOT EXISTS scheduled_messages_business_idx
  ON public.scheduled_messages (business_id, status, scheduled_for);

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_messages_rw_business_members" ON public.scheduled_messages;
CREATE POLICY "scheduled_messages_rw_business_members"
  ON public.scheduled_messages
  FOR ALL
  TO authenticated
  USING (
    business_id IN (SELECT bu.business_id FROM public.business_users bu WHERE bu.user_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT bu.business_id FROM public.business_users bu WHERE bu.user_id = auth.uid())
  );

-- ===========================================================================
-- 3. businesses: business hours + after-hours auto-reply + weekly summary
-- ===========================================================================
-- business_hours shape (jsonb), e.g.
--   { "days": [1,2,3,4,5], "open": "09:00", "close": "18:00" }
--   days = ISO weekday numbers 1=Mon..7=Sun; null/absent = always open.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS business_hours        jsonb,
  ADD COLUMN IF NOT EXISTS auto_reply_enabled    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_reply_text       text,
  ADD COLUMN IF NOT EXISTS weekly_summary_enabled boolean NOT NULL DEFAULT true;

-- ===========================================================================
-- 4. customers.pinned — float active jobs to the top of the list
-- ===========================================================================
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS customers_business_pinned_idx
  ON public.customers (business_id, pinned)
  WHERE pinned = true;
