import type { MembershipYearConfig } from "@/lib/types/settings"

/**
 * Utility functions for working with membership year configurations
 */

/**
 * Calculate the start and end dates for a membership year based on a given date
 * @param membershipYearConfig - The membership year configuration
 * @param referenceDate - The date to calculate the membership year for (defaults to current date)
 * @returns Object containing start and end dates of the membership year
 */
export function calculateMembershipYear(
  membershipYearConfig: MembershipYearConfig,
  referenceDate: Date = new Date()
): { startDate: Date; endDate: Date } {
  const currentYear = referenceDate.getFullYear()
  const currentMonth = referenceDate.getMonth() + 1 // getMonth() returns 0-11
  const currentDay = referenceDate.getDate()

  const { start_month, start_day, end_month, end_day } = membershipYearConfig

  let startDate: Date
  let endDate: Date

  // Determine which membership year we're in
  if (currentMonth > start_month || (currentMonth === start_month && currentDay >= start_day)) {
    // We're in the current membership year (e.g., if it's April 15, 2024, we're in 2024-2025 membership year)
    startDate = new Date(currentYear, start_month - 1, start_day)
    endDate = new Date(currentYear + 1, end_month - 1, end_day)
  } else {
    // We're in the previous membership year (e.g., if it's March 15, 2024, we're in 2023-2024 membership year)
    startDate = new Date(currentYear - 1, start_month - 1, start_day)
    endDate = new Date(currentYear, end_month - 1, end_day)
  }

  return { startDate, endDate }
}

/**
 * Calculate the next membership year start date
 * @param membershipYearConfig - The membership year configuration
 * @param referenceDate - The date to calculate from (defaults to current date)
 * @returns Date object representing the start of the next membership year
 */
export function getNextMembershipYearStart(
  membershipYearConfig: MembershipYearConfig,
  referenceDate: Date = new Date()
): Date {
  const { startDate, endDate } = calculateMembershipYear(membershipYearConfig, referenceDate)

  // If we're past the end date of current membership year, return next year's start
  if (referenceDate > endDate) {
    const nextYear = referenceDate.getFullYear() + 1
    return new Date(
      nextYear,
      membershipYearConfig.start_month - 1,
      membershipYearConfig.start_day
    )
  }

  // Otherwise return the start of the next membership year
  const nextYear = startDate.getFullYear() + 1
  return new Date(
    nextYear,
    membershipYearConfig.start_month - 1,
    membershipYearConfig.start_day
  )
}

/**
 * Calculate the default expiry date for a new membership
 * @param membershipYearConfig - The membership year configuration
 * @param startDate - The date the membership starts (defaults to current date)
 * @returns Date object representing the default expiry date
 */
export function calculateDefaultMembershipExpiry(
  membershipYearConfig: MembershipYearConfig,
  startDate: Date = new Date()
): Date {
  const { endDate } = calculateMembershipYear(membershipYearConfig, startDate)
  return endDate
}

/**
 * Calculate the expiry date for a membership renewal
 * This calculates the NEXT membership year's end date after the current membership's expiry
 * @param membershipYearConfig - The membership year configuration
 * @param currentExpiryDate - The expiry date of the current membership being renewed (Date or string)
 * @returns Date object representing the expiry date for the renewed membership
 */
export function calculateRenewalExpiry(
  membershipYearConfig: MembershipYearConfig,
  currentExpiryDate: Date | string
): Date {
  // Ensure we have a Date object (handle string dates from database)
  const expiryDate =
    typeof currentExpiryDate === "string"
      ? new Date(`${currentExpiryDate}T00:00:00Z`) // Date-only → interpret at UTC midnight (avoid implicit local TZ)
      : currentExpiryDate

  // For a renewal, we want the next membership year after the current expiry
  // If current expiry is March 31, 2026, renewal should be March 31, 2027
  // Simply add 1 year to the expiry date's year and set to end of membership year
  const expiryYear = expiryDate.getFullYear()
  const nextMembershipYearEnd = new Date(
    expiryYear + 1,
    membershipYearConfig.end_month - 1, // end_month is 3 (March), so 3-1 = 2
    membershipYearConfig.end_day // 31
  )

  return nextMembershipYearEnd
}

/**
 * Check if a given date falls within the membership year
 * @param date - The date to check
 * @param membershipYearConfig - The membership year configuration
 * @returns Boolean indicating if the date is within the membership year
 */
export function isWithinMembershipYear(
  date: Date,
  membershipYearConfig: MembershipYearConfig
): boolean {
  const { startDate, endDate } = calculateMembershipYear(membershipYearConfig, date)
  return date >= startDate && date <= endDate
}

/**
 * Format membership year configuration for display
 * @param membershipYearConfig - The membership year configuration
 * @returns Formatted string describing the membership year
 */
export function formatMembershipYear(membershipYearConfig: MembershipYearConfig): string {
  const { start_month, start_day, end_month, end_day } = membershipYearConfig

  const startMonthName = new Date(2024, start_month - 1, 1).toLocaleString("default", {
    month: "long",
  })
  const endMonthName = new Date(2024, end_month - 1, 1).toLocaleString("default", {
    month: "long",
  })

  return `${startMonthName} ${start_day}${getOrdinalSuffix(start_day)} to ${endMonthName} ${end_day}${getOrdinalSuffix(end_day)}`
}

/**
 * Get ordinal suffix for day numbers (1st, 2nd, 3rd, 4th, etc.)
 * @param day - The day number
 * @returns Ordinal suffix string
 */
function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return "th"
  }

  switch (day % 10) {
    case 1:
      return "st"
    case 2:
      return "nd"
    case 3:
      return "rd"
    default:
      return "th"
  }
}

/**
 * Get a human-readable membership year label (e.g., "2024-2025 Membership Year")
 * @param membershipYearConfig - The membership year configuration
 * @param referenceDate - The date to calculate from (defaults to current date)
 * @returns Formatted membership year label
 */
export function getMembershipYearLabel(
  membershipYearConfig: MembershipYearConfig,
  referenceDate: Date = new Date()
): string {
  const { startDate, endDate } = calculateMembershipYear(membershipYearConfig, referenceDate)
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()

  return `${startYear}-${endYear} Membership Year`
}

/**
 * Validate membership year configuration
 * @param config - The membership year configuration to validate
 * @returns Object with validation result and error message if invalid
 */
export function validateMembershipYearConfig(config: MembershipYearConfig): {
  isValid: boolean
  error?: string
} {
  // Check if months are valid (1-12)
  if (config.start_month < 1 || config.start_month > 12) {
    return { isValid: false, error: "Start month must be between 1 and 12" }
  }

  if (config.end_month < 1 || config.end_month > 12) {
    return { isValid: false, error: "End month must be between 1 and 12" }
  }

  // Check if days are valid (1-31)
  if (config.start_day < 1 || config.start_day > 31) {
    return { isValid: false, error: "Start day must be between 1 and 31" }
  }

  if (config.end_day < 1 || config.end_day > 31) {
    return { isValid: false, error: "End day must be between 1 and 31" }
  }

  // Check if the dates are valid for their respective months
  const startDate = new Date(2024, config.start_month - 1, config.start_day)
  const endDate = new Date(2024, config.end_month - 1, config.end_day)

  if (startDate.getMonth() !== config.start_month - 1 || startDate.getDate() !== config.start_day) {
    return {
      isValid: false,
      error: "Invalid start date (day does not exist in the specified month)",
    }
  }

  if (endDate.getMonth() !== config.end_month - 1 || endDate.getDate() !== config.end_day) {
    return {
      isValid: false,
      error: "Invalid end date (day does not exist in the specified month)",
    }
  }

  return { isValid: true }
}
