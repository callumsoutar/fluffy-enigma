import { z } from 'zod'

/**
 * Validation schemas for members API routes
 */

// UUID validation helper
const uuidSchema = z.string().uuid('Invalid UUID format')

// Person type enum
export const personTypeSchema = z.enum([
  'member',
  'instructor',
  'staff',
  'contact',
  'all',
])

// Membership status enum
export const membershipStatusSchema = z.enum([
  'active',
  'expired',
  'inactive',
  'all',
])

// Query parameters schema for GET /api/members
export const membersQuerySchema = z.object({
  person_type: personTypeSchema.optional(),
  membership_status: membershipStatusSchema.optional(),
  search: z.string().max(200, 'Search query too long').optional(),
  is_active: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true
      if (val === 'false') return false
      return undefined
    })
    .pipe(z.boolean().optional()),
  membership_type_id: uuidSchema.optional(),
})

// Request body schema for POST /api/members
export const memberCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  first_name: z.string().trim().max(100, 'First name too long').optional().nullable(),
  last_name: z.string().trim().max(100, 'Last name too long').optional().nullable(),
  phone: z.string().trim().max(20, 'Phone number too long').optional().nullable(),
  street_address: z.string().trim().max(200, 'Street address too long').optional().nullable(),
  send_invitation: z.boolean().optional().default(false),
}).strict()

// Member ID parameter schema
export const memberIdSchema = uuidSchema
