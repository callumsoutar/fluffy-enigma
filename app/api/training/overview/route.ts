import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTenantContext } from "@/lib/auth/tenant"
import { trainingOverviewQuerySchema } from "@/lib/validation/training-overview"
import type {
  TrainingActivityStatus,
  TrainingOverviewResponse,
  TrainingOverviewRow,
  TrainingOverviewSyllabus,
  TrainingOverviewSyllabusStats,
  TrainingProgressSummary,
} from "@/lib/types/training-overview"

const ACTIVE_DAYS = 30
const AT_RISK_DAYS = 60
const NEW_NEVER_FLOWN_DAYS = 14
const STALE_NEVER_FLOWN_DAYS = 30

function daysBetween(nowMs: number, isoDate: string) {
  const ms = new Date(isoDate).getTime()
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.floor((nowMs - ms) / (1000 * 60 * 60 * 24)))
}

function classifyActivity(args: {
  nowMs: number
  enrolled_at: string
  last_flight_at: string | null
}): { status: TrainingActivityStatus; days_since_last_flight: number | null; days_since_enrolled: number } {
  const daysSinceEnrolled = daysBetween(args.nowMs, args.enrolled_at) ?? 0

  if (!args.last_flight_at) {
    if (daysSinceEnrolled <= NEW_NEVER_FLOWN_DAYS) {
      return { status: "new", days_since_last_flight: null, days_since_enrolled: daysSinceEnrolled }
    }
    if (daysSinceEnrolled <= STALE_NEVER_FLOWN_DAYS) {
      return { status: "at_risk", days_since_last_flight: null, days_since_enrolled: daysSinceEnrolled }
    }
    return { status: "stale", days_since_last_flight: null, days_since_enrolled: daysSinceEnrolled }
  }

  const daysSinceLast = daysBetween(args.nowMs, args.last_flight_at)
  const d = daysSinceLast ?? 0
  if (d <= ACTIVE_DAYS) return { status: "active", days_since_last_flight: d, days_since_enrolled: daysSinceEnrolled }
  if (d <= AT_RISK_DAYS) return { status: "at_risk", days_since_last_flight: d, days_since_enrolled: daysSinceEnrolled }
  return { status: "stale", days_since_last_flight: d, days_since_enrolled: daysSinceEnrolled }
}

function makeProgress(completed: number, total: number): TrainingProgressSummary {
  if (total <= 0) return { completed, total, percent: null }
  const pct = Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
  return { completed, total, percent: pct }
}

function statusSortKey(status: TrainingActivityStatus) {
  // Higher = more urgent
  if (status === "stale") return 3
  if (status === "at_risk") return 2
  if (status === "new") return 1
  return 0
}

/**
 * GET /api/training/overview
 *
 * Club-wide training overview:
 * - Active syllabus enrollments
 * - Last flight date (from bookings)
 * - Progress proxy (distinct completed lesson_ids vs total lessons for syllabus)
 *
 * Security:
 * - Requires authentication
 * - Requires owner/admin/instructor role
 * - RLS enforces final data access
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  // Get tenant context (includes auth check)
  let tenantContext
  try {
    tenantContext = await getTenantContext(supabase)
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === 'UNAUTHORIZED') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error.code === 'NO_MEMBERSHIP') {
      return NextResponse.json({ error: "Forbidden: No tenant membership" }, { status: 403 })
    }
    return NextResponse.json({ error: "Failed to resolve tenant" }, { status: 500 })
  }

  const { userRole } = tenantContext
  const hasAccess = ["owner", "admin", "instructor"].includes(userRole)
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const queryParams: Record<string, string | undefined> = {}
  for (const [key, value] of searchParams.entries()) {
    queryParams[key] = value
  }

  const validation = trainingOverviewQuerySchema.safeParse(queryParams)
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: validation.error.issues },
      { status: 400 }
    )
  }

  const syllabusFilterId = validation.data.syllabus_id

  const nowMs = Date.now()

  // Fetch active enrollments (club-wide)
  const { data: enrollments, error: enrollmentError } = await supabase
    .from("student_syllabus_enrollment")
    .select(
      `
        id,
        user_id,
        syllabus_id,
        enrolled_at,
        completion_date,
        status,
        primary_instructor_id,
        syllabus:syllabus_id (
          id,
          name
        ),
        student:user_id (
          id,
          first_name,
          last_name,
          email,
          is_active,
          date_of_last_flight
        )
      `
    )
    .eq("status", "active")
    .is("completion_date", null)
    .order("enrolled_at", { ascending: false })

  if (enrollmentError) {
    console.error("Error fetching training enrollments:", enrollmentError)
    return NextResponse.json({ error: "Failed to fetch training enrollments" }, { status: 500 })
  }

  const rawEnrollments = (enrollments || []) as Array<{
    id: string
    user_id: string
    syllabus_id: string
    enrolled_at: string
    status: string
    completion_date: string | null
    primary_instructor_id: string | null
    syllabus?: TrainingOverviewSyllabus | TrainingOverviewSyllabus[] | null
    student?:
      | (TrainingOverviewRow["student"] & { date_of_last_flight?: string | null })
      | Array<TrainingOverviewRow["student"] & { date_of_last_flight?: string | null }>
      | null
  }>

  if (!rawEnrollments.length) {
    const { data: syllabi } = await supabase
      .from("syllabus")
      .select("id, name")
      .eq("is_active", true)
      .is("voided_at", null)
      .order("name", { ascending: true })

    const empty: TrainingOverviewResponse = {
      rows: [],
      stats: { total_enrollments: 0, active: 0, at_risk: 0, stale: 0, never_flown: 0, by_syllabus: [] },
      syllabi: (syllabi || []) as TrainingOverviewSyllabus[],
      generated_at: new Date().toISOString(),
    }

    return NextResponse.json(empty)
  }

  // Normalize relationship selects (Supabase can sometimes return arrays)
  const normalizedEnrollments = rawEnrollments
    .map((e) => {
      const syllabus = Array.isArray(e.syllabus) ? (e.syllabus[0] ?? null) : (e.syllabus ?? null)
      const student = Array.isArray(e.student) ? (e.student[0] ?? null) : (e.student ?? null)
      return { ...e, syllabus, student }
    })
    .filter((e) => Boolean(e.syllabus) && Boolean(e.student))

  const baseEnrollments = syllabusFilterId
    ? normalizedEnrollments.filter((e) => e.syllabus_id === syllabusFilterId)
    : normalizedEnrollments

  const userIds = Array.from(new Set(baseEnrollments.map((e) => e.user_id)))
  const syllabusIds = Array.from(new Set(baseEnrollments.map((e) => e.syllabus_id)))

  // Fetch syllabi list for filter UI (RLS limits to active+non-voided for authenticated users)
  const { data: syllabi } = await supabase
    .from("syllabus")
    .select("id, name")
    .eq("is_active", true)
    .is("voided_at", null)
    .order("name", { ascending: true })

  // Fetch total lessons per syllabus (progress denominator)
  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, syllabus_id")
    .in("syllabus_id", syllabusIds)
    .eq("is_active", true)

  if (lessonsError) {
    console.error("Error fetching lessons:", lessonsError)
    return NextResponse.json({ error: "Failed to fetch lesson definitions" }, { status: 500 })
  }

  const totalLessonsBySyllabus = new Map<string, number>()
  ;(lessons || []).forEach((l: { id: string; syllabus_id: string }) => {
    totalLessonsBySyllabus.set(l.syllabus_id, (totalLessonsBySyllabus.get(l.syllabus_id) || 0) + 1)
  })

  // Fetch completed flights for these users (for last-flew + completed lesson_ids)
  // NOTE: last_flight_at is derived from the most recent completed booking (by end_time)
  const { data: bookingRows, error: bookingsError } = await supabase
    .from("bookings")
    .select(
      `
        user_id,
        end_time,
        flight_time,
        lesson:lesson_id (
          id,
          syllabus_id
        )
      `
    )
    .in("user_id", userIds)
    .eq("status", "complete")
    .not("flight_time", "is", null)
    .order("end_time", { ascending: false, nullsFirst: false })

  if (bookingsError) {
    console.error("Error fetching booking activity:", bookingsError)
    return NextResponse.json({ error: "Failed to fetch flight activity" }, { status: 500 })
  }

  const lastFlightByUser = new Map<string, string>()
  const completedLessonsByUserSyllabus = new Map<string, Set<string>>()

  type BookingRow = {
    user_id: string | null
    end_time: string | null
    lesson?: Array<{ id: string; syllabus_id: string | null }> | { id: string; syllabus_id: string | null } | null
  }

  ;(bookingRows || []).forEach((row: BookingRow) => {
    if (!row.user_id) return

    // last flight (most recent because ordered desc)
    if (!lastFlightByUser.has(row.user_id) && row.end_time) {
      lastFlightByUser.set(row.user_id, row.end_time)
    }

    // progress proxy: distinct lessons completed per user per syllabus (from joined lesson)
    const lesson = Array.isArray(row.lesson) ? (row.lesson[0] ?? null) : (row.lesson ?? null)
    if (!lesson?.id || !lesson.syllabus_id) return

    const key = `${row.user_id}:${lesson.syllabus_id}`
    if (!completedLessonsByUserSyllabus.has(key)) {
      completedLessonsByUserSyllabus.set(key, new Set())
    }
    completedLessonsByUserSyllabus.get(key)!.add(lesson.id)
  })

  const baseRows: TrainingOverviewRow[] = baseEnrollments.map((e) => {
    const syllabus = e.syllabus as TrainingOverviewSyllabus
    const studentRaw = e.student as (TrainingOverviewRow["student"] & { date_of_last_flight?: string | null })

    const lastFlight = lastFlightByUser.get(e.user_id) || studentRaw.date_of_last_flight || null
    const classification = classifyActivity({ nowMs, enrolled_at: e.enrolled_at, last_flight_at: lastFlight })

    const total = totalLessonsBySyllabus.get(e.syllabus_id) || 0
    const completedSet = completedLessonsByUserSyllabus.get(`${e.user_id}:${e.syllabus_id}`)
    const completed = completedSet ? completedSet.size : 0

    return {
      enrollment_id: e.id,
      user_id: e.user_id,
      syllabus_id: e.syllabus_id,
      enrolled_at: e.enrolled_at,
      status: e.status,
      student: {
        id: studentRaw.id,
        first_name: studentRaw.first_name ?? null,
        last_name: studentRaw.last_name ?? null,
        email: studentRaw.email,
        is_active: studentRaw.is_active,
      },
      syllabus,
      last_flight_at: lastFlight,
      activity_status: classification.status,
      days_since_last_flight: classification.days_since_last_flight,
      days_since_enrolled: classification.days_since_enrolled,
      progress: makeProgress(completed, total),
    }
  })

  // Compute stats in the syllabus-filtered universe (independent of view/search)
  const bySyllabusMap = new Map<string, TrainingOverviewSyllabusStats>()
  let activeCount = 0
  let atRiskCount = 0
  let staleCount = 0
  let neverFlownCount = 0

  baseRows.forEach((r) => {
    const sid = r.syllabus_id
    if (!bySyllabusMap.has(sid)) {
      bySyllabusMap.set(sid, {
        syllabus: r.syllabus,
        total: 0,
        active: 0,
        at_risk: 0,
        stale: 0,
        never_flown: 0,
      })
    }
    const bucket = bySyllabusMap.get(sid)!
    bucket.total += 1

    if (!r.last_flight_at) {
      bucket.never_flown += 1
      neverFlownCount += 1
    }

    if (r.activity_status === "active") {
      bucket.active += 1
      activeCount += 1
    } else if (r.activity_status === "stale") {
      bucket.stale += 1
      staleCount += 1
    } else {
      // includes at_risk + new
      bucket.at_risk += 1
      atRiskCount += 1
    }
  })

  const bySyllabus = Array.from(bySyllabusMap.values()).sort((a, b) =>
    a.syllabus.name.localeCompare(b.syllabus.name)
  )

  // Sort for instructor decision-making: urgency desc, then last flight (desc), then name
  baseRows.sort((a, b) => {
    const aUrg = statusSortKey(a.activity_status)
    const bUrg = statusSortKey(b.activity_status)
    if (aUrg !== bUrg) return bUrg - aUrg

    const aDays = a.days_since_last_flight ?? a.days_since_enrolled
    const bDays = b.days_since_last_flight ?? b.days_since_enrolled
    if (aDays !== bDays) return bDays - aDays

    const aName = `${a.student.first_name || ""} ${a.student.last_name || ""}`.trim() || a.student.email
    const bName = `${b.student.first_name || ""} ${b.student.last_name || ""}`.trim() || b.student.email
    return aName.localeCompare(bName)
  })

  const payload: TrainingOverviewResponse = {
    rows: baseRows,
    stats: {
      total_enrollments: baseRows.length,
      active: activeCount,
      at_risk: atRiskCount,
      stale: staleCount,
      never_flown: neverFlownCount,
      by_syllabus: bySyllabus,
    },
    syllabi: (syllabi || []) as TrainingOverviewSyllabus[],
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(payload)
}


