-- Add an explicit display ordering column for aircraft (used by scheduler).

ALTER TABLE public.aircraft
ADD COLUMN IF NOT EXISTS "order" integer;

-- Backfill existing rows to preserve current UI order (registration ASC).
WITH ordered AS (
  SELECT
    id,
    row_number() OVER (ORDER BY registration ASC, id ASC) AS rn
  FROM public.aircraft
)
UPDATE public.aircraft a
SET "order" = o.rn
FROM ordered o
WHERE a.id = o.id
  AND a."order" IS NULL;

-- Create sequence for future inserts and align it to current max(order).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S'
      AND c.relname = 'aircraft_order_seq'
      AND n.nspname = 'public'
  ) THEN
    CREATE SEQUENCE public.aircraft_order_seq;
  END IF;
END
$$;

SELECT setval(
  'public.aircraft_order_seq',
  (SELECT COALESCE(MAX("order"), 0) FROM public.aircraft),
  true
);

ALTER TABLE public.aircraft
  ALTER COLUMN "order" SET DEFAULT nextval('public.aircraft_order_seq'::regclass);

ALTER TABLE public.aircraft
  ALTER COLUMN "order" SET NOT NULL;

ALTER TABLE public.aircraft
  ADD CONSTRAINT aircraft_order_non_negative CHECK ("order" >= 0) NOT VALID;

ALTER TABLE public.aircraft
  VALIDATE CONSTRAINT aircraft_order_non_negative;

CREATE INDEX IF NOT EXISTS aircraft_order_idx ON public.aircraft ("order");

