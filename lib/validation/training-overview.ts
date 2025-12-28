import { z } from "zod"

const uuidSchema = z.string().uuid("Invalid UUID format")

export const trainingOverviewQuerySchema = z
  .object({
    view: z.enum(["at_risk", "active", "stale", "all"]).optional(),
    syllabus_id: uuidSchema.optional(),
    search: z.string().trim().max(200).optional(),
  })
  .strict()

export type TrainingOverviewQuery = z.infer<typeof trainingOverviewQuerySchema>


