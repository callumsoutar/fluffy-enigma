import { z } from 'zod'

/**
 * Validation schemas for flight log API routes
 */

// UUID validation helper
const uuidSchema = z.string().uuid('Invalid UUID format')

// Date validation (accepts ISO datetime string or YYYY-MM-DDTHH:mm format)
const dateSchema = z.string()
  .refine(
    (val) => {
      if (val === '') return false
      // Accept full ISO datetime: 2024-01-01T12:00:00Z or 2024-01-01T12:00:00+00:00
      if (z.string().datetime().safeParse(val).success) {
        return true
      }
      // Accept short format: 2024-01-01T12:00 (YYYY-MM-DDTHH:mm)
      const shortFormatRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
      if (shortFormatRegex.test(val)) {
        return true
      }
      return false
    },
    { message: 'Invalid date format. Expected ISO datetime (e.g., 2024-01-01T12:00:00Z) or short format (e.g., 2024-01-01T12:00)' }
  )
  .transform((val) => {
    // If it's already a full ISO datetime, return as-is
    if (z.string().datetime().safeParse(val).success) {
      return val
    }
    // If it's short format (YYYY-MM-DDTHH:mm), append :00 for seconds and Z for UTC
    const shortFormatRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
    if (shortFormatRegex.test(val)) {
      return `${val}:00Z`
    }
    return val
  })
  .optional()
  .nullable()

// Numeric validation for meter readings and times
const numericSchema = z.coerce.number().positive().optional().nullable()

// Flight log creation/update schema
export const flightLogSchema = z.object({
  booking_id: uuidSchema,
  checked_out_aircraft_id: uuidSchema.optional().nullable(),
  checked_out_instructor_id: uuidSchema.optional().nullable(),
  actual_start: dateSchema,
  actual_end: dateSchema,
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
  actual_start: dateSchema,
  actual_end: dateSchema,
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
