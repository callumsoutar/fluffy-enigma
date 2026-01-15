import { z } from 'zod'
import { isoInstantSchema } from "./iso-instant"

/**
 * Validation schemas for booking API routes
 */

// UUID validation helper
const uuidSchema = z.string().uuid('Invalid UUID format')

// Canonical instant string: must include explicit timezone/offset.
// This prevents silent server-local/browser-local interpretation and avoids DST bugs.
const dateSchema = isoInstantSchema

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

/**
 * Query parameters schema for GET /api/bookings/overlaps
 *
 * Used to compute unavailable resources for a proposed booking time range.
 */
export const bookingOverlapsQuerySchema = z.object({
  start_time: dateSchema,
  end_time: dateSchema,
  exclude_booking_id: uuidSchema.optional(),
}).superRefine((data, ctx) => {
  const start = new Date(data.start_time)
  const end = new Date(data.end_time)

  if (Number.isNaN(start.getTime())) {
    ctx.addIssue({ code: "custom", message: "Invalid start_time", path: ["start_time"] })
  }
  if (Number.isNaN(end.getTime())) {
    ctx.addIssue({ code: "custom", message: "Invalid end_time", path: ["end_time"] })
  }
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start >= end) {
    ctx.addIssue({ code: "custom", message: "end_time must be after start_time", path: ["end_time"] })
  }
})

// Booking ID parameter schema
export const bookingIdSchema = uuidSchema

// POST request body schema (create new booking)
export const bookingCreateSchema = z.object({
  aircraft_id: uuidSchema,
  // Only staff can create bookings on behalf of other users; members/students will be forced to self on server.
  user_id: z.union([uuidSchema, z.null()]).optional(),
  instructor_id: z.union([uuidSchema, z.null()]).optional(),
  flight_type_id: z.union([uuidSchema, z.null()]).optional(),
  lesson_id: z.union([uuidSchema, z.null()]).optional(),
  booking_type: bookingTypeSchema.default('flight'),
  status: bookingStatusSchema.optional(),
  start_time: dateSchema,
  end_time: dateSchema,
  purpose: z.string().min(1, 'Purpose is required').max(1000, 'Purpose too long'),
  remarks: z.preprocess(
    (val) => val === '' ? null : val,
    z.string().max(2000, 'Remarks too long').optional().nullable()
  ),
  notes: z.preprocess(
    (val) => val === '' ? null : val,
    z.string().max(2000, 'Notes too long').optional().nullable()
  ),
}).strict().superRefine((data, ctx) => {
  const start = new Date(data.start_time)
  const end = new Date(data.end_time)

  if (Number.isNaN(start.getTime())) {
    ctx.addIssue({ code: "custom", message: "Invalid start_time", path: ["start_time"] })
  }
  if (Number.isNaN(end.getTime())) {
    ctx.addIssue({ code: "custom", message: "Invalid end_time", path: ["end_time"] })
  }
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start >= end) {
    ctx.addIssue({ code: "custom", message: "End time must be after start time", path: ["end_time"] })
  }
})

// Numeric validation for meter readings and times
// Note: durations like dual_time/solo_time can be 0.0, so we allow non-negative numbers.
const numericSchema = z.preprocess(
  (val) => {
    if (val === '' || val === null || (typeof val === 'number' && isNaN(val))) return null
    if (typeof val === 'string') {
      const parsed = parseFloat(val)
      return isNaN(parsed) ? val : parsed
    }
    return val
  },
  z.number().min(0).optional().nullable()
)

const billingBasisSchema = z.preprocess(
  (val) => val === '' ? null : val,
  z.enum(['hobbs', 'tacho', 'airswitch']).optional().nullable()
)

// PATCH request body schema (includes flight log fields)
export const bookingUpdateSchema = z.object({
  // Booking fields
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
  // Flight log fields (consolidated from flight_logs)
  checked_out_aircraft_id: z.union([uuidSchema, z.null()]).optional(),
  checked_out_instructor_id: z.union([uuidSchema, z.null()]).optional(),
  eta: z.preprocess(
    (val) => val === '' ? undefined : val,
    dateSchema.optional().nullable()
  ),
  hobbs_start: numericSchema,
  hobbs_end: numericSchema,
  tach_start: numericSchema,
  tach_end: numericSchema,
  airswitch_start: numericSchema,
  airswitch_end: numericSchema,
  flight_time_hobbs: numericSchema,
  flight_time_tach: numericSchema,
  flight_time_airswitch: numericSchema,
  flight_time: numericSchema,
  billing_basis: billingBasisSchema,
  billing_hours: numericSchema,
  fuel_on_board: z.preprocess(
    (val) => {
      if (val === '' || val === null || (typeof val === 'number' && isNaN(val))) return null
      if (typeof val === 'string') {
        const parsed = parseFloat(val)
        return isNaN(parsed) ? val : parsed
      }
      return val
    },
    z.number().int().min(0).optional().nullable()
  ),
  passengers: z.string().max(500).optional().nullable(),
  route: z.string().max(500).optional().nullable(),
  equipment: z.record(z.string(), z.unknown()).optional().nullable(),
  briefing_completed: z.boolean().optional(),
  authorization_completed: z.boolean().optional(),
  flight_remarks: z.string().max(2000).optional().nullable(),
  solo_end_hobbs: numericSchema,
  solo_end_tach: numericSchema,
  dual_time: numericSchema,
  solo_time: numericSchema,
  total_hours_start: numericSchema,
  total_hours_end: numericSchema,
  // Lesson progress fields
  instructor_comments: z.string().max(2000).optional().nullable(),
  lesson_highlights: z.string().max(2000).optional().nullable(),
  areas_for_improvement: z.string().max(2000).optional().nullable(),
  airmanship: z.string().max(2000).optional().nullable(),
  focus_next_lesson: z.string().max(2000).optional().nullable(),
  safety_concerns: z.string().max(2000).optional().nullable(),
  weather_conditions: z.string().max(2000).optional().nullable(),
  lesson_status: z.enum(['pass', 'not yet competent']).optional().nullable(),
  // Cancellation fields
  cancellation_category_id: z.union([uuidSchema, z.null()]).optional(),
  cancellation_reason: z.string().max(500).optional().nullable(),
  cancelled_notes: z.string().max(2000).optional().nullable(),
}).strict() // Reject unknown fields

/**
 * Booking check-in approval schema (financially critical)
 *
 * This validates the payload we pass into the atomic DB transaction RPC.
 * All pricing calculations happen client-side, but we validate shape/ranges here.
 */
const invoiceItemForAtomicCreateSchema = z.object({
  chargeable_id: z.union([uuidSchema, z.null()]).optional().nullable(),
  description: z.string().min(1).max(500),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  tax_rate: z.coerce.number().min(0).max(1).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export const bookingCheckinApproveSchema = z.object({
  checked_out_aircraft_id: uuidSchema,
  checked_out_instructor_id: z.union([uuidSchema, z.null()]).optional().nullable(),
  flight_type_id: uuidSchema,

  hobbs_start: numericSchema,
  hobbs_end: numericSchema,
  tach_start: numericSchema,
  tach_end: numericSchema,
  airswitch_start: numericSchema,
  airswitch_end: numericSchema,

  solo_end_hobbs: numericSchema,
  solo_end_tach: numericSchema,
  dual_time: numericSchema,
  solo_time: numericSchema,
  
  // Lesson progress fields
  instructor_comments: z.string().max(2000).optional().nullable(),
  lesson_highlights: z.string().max(2000).optional().nullable(),
  areas_for_improvement: z.string().max(2000).optional().nullable(),
  airmanship: z.string().max(2000).optional().nullable(),
  focus_next_lesson: z.string().max(2000).optional().nullable(),
  safety_concerns: z.string().max(2000).optional().nullable(),
  weather_conditions: z.string().max(2000).optional().nullable(),
  lesson_status: z.enum(['pass', 'not yet competent']).optional().nullable(),

  billing_basis: z.enum(['hobbs', 'tacho', 'airswitch']),
  billing_hours: z.coerce.number().positive(),

  tax_rate: z.coerce.number().min(0).max(1).optional().nullable(),
  due_date: z.preprocess(
    (val) => val === '' ? undefined : val,
    dateSchema.optional().nullable()
  ),
  reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),

  items: z.array(invoiceItemForAtomicCreateSchema).min(1),
}).strict()

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
