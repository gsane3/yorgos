-- Migration 023: Structured business profile fields.
-- Adds nullable text columns for legal name, trade name, owner identity split,
-- structured address fields, postal code, region and website.
--
-- Old columns (name, address, city) remain for compatibility with offers,
-- onboarding and any consumers not yet updated. No column is dropped or renamed.
-- Tax office (tax_office) remains a manual text field. No automatic DOU fill.
-- Onboarding and offer display will be updated in separate slices.
--
-- ADD COLUMN IF NOT EXISTS is idempotent; migration is safe to re-run.
-- All new columns are nullable text with no DEFAULT.
-- No indexes, no grants, no RLS changes (migration 022 already covers UPDATE).

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS legal_name        text,
  ADD COLUMN IF NOT EXISTS trade_name        text,
  ADD COLUMN IF NOT EXISTS owner_first_name  text,
  ADD COLUMN IF NOT EXISTS owner_last_name   text,
  ADD COLUMN IF NOT EXISTS address_line1     text,
  ADD COLUMN IF NOT EXISTS address_line2     text,
  ADD COLUMN IF NOT EXISTS postal_code       text,
  ADD COLUMN IF NOT EXISTS region            text,
  ADD COLUMN IF NOT EXISTS website           text;

-- Backfill: copy existing name into legal_name for rows that have a name
-- but no legal_name yet. WHERE guard makes this safe to re-run.
UPDATE public.businesses
SET legal_name = name
WHERE legal_name IS NULL AND name IS NOT NULL;

-- Backfill: copy existing address into address_line1 for rows that have an
-- address but no address_line1 yet. WHERE guard makes this safe to re-run.
UPDATE public.businesses
SET address_line1 = address
WHERE address_line1 IS NULL AND address IS NOT NULL;
