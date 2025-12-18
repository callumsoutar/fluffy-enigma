import type { MembershipWithRelations } from "@/lib/types/memberships"

export type MembershipStatus = "active" | "grace" | "expired" | "unpaid" | "none"

/**
 * Calculate the status of a membership based on dates and payment status
 */
export function calculateMembershipStatus(
  membership: MembershipWithRelations
): MembershipStatus {
  const now = new Date()
  const expiryDate = new Date(membership.expiry_date)
  const gracePeriodEnd = new Date(
    expiryDate.getTime() + (membership.grace_period_days * 24 * 60 * 60 * 1000)
  )

  // Check if fee is paid via invoice status (replacing deprecated fee_paid field)
  const feePaid = membership.invoices?.status === "paid"

  if (!feePaid) {
    return "unpaid"
  }

  if (now <= expiryDate) {
    return "active"
  }

  if (now <= gracePeriodEnd) {
    return "grace"
  }

  return "expired"
}

/**
 * Calculate days until expiry for an active membership
 */
export function getDaysUntilExpiry(membership: MembershipWithRelations): number | null {
  const status = calculateMembershipStatus(membership)
  if (status !== "active") return null

  const now = new Date()
  const expiryDate = new Date(membership.expiry_date)
  return Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
}

/**
 * Calculate remaining grace period days
 */
export function getGracePeriodRemaining(membership: MembershipWithRelations): number | null {
  const status = calculateMembershipStatus(membership)
  if (status !== "grace") return null

  const now = new Date()
  const expiryDate = new Date(membership.expiry_date)
  const gracePeriodEnd = new Date(
    expiryDate.getTime() + (membership.grace_period_days * 24 * 60 * 60 * 1000)
  )
  return Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
}

/**
 * Check if a membership is eligible for renewal
 */
export function canRenewMembership(membership: MembershipWithRelations): boolean {
  const status = calculateMembershipStatus(membership)
  return status === "active" || status === "grace" || status === "unpaid"
}

/**
 * Get status badge color classes
 */
export function getStatusBadgeClasses(status: MembershipStatus): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 border-green-200"
    case "grace":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "expired":
      return "bg-red-100 text-red-800 border-red-200"
    case "unpaid":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "none":
      return "bg-gray-100 text-gray-800 border-gray-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

/**
 * Get human-readable status text
 */
export function getStatusText(status: MembershipStatus): string {
  switch (status) {
    case "active":
      return "Active"
    case "grace":
      return "Grace Period"
    case "expired":
      return "Expired"
    case "unpaid":
      return "Payment Due"
    case "none":
      return "No Membership"
    default:
      return "Unknown"
  }
}

/**
 * Calculate renewal date and expiry date for a membership
 */
export function calculateRenewalDates(
  membershipType: { duration_months: number },
  startDate?: Date
): {
  startDate: Date
  expiryDate: Date
} {
  const start = startDate || new Date()
  const expiry = new Date(start)
  expiry.setMonth(expiry.getMonth() + membershipType.duration_months)

  return {
    startDate: start,
    expiryDate: expiry,
  }
}

/**
 * Check if membership is about to expire (within warning threshold)
 */
export function isMembershipExpiringSoon(
  membership: MembershipWithRelations,
  warningDays: number = 30
): boolean {
  const daysUntilExpiry = getDaysUntilExpiry(membership)
  return daysUntilExpiry !== null && daysUntilExpiry <= warningDays
}

/**
 * Format membership benefits for display
 */
export function formatMembershipBenefits(benefits: string[] | null | undefined): string {
  if (!benefits || benefits.length === 0) return "No benefits listed"
  return benefits.join(" • ")
}

/**
 * Get border color class for current membership card based on status
 */
export function getMembershipCardBorderClass(status: MembershipStatus): string {
  switch (status) {
    case "active":
      return "border-l-green-500"
    case "grace":
      return "border-l-yellow-500"
    case "expired":
      return "border-l-red-500"
    case "unpaid":
      return "border-l-red-500"
    default:
      return "border-l-gray-300"
  }
}

/**
 * Get icon for current membership card based on status
 */
export function getMembershipCardIcon(
  status: MembershipStatus
): "CheckCircle" | "AlertTriangle" | "XCircle" {
  switch (status) {
    case "active":
      return "CheckCircle"
    case "grace":
    case "unpaid":
      return "AlertTriangle"
    case "expired":
      return "XCircle"
    default:
      return "CheckCircle"
  }
}

/**
 * Calculate membership fee with tax if applicable
 */
export function calculateMembershipFee(
  rate: number | null | undefined,
  isTaxable: boolean | null | undefined
): string {
  if (!rate || rate === 0) {
    return "Free"
  }

  if (isTaxable) {
    const taxInclusiveRate = rate * 1.15 // 15% tax
    return `$${taxInclusiveRate.toFixed(2)}`
  }

  return `$${rate.toFixed(2)}`
}
