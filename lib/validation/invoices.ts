import { z } from 'zod'
import { isoInstantSchema } from "./iso-instant"

/**
 * Validation schemas for invoice API routes
 */

// UUID validation helper
const uuidSchema = z.string().uuid('Invalid UUID format')

// Canonical instant string: must include explicit timezone/offset.
// Invoice timestamps are stored as UTC instants; date-only inputs are intentionally NOT accepted
// to avoid ambiguous timezone interpretation.
const dateSchema = isoInstantSchema

// Invoice status enum
export const invoiceStatusSchema = z.enum([
  'draft',
  'pending',
  'paid',
  'overdue',
  'cancelled',
  'refunded',
])

// Payment method enum (matches database enum `payment_method`)
export const paymentMethodSchema = z.enum([
  'cash',
  'credit_card',
  'debit_card',
  'bank_transfer',
  'check',
  'online_payment',
  'other',
]).optional().nullable()

// Numeric validation for currency amounts (positive, 2 decimal places)
const currencySchema = z.preprocess(
  (val) => {
    if (val === '' || val === null || val === undefined) return null
    if (typeof val === 'string') {
      const parsed = parseFloat(val)
      return isNaN(parsed) ? null : parsed
    }
    return val
  },
  z.coerce.number().nonnegative('Amount must be positive').max(999999999.99, 'Amount too large').nullable()
)

// Tax rate validation (0-1 range, representing 0-100%)
const taxRateSchema = z.preprocess(
  (val) => {
    if (val === '' || val === null || val === undefined) return 0
    if (typeof val === 'string') {
      const parsed = parseFloat(val)
      return isNaN(parsed) ? 0 : parsed
    }
    return val
  },
  z.coerce.number().min(0, 'Tax rate must be non-negative').max(1, 'Tax rate cannot exceed 100%')
)

// Query parameters schema for GET /api/invoices
export const invoicesQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined
      return val.split(',').map((s) => s.trim()).filter(Boolean)
    })
    .pipe(z.array(invoiceStatusSchema).optional()),
  user_id: uuidSchema.optional(),
  search: z.string().max(200, 'Search query too long').optional(),
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
})

// Invoice ID parameter schema
export const invoiceIdSchema = uuidSchema

// Invoice item schema for creating/updating items
export const invoiceItemCreateSchema = z.object({
  invoice_id: uuidSchema,
  chargeable_id: uuidSchema.optional().nullable(),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  quantity: z.coerce.number().positive('Quantity must be positive').max(9999, 'Quantity too large'),
  unit_price: currencySchema,
  tax_rate: taxRateSchema.optional().nullable(),
  notes: z.string().max(2000, 'Notes too long').optional().nullable(),
}).strict()

export const invoiceItemUpdateSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500, 'Description too long').optional(),
  quantity: z.coerce.number().positive('Quantity must be positive').max(9999, 'Quantity too large').optional(),
  unit_price: currencySchema.optional(),
  tax_rate: taxRateSchema.optional().nullable(),
  notes: z.string().max(2000, 'Notes too long').optional().nullable(),
}).strict()

// POST request body schema for creating invoice
export const invoiceCreateSchema = z.object({
  user_id: uuidSchema,
  status: invoiceStatusSchema.optional().default('draft'),
  invoice_number: z.string().max(100, 'Invoice number too long').optional().nullable(),
  issue_date: dateSchema.optional(),
  due_date: dateSchema.optional().nullable(),
  reference: z.string().max(200, 'Reference too long').optional().nullable(),
  notes: z.string().max(2000, 'Notes too long').optional().nullable(),
  booking_id: uuidSchema.optional().nullable(),
  tax_rate: taxRateSchema.optional(),
  // Items array for creating invoice with items
  items: z.array(z.object({
    chargeable_id: uuidSchema.optional().nullable(),
    description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
    quantity: z.coerce.number().positive('Quantity must be positive').max(9999, 'Quantity too large'),
    unit_price: currencySchema,
    tax_rate: taxRateSchema.optional().nullable(),
    notes: z.string().max(2000, 'Notes too long').optional().nullable(),
  })).min(1, 'Invoice must include at least one item'),
}).strict()

// PATCH request body schema for updating invoice
export const invoiceUpdateSchema = z.object({
  user_id: uuidSchema.optional(),
  status: invoiceStatusSchema.optional(),
  invoice_number: z.string().max(100, 'Invoice number too long').optional().nullable(),
  issue_date: dateSchema.optional(),
  due_date: dateSchema.optional().nullable(),
  paid_date: dateSchema.optional().nullable(),
  reference: z.string().max(200, 'Reference too long').optional().nullable(),
  notes: z.string().max(2000, 'Notes too long').optional().nullable(),
  booking_id: z.union([uuidSchema, z.null()]).optional(),
  tax_rate: taxRateSchema.optional(),
  payment_method: paymentMethodSchema,
  payment_reference: z.string().max(200, 'Payment reference too long').optional().nullable(),
  subtotal: currencySchema.optional(),
  tax_total: currencySchema.optional(),
  total_amount: currencySchema.optional(),
  total_paid: currencySchema.optional(),
  balance_due: currencySchema.optional(),
}).strict()

// POST body schema for recording a payment against an invoice
const currencyPositiveSchema = z.preprocess(
  (val) => {
    if (val === '' || val === null || val === undefined) return null
    if (typeof val === 'string') {
      const parsed = parseFloat(val)
      return isNaN(parsed) ? null : parsed
    }
    return val
  },
  z.coerce.number().positive('Amount must be greater than zero').max(999999999.99, 'Amount too large')
)

export const invoicePaymentCreateSchema = z.object({
  amount: currencyPositiveSchema,
  payment_method: z.enum([
    'cash',
    'credit_card',
    'debit_card',
    'bank_transfer',
    'check',
    'online_payment',
    'other',
  ]),
  payment_reference: z.string().max(200, 'Payment reference too long').optional().nullable(),
  notes: z.string().max(2000, 'Notes too long').optional().nullable(),
  paid_at: dateSchema.optional().nullable(),
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
