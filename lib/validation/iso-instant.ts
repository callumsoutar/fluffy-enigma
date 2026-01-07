import { z } from "zod"

/**
 * Canonical "instant" string format for the app.
 *
 * - MUST include timezone information (either `Z` or an explicit offset like `+13:00`).
 * - This prevents accidental interpretation in server-local or browser-local time.
 *
 * Examples (all valid):
 * - 2026-01-07T00:35:50Z
 * - 2026-01-07T00:35:50.354Z
 * - 2026-01-07T00:35:50+13:00
 */
const ISO_INSTANT_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/

export const isoInstantSchema = z
  .string()
  .min(1)
  .refine((val) => ISO_INSTANT_WITH_OFFSET.test(val), {
    message:
      "Invalid datetime. Expected an ISO-8601 timestamp with timezone offset (e.g., 2026-01-07T00:35:50Z or 2026-01-07T13:35:50+13:00).",
  })


