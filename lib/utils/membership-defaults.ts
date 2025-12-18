import type { MembershipYearConfig } from "@/lib/types/settings"
import { calculateDefaultMembershipExpiry } from "./membership-year-utils"

/**
 * Utility functions for working with membership defaults
 */

/**
 * Get the default expiry date for a new membership based on the configured membership year
 * @param membershipYearConfig - The membership year configuration from settings
 * @param startDate - The date the membership starts (defaults to current date)
 * @returns Date object representing the default expiry date
 */
export function getDefaultMembershipExpiry(
  membershipYearConfig: MembershipYearConfig,
  startDate: Date = new Date()
): Date {
  return calculateDefaultMembershipExpiry(membershipYearConfig, startDate)
}

/**
 * Get the default membership year configuration
 * This is the default configuration that matches your aero club's April 1 - March 31 year
 */
export const DEFAULT_MEMBERSHIP_YEAR_CONFIG: MembershipYearConfig = {
  start_month: 4, // April
  start_day: 1,
  end_month: 3, // March
  end_day: 31,
}

/**
 * Helper function to format membership expiry dates for display
 * @param expiryDate - The expiry date to format
 * @returns Formatted string for display
 */
export function formatMembershipExpiry(expiryDate: Date): string {
  return expiryDate.toLocaleDateString("en-NZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/**
 * Helper function to check if a membership is expired
 * @param expiryDate - The membership expiry date
 * @param referenceDate - The date to check against (defaults to current date)
 * @returns Boolean indicating if the membership is expired
 */
export function isMembershipExpired(expiryDate: Date, referenceDate: Date = new Date()): boolean {
  return referenceDate > expiryDate
}

/**
 * Helper function to check if a membership is expiring soon
 * @param expiryDate - The membership expiry date
 * @param daysAhead - Number of days ahead to check (defaults to 30)
 * @param referenceDate - The date to check against (defaults to current date)
 * @returns Boolean indicating if the membership is expiring soon
 */
export function isMembershipExpiringSoon(
  expiryDate: Date,
  daysAhead: number = 30,
  referenceDate: Date = new Date()
): boolean {
  const warningDate = new Date(referenceDate)
  warningDate.setDate(warningDate.getDate() + daysAhead)

  return expiryDate <= warningDate && !isMembershipExpired(expiryDate, referenceDate)
}
