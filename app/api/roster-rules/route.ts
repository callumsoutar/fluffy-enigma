import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { requireOperationsAccess } from "@/lib/api/require-operations-access"
import type { RosterRule } from "@/lib/types/roster"

const rosterRuleSelect = `
  id,
  instructor_id,
  day_of_week,
  start_time,
  end_time,
  is_active,
  effective_from,
  effective_until,
  notes,
  created_at,
  updated_at,
  voided_at
`

const listQuerySchema = z.object({
  day_of_week: z
    .string()
    .regex(/^[0-6]$/)
    .optional(),
  instructor_id: z.string().uuid().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/

const rosterRuleCreateSchema = z
  .object({
    instructor_id: z.string().uuid(),
    day_of_week: z.number().min(0).max(6).optional(),
    days_of_week: z.array(z.number().min(0).max(6)).optional(),
    start_time: z.string().regex(timePattern),
    end_time: z.string().regex(timePattern),
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    effective_until: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .superRefine((payload, ctx) => {
    if (payload.day_of_week === undefined && (!payload.days_of_week || payload.days_of_week.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["day_of_week"],
        message: "At least one day of the week must be specified",
      })
    }

    if (payload.end_time <= payload.start_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_time"],
        message: "End time must be after start time",
      })
    }

    if (payload.effective_until && payload.effective_until < payload.effective_from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effective_until"],
        message: "Effective until date must be on or after the start date",
      })
    }
  })

export async function GET(request: NextRequest) {
  const auth = await requireOperationsAccess(request)
  if ("error" in auth) {
    return auth.error
  }

  const searchParams = new URL(request.url).searchParams
  const parsedParams = listQuerySchema.safeParse({
    day_of_week: searchParams.get("day_of_week") ?? undefined,
    instructor_id: searchParams.get("instructor_id") ?? undefined,
  })

  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsedParams.error.issues },
      { status: 400 }
    )
  }

  const { supabase } = auth
  const query = supabase.from("roster_rules").select(rosterRuleSelect)

  if (parsedParams.data.date) {
    const date = parsedParams.data.date
    // Use the date to determine day of week and filter by effective range
    // We parse manually to avoid timezone shifts
    const [year, month, day] = date.split("-").map(Number)
    const dow = new Date(year, month - 1, day).getDay()

    query.eq("day_of_week", dow)
    query.lte("effective_from", date)
    query.or(`effective_until.gte.${date},effective_until.is.null`)
  } else if (parsedParams.data.day_of_week !== undefined) {
    query.eq("day_of_week", Number(parsedParams.data.day_of_week))
  }

  if (parsedParams.data.instructor_id) {
    query.eq("instructor_id", parsedParams.data.instructor_id)
  }

  query.eq("is_active", true).is("voided_at", null)

  const { data, error } = await query.order("start_time", { ascending: true })

  if (error) {
    console.error("Failed to load roster rules:", error)
    return NextResponse.json({ error: "Failed to load roster rules" }, { status: 500 })
  }

  return NextResponse.json({ roster_rules: (data || []) as RosterRule[] })
}

export async function POST(request: NextRequest) {
  const auth = await requireOperationsAccess(request)
  if ("error" in auth) {
    return auth.error
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = rosterRuleCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { supabase } = auth
  const { day_of_week, days_of_week, ...rest } = parsed.data

  const daysToInsert = days_of_week ?? (day_of_week !== undefined ? [day_of_week] : [])

  if (daysToInsert.length === 0) {
    return NextResponse.json({ error: "No days specified" }, { status: 400 })
  }

  const inserts = daysToInsert.map((dow) => ({
    ...rest,
    day_of_week: dow,
    is_active: true,
    voided_at: null,
  }))

  const { data, error } = await supabase
    .from("roster_rules")
    .insert(inserts)
    .select(rosterRuleSelect)

  if (error) {
    console.error("Failed to create roster rule(s):", error)
    return NextResponse.json({ error: "Failed to create roster rule(s)" }, { status: 500 })
  }

  return NextResponse.json({ roster_rules: data })
}

