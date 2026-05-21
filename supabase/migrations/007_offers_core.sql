-- yorgos.ai Backend Phase 5 Offers Core
-- Adds public.offers and public.offer_items tables.
-- Also backfills the deferred FK from public.tasks.offer_id to public.offers(id).
--
-- Safe to run after 003_crm_core.sql.
-- Uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS throughout.
-- Policy names are explicit; DROP POLICY IF EXISTS is used before each CREATE POLICY.
-- updated_at columns are managed by the API layer, not by triggers, consistent with Phase 3.
-- related_call_id is stored as bare uuid (no FK) because the calls/recordings table
-- is deferred to a later migration.

-- ---------------------------------------------------------------------------
-- offers
-- ---------------------------------------------------------------------------
-- One row per offer/quotation document.
-- Replaces the localStorage offers array.

CREATE TABLE IF NOT EXISTS public.offers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id     uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  related_task_id uuid        REFERENCES public.tasks(id) ON DELETE SET NULL,
  related_call_id uuid,
  offer_number    text        NOT NULL,
  status          text        NOT NULL DEFAULT 'draft',
  offer_date      date        NOT NULL DEFAULT current_date,
  valid_until     date,
  subtotal        numeric     NOT NULL DEFAULT 0,
  vat_rate        numeric     NOT NULL DEFAULT 24,
  vat_amount      numeric     NOT NULL DEFAULT 0,
  total           numeric     NOT NULL DEFAULT 0,
  notes           text,
  terms           text,
  acceptance_text text,
  viber_draft     text,
  email_subject   text,
  email_body      text,
  created_from_ai boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT offers_status_check
    CHECK (status IN (
      'draft', 'ready_to_send', 'sent_manually', 'accepted', 'rejected', 'expired'
    )),

  CONSTRAINT offers_subtotal_nonneg    CHECK (subtotal   >= 0),
  CONSTRAINT offers_vat_rate_nonneg    CHECK (vat_rate   >= 0),
  CONSTRAINT offers_vat_amount_nonneg  CHECK (vat_amount >= 0),
  CONSTRAINT offers_total_nonneg       CHECK (total      >= 0),

  -- Required so offer_items can FK on (business_id, id) to enforce tenant safety.
  CONSTRAINT offers_business_id_key    UNIQUE (business_id, id)
);

-- Unique offer number per business. Also serves as the index for number lookups.
CREATE UNIQUE INDEX IF NOT EXISTS offers_business_number_unique
  ON public.offers (business_id, offer_number);

CREATE INDEX IF NOT EXISTS offers_business_customer_status_idx
  ON public.offers (business_id, customer_id, status);

CREATE INDEX IF NOT EXISTS offers_business_status_date_idx
  ON public.offers (business_id, status, offer_date);

-- ---------------------------------------------------------------------------
-- offer_items
-- ---------------------------------------------------------------------------
-- Line items for each offer, ordered by sort_order within an offer.

CREATE TABLE IF NOT EXISTS public.offer_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  offer_id    uuid        NOT NULL,
  description text        NOT NULL,
  quantity    numeric     NOT NULL DEFAULT 1,
  unit_price  numeric     NOT NULL DEFAULT 0,
  line_total  numeric     NOT NULL DEFAULT 0,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT offer_items_quantity_pos       CHECK (quantity    > 0),
  CONSTRAINT offer_items_unit_price_nonneg  CHECK (unit_price  >= 0),
  CONSTRAINT offer_items_line_total_nonneg  CHECK (line_total  >= 0),

  -- Composite FK: guarantees offer_id belongs to the same business_id tenant.
  -- Replaces a plain offer_id -> offers(id) FK, which would allow cross-tenant references.
  CONSTRAINT offer_items_business_offer_fk
    FOREIGN KEY (business_id, offer_id)
    REFERENCES public.offers(business_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS offer_items_business_offer_sort_idx
  ON public.offer_items (business_id, offer_id, sort_order);

-- ---------------------------------------------------------------------------
-- Backfill deferred FK: tasks.offer_id -> offers(id)
-- ---------------------------------------------------------------------------
-- tasks was created with offer_id uuid (no FK) because offers did not exist yet.
-- Now that offers exists, add the constraint idempotently.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  constraint_name = 'tasks_offer_id_fkey'
      AND  table_schema    = 'public'
      AND  table_name      = 'tasks'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_offer_id_fkey
      FOREIGN KEY (offer_id)
      REFERENCES public.offers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.offers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_items ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS: offers
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "offers_select_business_members" ON public.offers;
CREATE POLICY "offers_select_business_members"
  ON public.offers
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "offers_insert_business_members" ON public.offers;
CREATE POLICY "offers_insert_business_members"
  ON public.offers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "offers_update_business_members" ON public.offers;
CREATE POLICY "offers_update_business_members"
  ON public.offers
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

-- DELETE policy intentionally omitted, consistent with Phase 3 CRM tables.

-- ---------------------------------------------------------------------------
-- RLS: offer_items
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "offer_items_select_business_members" ON public.offer_items;
CREATE POLICY "offer_items_select_business_members"
  ON public.offer_items
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "offer_items_insert_business_members" ON public.offer_items;
CREATE POLICY "offer_items_insert_business_members"
  ON public.offer_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "offer_items_update_business_members" ON public.offer_items;
CREATE POLICY "offer_items_update_business_members"
  ON public.offer_items
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT bu.business_id
      FROM public.business_users bu
      WHERE bu.user_id = auth.uid()
    )
  );

-- DELETE policy intentionally omitted, consistent with Phase 3 CRM tables.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE ON public.offers      TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.offer_items TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers      TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_items TO service_role;
