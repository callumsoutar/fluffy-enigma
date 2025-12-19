import type { Chargeable } from "@/lib/types/database"

/**
 * Chargeable types classify chargeables (e.g. membership_fee, aircraft_hire, instruction, etc.)
 *
 * NOTE: We keep this intentionally flexible because the `chargeable_types` table
 * isn't currently represented in `lib/types/database.ts`.
 */
export interface ChargeableType {
  id: string
  code: string
  name?: string | null
  description?: string | null
  is_active?: boolean
  created_at?: string
  updated_at?: string
  voided_at?: string | null
  [key: string]: unknown
}

export type ChargeableWithType = Chargeable & {
  chargeable_type?: ChargeableType | null
}

