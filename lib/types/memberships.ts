/**
 * Membership types and interfaces
 */

import type { Membership, MembershipType, Chargeable, Invoice } from "./database"

/**
 * Membership with related data (type, chargeable, invoice)
 */
export interface MembershipWithRelations extends Membership {
  membership_types?: MembershipTypeWithChargeable | null
  invoices?: Invoice | null
}

/**
 * Membership type with chargeable information
 */
export interface MembershipTypeWithChargeable extends MembershipType {
  chargeables?: Chargeable | null
}

/**
 * Membership summary for display
 */
export interface MembershipSummary {
  current_membership: MembershipWithRelations | null
  status: "active" | "grace" | "expired" | "unpaid" | "none"
  days_until_expiry: number | null
  grace_period_remaining: number | null
  can_renew: boolean
  membership_history: MembershipWithRelations[]
}
