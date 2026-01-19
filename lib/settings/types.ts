/**
 * Settings Types and Zod Schemas
 * 
 * FLAT STRUCTURE - All settings at top level for simplicity.
 * Complex values (objects/arrays) are stored as-is.
 * UI grouping is handled via SETTING_GROUPS constant.
 */

import { z } from 'zod';

// ============================================================================
// Complex Value Schemas (nested objects that stay as objects)
// ============================================================================

export const TimeSlotSchema = z.object({
  name: z.string(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Must be in HH:MM format'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Must be in HH:MM format'),
  days: z.array(z.enum([
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ])),
});

export type TimeSlot = z.infer<typeof TimeSlotSchema>;

export const MembershipYearSchema = z.object({
  start_month: z.number().min(1).max(12),
  end_month: z.number().min(1).max(12),
  start_day: z.number().min(1).max(31),
  end_day: z.number().min(1).max(31),
  description: z.string().optional(),
});

export type MembershipYear = z.infer<typeof MembershipYearSchema>;

// ============================================================================
// Flat Settings Schema - All settings at top level
// ============================================================================

export const SettingsSchema = z.object({
  // === General / Business Hours ===
  business_open_time: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Must be in HH:MM:SS format'),
  business_close_time: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Must be in HH:MM:SS format'),
  business_is_24_hours: z.boolean(),
  business_is_closed: z.boolean(),

  // === Booking Settings ===
  allow_past_bookings: z.boolean(),
  auto_cancel_unpaid_hours: z.number().min(0),
  booking_buffer_minutes: z.number().min(0),
  default_booking_duration_hours: z.number().min(0.5),
  maximum_booking_duration_hours: z.number().min(1),
  minimum_booking_duration_minutes: z.number().min(15),
  require_instructor_for_solo: z.boolean(),
  require_flight_authorization_for_solo: z.boolean(),
  custom_time_slots: z.array(TimeSlotSchema),

  // === Invoicing Settings ===
  auto_generate_invoices: z.boolean(),
  default_invoice_due_days: z.number().min(0),
  include_logo_on_invoice: z.boolean(),
  invoice_due_reminder_days: z.number().min(0),
  invoice_footer_message: z.string(),
  invoice_prefix: z.string().max(10),
  late_fee_percentage: z.number().min(0).max(100),
  payment_terms_days: z.number().min(0),
  payment_terms_message: z.string(),

  // === Maintenance Settings ===
  auto_ground_aircraft_maintenance: z.boolean(),
  default_maintenance_buffer_hours: z.number().min(0),
  require_maintenance_approval: z.boolean(),

  // === Membership Settings ===
  membership_year: MembershipYearSchema,

  // === Notification Settings ===
  booking_confirmation_enabled: z.boolean(),
  booking_reminder_enabled: z.boolean(),
  booking_reminder_hours: z.number().min(1),
  email_from_address: z.string(),
  email_reply_to: z.string(),
  maintenance_alert_enabled: z.boolean(),
  sms_enabled: z.boolean(),

  // === Security Settings ===
  failed_login_lockout_attempts: z.number().min(1),
  lockout_duration_minutes: z.number().min(1),
  require_password_change_days: z.number().min(0),
  session_timeout_minutes: z.number().min(1),

  // === System Settings ===
  allow_concurrent_bookings: z.boolean(),
  auto_confirm_bookings: z.boolean(),
  booking_advance_limit_days: z.number().min(1),
  default_booking_duration_minutes: z.number().min(15),
  maintenance_reminder_days: z.number().min(1),
  require_flight_authorization: z.boolean(),

  // === Training Settings ===
  default_lesson_duration_minutes: z.number().min(15),
  require_instructor_signature: z.boolean(),
  require_lesson_plan: z.boolean(),
  track_student_progress: z.boolean(),
});

export type Settings = z.infer<typeof SettingsSchema>;

// ============================================================================
// Partial Settings Schema (for overrides - all fields optional)
// ============================================================================

export const PartialSettingsSchema = SettingsSchema.partial();

export type PartialSettings = z.infer<typeof PartialSettingsSchema>;

// ============================================================================
// UI Grouping - For organizing settings in the UI (not for storage)
// ============================================================================

export const SETTING_GROUPS = {
  general: [
    'business_open_time',
    'business_close_time',
    'business_is_24_hours',
    'business_is_closed',
  ],
  bookings: [
    'allow_past_bookings',
    'auto_cancel_unpaid_hours',
    'booking_buffer_minutes',
    'default_booking_duration_hours',
    'maximum_booking_duration_hours',
    'minimum_booking_duration_minutes',
    'require_instructor_for_solo',
    'require_flight_authorization_for_solo',
    'custom_time_slots',
  ],
  invoicing: [
    'auto_generate_invoices',
    'default_invoice_due_days',
    'include_logo_on_invoice',
    'invoice_due_reminder_days',
    'invoice_footer_message',
    'invoice_prefix',
    'late_fee_percentage',
    'payment_terms_days',
    'payment_terms_message',
  ],
  maintenance: [
    'auto_ground_aircraft_maintenance',
    'default_maintenance_buffer_hours',
    'require_maintenance_approval',
  ],
  memberships: [
    'membership_year',
  ],
  notifications: [
    'booking_confirmation_enabled',
    'booking_reminder_enabled',
    'booking_reminder_hours',
    'email_from_address',
    'email_reply_to',
    'maintenance_alert_enabled',
    'sms_enabled',
  ],
  security: [
    'failed_login_lockout_attempts',
    'lockout_duration_minutes',
    'require_password_change_days',
    'session_timeout_minutes',
  ],
  system: [
    'allow_concurrent_bookings',
    'auto_confirm_bookings',
    'booking_advance_limit_days',
    'default_booking_duration_minutes',
    'maintenance_reminder_days',
    'require_flight_authorization',
  ],
  training: [
    'default_lesson_duration_minutes',
    'require_instructor_signature',
    'require_lesson_plan',
    'track_student_progress',
  ],
} as const;

export type SettingGroup = keyof typeof SETTING_GROUPS;

// For backward compatibility - alias to SettingGroup
export type SettingCategory = SettingGroup;

export const SETTING_CATEGORIES = Object.keys(SETTING_GROUPS) as SettingGroup[];

// ============================================================================
// Tenant Profile Schema (stored directly on tenants table - unchanged)
// ============================================================================

export const TenantProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  registration_number: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  website_url: z.string().url().nullable().optional().or(z.literal('')),
  logo_url: z.string().nullable().optional(),
  contact_email: z.string().email().nullable().optional().or(z.literal('')),
  contact_phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  billing_address: z.string().nullable().optional(),
  gst_number: z.string().nullable().optional(),
  timezone: z.string().default('Pacific/Auckland'),
  currency: z.string().length(3).default('NZD'),
});

export type TenantProfile = z.infer<typeof TenantProfileSchema>;

export const TenantProfileUpdateSchema = TenantProfileSchema.partial().omit({ id: true, slug: true });

export type TenantProfileUpdate = z.infer<typeof TenantProfileUpdateSchema>;
