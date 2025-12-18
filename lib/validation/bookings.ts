import { z } from 'zod'

/**
 * Validation schemas for booking API routes
 */

// UUID validation helper
const uuidSchema = z.string().uuid('Invalid UUID format')

// Date validation (ISO datetime string)
const dateSchema = z.string().datetime('Invalid date format')

// Booking status enum
export const bookingStatusSchema = z.enum([
  'unconfirmed',
  'confirmed',
  'briefing',
  'flying',
  'complete',
  'cancelled',
])

// Booking type enum
export const bookingTypeSchema = z.enum([
  'flight',
  'groundwork',
  'maintenance',
  'other',
])

// Query parameters schema for GET /api/bookings
export const bookingsQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined
      return val.split(',').map((s) => s.trim()).filter(Boolean)
    })
    .pipe(z.array(bookingStatusSchema).optional()),
  booking_type: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined
      return val.split(',').map((s) => s.trim()).filter(Boolean)
    })
    .pipe(z.array(bookingTypeSchema).optional()),
  aircraft_id: uuidSchema.optional(),
  instructor_id: uuidSchema.optional(),
  user_id: uuidSchema.optional(),
  search: z.string().max(200, 'Search query too long').optional(),
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
})

// Booking ID parameter schema
export const bookingIdSchema = uuidSchema

// PATCH request body schema
export const bookingUpdateSchema = z.object({
  start_time: dateSchema.optional(),
  end_time: dateSchema.optional(),
  aircraft_id: uuidSchema.optional(),
  user_id: uuidSchema.nullable().optional(),
  instructor_id: uuidSchema.nullable().optional(),
  flight_type_id: uuidSchema.nullable().optional(),
  lesson_id: uuidSchema.nullable().optional(),
  booking_type: bookingTypeSchema.optional(),
  purpose: z.string().min(1, 'Purpose is required').max(1000, 'Purpose too long').optional(),
  remarks: z.string().max(2000, 'Remarks too long').nullable().optional(),
  notes: z.string().max(2000, 'Notes too long').nullable().optional(),
  status: bookingStatusSchema.optional(),
}).strict() // Reject unknown fields

/**
 * Validate UUID string
 */
export function validateUUID(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    uuidSchema.parse(value)
    return value
  } catch {
    return undefined
  }
}

/**
 * Validate date string
 */
export function validateDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    dateSchema.parse(value)
    return value
  } catch {
    return undefined
  }
}
