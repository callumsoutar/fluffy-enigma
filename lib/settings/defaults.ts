/**
 * Settings Defaults and Utilities
 * 
 * FLAT STRUCTURE - All default values at top level.
 * Tenant overrides are stored in the database and merged at runtime.
 * 
 * IMPORTANT: Only modify defaults when deploying new features.
 * Changes here affect all tenants who haven't overridden the setting.
 */

import type { Settings, PartialSettings, TimeSlot, MembershipYear } from './types';

/**
 * Default time slots for bookings
 */
const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  {
    name: 'Morning',
    start_time: '08:00',
    end_time: '12:00',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  },
  {
    name: 'Afternoon',
    start_time: '12:00',
    end_time: '17:00',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  },
];

/**
 * Default membership year configuration
 */
const DEFAULT_MEMBERSHIP_YEAR: MembershipYear = {
  start_month: 4, // April
  end_month: 3, // March
  start_day: 1,
  end_day: 31,
  description: 'Membership year runs from April 1st to March 31st',
};

/**
 * Default settings for all tenants - FLAT STRUCTURE
 * 
 * These values are used when a tenant hasn't overridden a specific setting.
 * Only non-default values are stored in the database.
 */
export const DEFAULT_SETTINGS: Settings = {
  // === General / Business Hours ===
  business_open_time: '08:00:00',
  business_close_time: '17:00:00',
  business_is_24_hours: false,
  business_is_closed: false,

  // === Booking Settings ===
  allow_past_bookings: false,
  auto_cancel_unpaid_hours: 72,
  booking_buffer_minutes: 15,
  default_booking_duration_hours: 2,
  maximum_booking_duration_hours: 8,
  minimum_booking_duration_minutes: 30,
  require_instructor_for_solo: true,
  require_flight_authorization_for_solo: false,
  custom_time_slots: DEFAULT_TIME_SLOTS,

  // === Invoicing Settings ===
  auto_generate_invoices: false,
  default_invoice_due_days: 7,
  include_logo_on_invoice: true,
  invoice_due_reminder_days: 7,
  invoice_footer_message: 'Thank you for your business.',
  invoice_prefix: 'INV',
  late_fee_percentage: 0,
  payment_terms_days: 30,
  payment_terms_message: 'Payment is due within 7 days of receipt.',

  // === Maintenance Settings ===
  auto_ground_aircraft_maintenance: true,
  default_maintenance_buffer_hours: 10,
  require_maintenance_approval: true,

  // === Membership Settings ===
  membership_year: DEFAULT_MEMBERSHIP_YEAR,

  // === Notification Settings ===
  booking_confirmation_enabled: true,
  booking_reminder_enabled: true,
  booking_reminder_hours: 24,
  email_from_address: '',
  email_reply_to: '',
  maintenance_alert_enabled: true,
  sms_enabled: false,

  // === Security Settings ===
  failed_login_lockout_attempts: 5,
  lockout_duration_minutes: 30,
  require_password_change_days: 90,
  session_timeout_minutes: 480,

  // === System Settings ===
  allow_concurrent_bookings: false,
  auto_confirm_bookings: false,
  booking_advance_limit_days: 90,
  default_booking_duration_minutes: 60,
  maintenance_reminder_days: 7,
  require_flight_authorization: true,

  // === Training Settings ===
  default_lesson_duration_minutes: 60,
  require_instructor_signature: true,
  require_lesson_plan: true,
  track_student_progress: true,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get default value for a specific setting
 * @param key - Setting key
 * @returns The default value
 */
export function getDefaultValue<K extends keyof Settings>(key: K): Settings[K] {
  return DEFAULT_SETTINGS[key];
}

/**
 * Get effective settings by merging defaults with tenant overrides.
 * With flat structure, this is just a simple spread!
 * 
 * @param overrides - Tenant-specific setting overrides from database
 * @returns Complete settings object with all values filled in
 */
export function getEffectiveSettings(overrides: PartialSettings | null | undefined): Settings {
  if (!overrides) {
    return { ...DEFAULT_SETTINGS };
  }
  
  // Simple spread - overrides take precedence over defaults
  return { ...DEFAULT_SETTINGS, ...overrides };
}

/**
 * Extract only the values that differ from defaults.
 * This is used when saving settings to only store overrides.
 * 
 * @param values - The settings values to check
 * @returns Only the values that differ from defaults
 */
export function extractOverrides(values: PartialSettings): PartialSettings {
  const overrides: PartialSettings = {};

  for (const [key, value] of Object.entries(values)) {
    const settingKey = key as keyof Settings;
    const defaultValue = DEFAULT_SETTINGS[settingKey];
    
    // Skip undefined values
    if (value === undefined) {
      continue;
    }

    // Skip if value equals default (for primitives)
    if (value === defaultValue) {
      continue;
    }

    // For objects/arrays, compare JSON strings
    if (typeof value === 'object' && value !== null) {
      if (JSON.stringify(value) === JSON.stringify(defaultValue)) {
        continue;
      }
    }

    // Value differs from default, include it
    (overrides as Record<string, unknown>)[key] = value;
  }

  return overrides;
}
