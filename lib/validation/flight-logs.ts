import { z } from 'zod'
import { isoInstantSchema } from "./iso-instant"

/**
 * Validation schemas for flight log API routes
 */

// UUID validation helper
const uuidSchema = z.string().uuid('Invalid UUID format')

// Canonical instant string: must include explicit timezone/offset.
// This prevents silent server-local/browser-local interpretation and avoids DST bugs.
const dateSchema = isoInstantSchema.optional().nullable()

// Numeric validation for meter readings and times
const numericSchema = z.coerce.number().positive().optional().nullable()

// Flight log creation/update schema
export const flightLogSchema = z.object({
  booking_id: uuidSchema,
  checked_out_aircraft_id: uuidSchema.optional().nullable(),
  checked_out_instructor_id: uuidSchema.optional().nullable(),
  eta: dateSchema,
  hobbs_start: numericSchema,
  hobbs_end: numericSchema,
  tach_start: numericSchema,
  tach_end: numericSchema,
  flight_time_hobbs: numericSchema,
  flight_time_tach: numericSchema,
  flight_time: numericSchema,
  fuel_on_board: z.coerce.number().int().min(0).optional().nullable(),
  passengers: z.string().max(500).optional().nullable(),
  route: z.string().max(500).optional().nullable(),
  equipment: z.record(z.string(), z.unknown()).optional().nullable(),
  briefing_completed: z.boolean().optional(),
  authorization_completed: z.boolean().optional(),
  flight_remarks: z.string().max(2000).optional().nullable(),
  solo_end_hobbs: numericSchema,
  dual_time: numericSchema,
  solo_time: numericSchema,
  total_hours_start: numericSchema,
  total_hours_end: numericSchema,
  flight_type_id: uuidSchema.optional().nullable(),
  lesson_id: uuidSchema.optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  remarks: z.string().max(2000).optional().nullable(),
})

// Schema for checkout form (allows partial data)
// Includes booking fields that can be edited during checkout
export const flightLogCheckoutSchema = z.object({
  booking_id: uuidSchema, // booking_id is required
  // Flight log fields (all optional for checkout)
  checked_out_aircraft_id: uuidSchema.optional().nullable(),
  checked_out_instructor_id: uuidSchema.optional().nullable(),
  eta: dateSchema,
  hobbs_start: numericSchema,
  hobbs_end: numericSchema,
  tach_start: numericSchema,
  tach_end: numericSchema,
  flight_time_hobbs: numericSchema,
  flight_time_tach: numericSchema,
  flight_time: numericSchema,
  fuel_on_board: z.coerce.number().int().min(0).optional().nullable(),
  passengers: z.string().max(500).optional().nullable(),
  route: z.string().max(500).optional().nullable(),
  equipment: z.record(z.string(), z.unknown()).optional().nullable(),
  briefing_completed: z.boolean().optional(),
  authorization_completed: z.boolean().optional(),
  flight_remarks: z.string().max(2000).optional().nullable(),
  solo_end_hobbs: numericSchema,
  dual_time: numericSchema,
  solo_time: numericSchema,
  total_hours_start: numericSchema,
  total_hours_end: numericSchema,
  // New flight log fields
  flight_type_id: uuidSchema.optional().nullable(),
  lesson_id: uuidSchema.optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  remarks: z.string().max(2000).optional().nullable(),
  // Booking fields that can be edited during checkout
  purpose: z.string().min(1, "Purpose is required").optional(),
})

export type FlightLogFormData = z.infer<typeof flightLogCheckoutSchema>

// Schema for check-in form (post-flight data capture)
// Focuses on meter readings and finalizing flight details
export const flightLogCheckinSchema = z.object({
  booking_id: uuidSchema, // booking_id is required
  // Meter readings (primary focus for check-in)
  hobbs_start: numericSchema,
  hobbs_end: numericSchema,
  tach_start: numericSchema,
  tach_end: numericSchema,
  // Calculated flight times (can be auto-calculated from meter readings)
  flight_time_hobbs: numericSchema,
  flight_time_tach: numericSchema,
  flight_time: numericSchema,
  // Flight log fields that can be edited during check-in
  checked_out_aircraft_id: uuidSchema.optional().nullable(),
  checked_out_instructor_id: uuidSchema.optional().nullable(),
  flight_type_id: uuidSchema.optional().nullable(),
  lesson_id: uuidSchema.optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  remarks: z.string().max(2000).optional().nullable(),
  fuel_on_board: z.coerce.number().int().min(0).optional().nullable(),
  passengers: z.string().max(500).optional().nullable(),
  route: z.string().max(500).optional().nullable(),
  flight_remarks: z.string().max(2000).optional().nullable(),
  // Additional time tracking fields
  solo_end_hobbs: numericSchema,
  dual_time: numericSchema,
  solo_time: numericSchema,
  total_hours_start: numericSchema,
  total_hours_end: numericSchema,
})

export type FlightLogCheckinFormData = z.infer<typeof flightLogCheckinSchema>
