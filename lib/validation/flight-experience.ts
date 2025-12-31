import { z } from 'zod'

export const experienceUnitSchema = z.enum(['hours', 'count', 'landings'])

export const flightExperienceEntryUpsertSchema = z.object({
  experience_type_id: z.string().uuid('Invalid experience_type_id'),
  value: z.coerce.number().positive('Value must be greater than 0'),
  unit: experienceUnitSchema,
  notes: z.string().max(2000).optional().nullable(),
  conditions: z.string().max(2000).optional().nullable(),
}).superRefine((data, ctx) => {
  if ((data.unit === 'count' || data.unit === 'landings') && !Number.isInteger(data.value)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Counts/landings must be a whole number',
      path: ['value'],
    })
  }
})

export const flightExperienceUpsertBodySchema = z.object({
  entries: z.array(flightExperienceEntryUpsertSchema),
}).strict()


