import { NextResponse } from "next/server"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { getTenantContext } from "@/lib/auth/tenant"

const querySchema = z.object({
  member_id: z.string().uuid().optional(),
  syllabus_id: z.string().uuid().optional(),
  lesson_id: z.string().uuid().optional(),
})

type SyllabusOption = { id: string; name: string }
type LessonOption = {
  id: string
  name: string
  description: string | null
  order: number | null
  syllabus_id: string | null
  is_active: boolean | null
}

export async function GET(request: Request) {
  const supabase = await createClient()

  let tenantContext
  try {
    tenantContext = await getTenantContext(supabase)
  } catch (err) {
    const error = err as { code?: string }
    if (error.code === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (error.code === "NO_MEMBERSHIP") {
      return NextResponse.json({ error: "Forbidden: No tenant membership" }, { status: 403 })
    }
    return NextResponse.json({ error: "Failed to resolve tenant" }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const parseResult = querySchema.safeParse({
    member_id: searchParams.get("member_id") ?? undefined,
    syllabus_id: searchParams.get("syllabus_id") ?? undefined,
    lesson_id: searchParams.get("lesson_id") ?? undefined,
  })

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parseResult.error.issues },
      { status: 400 }
    )
  }

  const { userId, userRole } = tenantContext
  const isMemberRole = userRole === "member" || userRole === "student"
  const requestedMemberId = parseResult.data.member_id
  const memberId = requestedMemberId ?? (isMemberRole ? userId : null)

  if (requestedMemberId && isMemberRole && requestedMemberId !== userId) {
    return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 })
  }

  if (!memberId) {
    return NextResponse.json({
      syllabi: [] as SyllabusOption[],
      lessons: [] as LessonOption[],
      suggested_lesson_id: null,
      selected_syllabus_id: null,
    })
  }

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from("student_syllabus_enrollment")
    .select(
      `
        id,
        syllabus_id,
        enrolled_at,
        completion_date,
        status,
        syllabus:syllabus_id (
          id,
          name,
          is_active,
          voided_at
        )
      `
    )
    .eq("user_id", memberId)
    .eq("status", "active")
    .is("completion_date", null)
    .eq("syllabus.is_active", true)
    .is("syllabus.voided_at", null)
    .order("enrolled_at", { ascending: false })

  if (enrollmentsError) {
    console.error("Error fetching syllabus enrollments:", enrollmentsError)
    return NextResponse.json({ error: "Failed to fetch syllabus enrollments" }, { status: 500 })
  }

  const normalizedEnrollments = (enrollments || [])
    .map((row) => {
      const syllabus = Array.isArray(row.syllabus) ? row.syllabus[0] : row.syllabus
      return { ...row, syllabus }
    })
    .filter((row) => Boolean(row.syllabus))

  const syllabi = Array.from(
    new Map(
      normalizedEnrollments.map((row) => [row.syllabus_id, row.syllabus as SyllabusOption])
    ).values()
  )

  const includeLessonId = parseResult.data.lesson_id
  const requestedSyllabusId = parseResult.data.syllabus_id

  let selectedSyllabusId =
    requestedSyllabusId && syllabi.some((s) => s.id === requestedSyllabusId)
      ? requestedSyllabusId
      : null

  if (!selectedSyllabusId && includeLessonId) {
    const { data: lessonRow } = await supabase
      .from("lessons")
      .select("id, syllabus_id")
      .eq("id", includeLessonId)
      .maybeSingle()

    if (lessonRow?.syllabus_id && syllabi.some((s) => s.id === lessonRow.syllabus_id)) {
      selectedSyllabusId = lessonRow.syllabus_id
    }
  }

  if (!selectedSyllabusId && syllabi.length === 1) {
    selectedSyllabusId = syllabi[0]?.id ?? null
  }

  if (!selectedSyllabusId) {
    const lessons: LessonOption[] = []
    if (includeLessonId) {
      const { data: lessonRow } = await supabase
        .from("lessons")
        .select("id, name, description, order, syllabus_id, is_active")
        .eq("id", includeLessonId)
        .maybeSingle()

      if (lessonRow) lessons.push(lessonRow as LessonOption)
    }

    return NextResponse.json({
      syllabi,
      lessons,
      suggested_lesson_id: null,
      selected_syllabus_id: null,
    })
  }

  const { data: lessonsData, error: lessonsError } = await supabase
    .from("lessons")
    .select("id, name, description, order, syllabus_id, is_active")
    .eq("syllabus_id", selectedSyllabusId)
    .eq("is_active", true)
    .order("order")

  if (lessonsError) {
    console.error("Error fetching lessons:", lessonsError)
    return NextResponse.json({ error: "Failed to fetch lessons" }, { status: 500 })
  }

  const lessons = [...(lessonsData || [])] as LessonOption[]

  if (includeLessonId && !lessons.some((lesson) => lesson.id === includeLessonId)) {
    const { data: lessonRow } = await supabase
      .from("lessons")
      .select("id, name, description, order, syllabus_id, is_active")
      .eq("id", includeLessonId)
      .maybeSingle()

    if (lessonRow) lessons.push(lessonRow as LessonOption)
  }

  lessons.sort((a, b) => {
    if (a.order == null && b.order == null) return a.name.localeCompare(b.name)
    if (a.order == null) return 1
    if (b.order == null) return -1
    return a.order - b.order
  })

  const { data: progressRows, error: progressError } = await supabase
    .from("lesson_progress")
    .select(
      `
        lesson_id,
        lesson:lesson_id (
          id,
          syllabus_id
        )
      `
    )
    .eq("user_id", memberId)
    .eq("status", "pass")

  if (progressError) {
    console.error("Error fetching lesson progress:", progressError)
    return NextResponse.json({ error: "Failed to fetch lesson progress" }, { status: 500 })
  }

  const passedLessonIds = new Set(
    (progressRows || [])
      .map((row) => {
        const lesson = Array.isArray(row.lesson) ? row.lesson[0] : row.lesson
        if (!lesson?.syllabus_id || lesson.syllabus_id !== selectedSyllabusId) return null
        return row.lesson_id
      })
      .filter(Boolean) as string[]
  )
  const orderedLessons = lessons.filter((lesson) => lesson.is_active !== false && lesson.syllabus_id === selectedSyllabusId)

  let suggestedLessonId: string | null = null
  if (orderedLessons.length > 0) {
    const passedOrders = orderedLessons
      .filter((lesson) => passedLessonIds.has(lesson.id) && typeof lesson.order === "number")
      .map((lesson) => lesson.order as number)

    if (passedOrders.length === 0) {
      suggestedLessonId = orderedLessons[0]?.id ?? null
    } else {
      const maxPassedOrder = Math.max(...passedOrders)
      const nextLesson = orderedLessons.find((lesson) => (lesson.order ?? -1) > maxPassedOrder)
      suggestedLessonId = nextLesson?.id ?? null
    }
  }

  return NextResponse.json({
    syllabi,
    lessons,
    suggested_lesson_id: suggestedLessonId,
    selected_syllabus_id: selectedSyllabusId,
  })
}
