import { z } from "zod"

const uuidSchema = z.string().uuid("Invalid UUID format")

export const memberIdParamSchema = uuidSchema

export const createSyllabusEnrollmentSchema = z
  .object({
    syllabus_id: uuidSchema,
    notes: z.string().trim().max(2000).optional().nullable(),
    primary_instructor_id: uuidSchema.optional().nullable(),
    aircraft_type: uuidSchema.optional().nullable(),
    enrolled_at: z.string().optional().nullable(),
    status: z.enum(["active", "completed", "withdrawn"]).optional(),
  })
  .strict()

export const logExamResultSchema = z.object({
  exam_id: uuidSchema,
  result: z.enum(["PASS", "FAIL"]),
  score: z.number().min(0).max(100).optional().nullable(),
  exam_date: z.string(),
  notes: z.string().trim().max(2000).optional().nullable(),
})


