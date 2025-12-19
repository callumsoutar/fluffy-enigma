import { z } from 'zod'

const uuidSchema = z.string().uuid('Invalid UUID format')

// Accept ISO datetime or YYYY-MM-DD (same convention as invoice validators)
const dateSchema = z
  .string()
  .refine((val) => {
    if (val === '') return false
    if (z.string().datetime().safeParse(val).success) return true
    return /^\d{4}-\d{2}-\d{2}$/.test(val)
  }, { message: 'Invalid date format. Expected ISO datetime or YYYY-MM-DD' })
  .transform((val) => {
    if (z.string().datetime().safeParse(val).success) return val
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return `${val}T00:00:00Z`
    return val
  })

export const accountStatementQuerySchema = z.object({
  user_id: uuidSchema,
  start_date: dateSchema.optional(),
  end_date: dateSchema.optional(),
})


