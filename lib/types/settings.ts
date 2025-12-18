/**
 * Settings types
 */

export interface MembershipYearConfig {
  start_month: number // 1-12
  end_month: number // 1-12
  start_day: number // 1-31
  end_day: number // 1-31
  description?: string // Optional description of the membership year
}
