-- Migration: Add solo_end_tach for mixed dual/solo flights
--
-- Purpose:
-- - Support a single flight log that can contain dual first, then solo at the end.
-- - When billing basis is tacho, we need a tacho-specific solo end meter to split
--   dual_time vs solo_time deterministically (without using Hobbs).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS solo_end_tach NUMERIC;

COMMENT ON COLUMN public.bookings.solo_end_tach IS
  'Tacho reading at end of solo portion (used when a dual booking ends with solo).';

