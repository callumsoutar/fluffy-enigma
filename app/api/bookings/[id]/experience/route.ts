import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userHasAnyRole } from '@/lib/auth/roles'
import { bookingIdSchema } from '@/lib/validation/bookings'
import { flightExperienceUpsertBodySchema } from '@/lib/validation/flight-experience'

type Params = { params: Promise<{ id: string }> }

async function ensureLessonProgressId(opts: {
  supabase: Awaited<ReturnType<typeof createClient>>
  bookingId: string
  booking: { user_id: string | null; instructor_id: string | null; lesson_id: string | null; start_time: string }
}) {
  const { supabase, bookingId, booking } = opts

  const { data: existing, error } = await supabase
    .from('lesson_progress')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (error) throw error
  if (existing?.id) return existing.id as string

  if (!booking.user_id) {
    throw new Error('Cannot create lesson_progress: booking.user_id is null')
  }

  const { data: inserted, error: insertError } = await supabase
    .from('lesson_progress')
    .insert({
      booking_id: bookingId,
      user_id: booking.user_id,
      lesson_id: booking.lesson_id ?? null,
      instructor_id: booking.instructor_id ?? null,
      date: booking.start_time ?? new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError) throw insertError
  return inserted.id as string
}

/**
 * GET /api/bookings/[id]/experience
 *
 * Returns normalized flight experience entries for a booking.
 * Staff-only (matches check-in workflow); RLS still enforces row visibility.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 })

  const { id: bookingId } = await params
  const idValidation = bookingIdSchema.safeParse(bookingId)
  if (!idValidation.success) {
    return NextResponse.json({ error: 'Invalid booking ID format' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('flight_experience')
    .select(`
      id,
      booking_id,
      lesson_progress_id,
      user_id,
      instructor_id,
      experience_type_id,
      value,
      unit,
      occurred_at,
      notes,
      conditions,
      created_at,
      updated_at,
      created_by,
      experience_type:experience_types (
        id,
        name
      )
    `)
    .eq('booking_id', bookingId)
    .order('occurred_at', { ascending: true })

  if (error) {
    console.error('Error fetching flight experience:', error)
    return NextResponse.json({ error: 'Failed to fetch flight experience' }, { status: 500 })
  }

  return NextResponse.json({ entries: data || [] })
}

/**
 * PUT /api/bookings/[id]/experience
 *
 * Upserts experience entries for a booking.
 * - One row per (booking_id, experience_type_id) (enforced by unique index)
 * - Deletes entries removed from the payload (booking-scoped)
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 })

  const { id: bookingId } = await params
  const idValidation = bookingIdSchema.safeParse(bookingId)
  if (!idValidation.success) {
    return NextResponse.json({ error: 'Invalid booking ID format' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }

  const bodyValidation = flightExperienceUpsertBodySchema.safeParse(body)
  if (!bodyValidation.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: bodyValidation.error.issues },
      { status: 400 }
    )
  }

  const { entries } = bodyValidation.data

  // Fetch booking linkage for required foreign keys
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, user_id, instructor_id, lesson_id, start_time')
    .eq('id', bookingId)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  if (!booking.user_id) {
    return NextResponse.json({ error: 'Cannot save experience: booking has no student (user_id is null)' }, { status: 400 })
  }

  if (!booking.instructor_id) {
    return NextResponse.json({ error: 'Cannot save experience: booking has no instructor assigned' }, { status: 400 })
  }

  const lessonProgressId = await ensureLessonProgressId({
    supabase,
    bookingId,
    booking: {
      user_id: booking.user_id,
      instructor_id: booking.instructor_id,
      lesson_id: booking.lesson_id,
      start_time: booking.start_time,
    },
  })

  // Delete removed entries (booking-scoped)
  const experienceTypeIds = entries.map((e) => e.experience_type_id)
  if (experienceTypeIds.length === 0) {
    const { error: deleteAllError } = await supabase
      .from('flight_experience')
      .delete()
      .eq('booking_id', bookingId)

    if (deleteAllError) {
      console.error('Error deleting all flight experience rows:', deleteAllError)
      return NextResponse.json({ error: 'Failed to save experience entries' }, { status: 500 })
    }
  } else {
    const { error: deleteMissingError } = await supabase
      .from('flight_experience')
      .delete()
      .eq('booking_id', bookingId)
      .not('experience_type_id', 'in', `(${experienceTypeIds.join(',')})`)

    if (deleteMissingError) {
      console.error('Error deleting removed flight experience rows:', deleteMissingError)
      return NextResponse.json({ error: 'Failed to save experience entries' }, { status: 500 })
    }
  }

  // Upsert current entries
  const rows = entries.map((e) => ({
    booking_id: bookingId,
    lesson_progress_id: lessonProgressId,
    user_id: booking.user_id,
    instructor_id: booking.instructor_id,
    experience_type_id: e.experience_type_id,
    value: e.value,
    unit: e.unit,
    occurred_at: booking.start_time,
    notes: e.notes ?? null,
    conditions: e.conditions ?? null,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  }))

  const { error: upsertError } = await supabase
    .from('flight_experience')
    .upsert(rows, { onConflict: 'booking_id,experience_type_id' })

  if (upsertError) {
    console.error('Error upserting flight experience:', upsertError)
    return NextResponse.json({ error: 'Failed to save experience entries' }, { status: 500 })
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from('flight_experience')
    .select(`
      id,
      booking_id,
      lesson_progress_id,
      user_id,
      instructor_id,
      experience_type_id,
      value,
      unit,
      occurred_at,
      notes,
      conditions,
      created_at,
      updated_at,
      created_by,
      experience_type:experience_types (
        id,
        name
      )
    `)
    .eq('booking_id', bookingId)
    .order('occurred_at', { ascending: true })

  if (refreshError) {
    console.error('Error refetching flight experience:', refreshError)
    return NextResponse.json({ error: 'Saved, but failed to fetch updated entries' }, { status: 500 })
  }

  return NextResponse.json({ entries: refreshed || [] })
}

/**
 * DELETE /api/bookings/[id]/experience?id=...
 *
 * Deletes a single experience entry row (booking-scoped).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hasAccess = await userHasAnyRole(user.id, ['owner', 'admin', 'instructor'])
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 })

  const { id: bookingId } = await params
  const idValidation = bookingIdSchema.safeParse(bookingId)
  if (!idValidation.success) {
    return NextResponse.json({ error: 'Invalid booking ID format' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

  // UUID format check
  const entryIdValidation = bookingIdSchema.safeParse(id)
  if (!entryIdValidation.success) {
    return NextResponse.json({ error: 'Invalid experience entry ID format' }, { status: 400 })
  }

  const { error } = await supabase
    .from('flight_experience')
    .delete()
    .eq('id', id)
    .eq('booking_id', bookingId)

  if (error) {
    console.error('Error deleting flight experience entry:', error)
    return NextResponse.json({ error: 'Failed to delete experience entry' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}


