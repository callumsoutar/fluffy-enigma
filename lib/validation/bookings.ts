import { z } from 'zod'

/**
 * Validation schemas for booking API routes
 */

// UUID validation helper
const uuidSchema = z.string().uuid('Invalid UUID format')

// Date validation (accepts ISO datetime string or YYYY-MM-DDTHH:mm format)
// Transforms short format to full ISO format for database compatibility
const dateSchema = z.string()
  .refine(
    (val) => {
      // Reject empty strings (they should be undefined/omitted instead)
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
  start_time: z.preprocess(
    (val) => val === '' ? undefined : val,
    dateSchema.optional()
  ),
  end_time: z.preprocess(
    (val) => val === '' ? undefined : val,
    dateSchema.optional()
  ),
  aircraft_id: uuidSchema.optional(),
  user_id: z.union([uuidSchema, z.null()]).optional(),
  instructor_id: z.union([uuidSchema, z.null()]).optional(),
  flight_type_id: z.union([uuidSchema, z.null()]).optional(),
  lesson_id: z.union([uuidSchema, z.null()]).optional(),
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
