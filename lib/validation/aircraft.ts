import { z } from "zod"

const totalTimeMethodSchema = z.enum([
  "hobbs",
  "tacho",
  "airswitch",
  "hobbs less 5%",
  "hobbs less 10%",
  "tacho less 5%",
  "tacho less 10%",
])

export const aircraftCreateSchema = z.object({
  registration: z
    .string()
    .trim()
    .min(1, "Registration is required")
    .max(20, "Registration too long"),

  type: z.string().trim().min(1, "Type is required").max(100, "Type too long"),
  model: z.string().trim().max(100, "Model too long").optional().nullable(),
  manufacturer: z.string().trim().max(100, "Manufacturer too long").optional().nullable(),

  year_manufactured: z
    .coerce
    .number()
    .int("Year must be a whole number")
    .min(1900, "Invalid year")
    .max(2100, "Invalid year")
    .optional()
    .nullable(),

  status: z.string().trim().max(50, "Status too long").optional().nullable(),
  capacity: z.coerce.number().int().min(1, "Capacity must be >= 1").optional().nullable(),

  on_line: z.boolean().optional(),
  for_ato: z.boolean().optional(),
  prioritise_scheduling: z.boolean().optional(),

  aircraft_image_url: z
    .string()
    .trim()
    .url("Invalid url")
    .or(z.literal(""))
    .optional()
    .nullable(),

  total_time_in_service: z.coerce.number().min(0, "Total time in service must be >= 0").optional().nullable(),
  current_tach: z.coerce.number().min(0, "Current tach must be >= 0").optional().nullable(),
  current_hobbs: z.coerce.number().min(0, "Current hobbs must be >= 0").optional().nullable(),

  record_tacho: z.boolean().optional(),
  record_hobbs: z.boolean().optional(),
  record_airswitch: z.boolean().optional(),

  fuel_consumption: z.coerce.number().min(0, "Fuel consumption must be >= 0").optional().nullable(),
  total_time_method: totalTimeMethodSchema.optional().nullable(),

  aircraft_type_id: z.string().uuid("Invalid aircraft type id").optional().nullable(),
  notes: z.string().trim().max(2000, "Notes too long").optional().nullable(),
})

export type AircraftCreateInput = z.infer<typeof aircraftCreateSchema>


