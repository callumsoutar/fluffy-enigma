import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { requireOperationsAccess } from "@/lib/api/require-operations-access"
import type { RosterRule } from "@/lib/types/roster"

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/

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

const rosterRuleUpdateSchema = z
  .object({
    day_of_week: z.number().min(0).max(6).optional(),
    start_time: z.string().regex(timePattern).optional(),
    end_time: z.string().regex(timePattern).optional(),
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    effective_until: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    notes: z.string().max(1000).optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .superRefine((update, ctx) => {
    if (update.start_time && update.end_time && update.end_time <= update.start_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_time"],
        message: "End time must be after start time",
      })
    }

    if (
      update.effective_from &&
      update.effective_until &&
      update.effective_until < update.effective_from
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effective_until"],
        message: "Effective until date must be on or after the start date",
      })
    }
  })

const rosterRuleIdSchema = z.string().uuid()

async function authorize(request: NextRequest) {
  const auth = await requireOperationsAccess(request)
  if ("error" in auth) {
    return { error: auth.error }
  }
  return { supabase: auth.supabase }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize(request)
  if (auth.error) {
    return auth.error
  }

  const { id } = await params
  const parsedId = rosterRuleIdSchema.safeParse(id)
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid roster rule ID" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = rosterRuleUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.issues },
      { status: 400 }
    )
  }

  const updates = parsed.data
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from("roster_rules")
    .update({ ...updates })
    .eq("id", parsedId.data)
    .select(rosterRuleSelect)
    .single()

  if (error) {
    console.error("Failed to update roster rule:", error)
    return NextResponse.json({ error: "Failed to update roster rule" }, { status: 500 })
  }

  return NextResponse.json({ roster_rule: data as RosterRule })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize(request)
  if (auth.error) {
    return auth.error
  }

  const { id } = await params
  const parsedId = rosterRuleIdSchema.safeParse(id)
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid roster rule ID" }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from("roster_rules")
    .update({ voided_at: new Date().toISOString() })
    .eq("id", parsedId.data)

  if (error) {
    console.error("Failed to archive roster rule:", error)
    return NextResponse.json({ error: "Failed to delete roster rule" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

