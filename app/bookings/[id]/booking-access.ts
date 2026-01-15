import "server-only"

import { createClient } from "@/lib/supabase/server"
import { userHasAnyRole } from "@/lib/auth/roles"

export type BookingAccessSummary = {
  id: string
  status: string
  booking_type: string
  user_id: string | null
  instructor_id: string | null
}

type BookingAccessResult = {
  booking: BookingAccessSummary | null
  canAccess: boolean
  isAdminOrInstructor: boolean
}

async function getInstructorIdForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data } = await supabase
    .from("instructors")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()
  return data?.id ?? null
}

export async function getBookingAccess(bookingId: string): Promise<BookingAccessResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { booking: null, canAccess: false, isAdminOrInstructor: false }
  }

  const isAdminOrInstructor = await userHasAnyRole(user.id, ["owner", "admin", "instructor"])

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, booking_type, user_id, instructor_id")
    .eq("id", bookingId)
    .single()

  if (!booking) {
    return { booking: null, canAccess: false, isAdminOrInstructor }
  }

  const instructorIdForUser = isAdminOrInstructor
    ? null
    : await getInstructorIdForUser(supabase, user.id)

  const canAccess = isAdminOrInstructor ||
    booking.user_id === user.id ||
    (!!instructorIdForUser && booking.instructor_id === instructorIdForUser)

  return { booking, canAccess, isAdminOrInstructor }
}

export function getBookingViewRedirect(booking: BookingAccessSummary): string | null {
  if (booking.status === "flying" && booking.booking_type === "flight") {
    return `/bookings/${booking.id}/checkout`
  }
  return null
}

export function getBookingCheckoutRedirect(booking: BookingAccessSummary): string | null {
  if (booking.booking_type !== "flight") {
    return `/bookings/${booking.id}`
  }
  return null
}

export function getBookingCheckinRedirect(booking: BookingAccessSummary): string | null {
  if (booking.booking_type !== "flight") {
    return `/bookings/${booking.id}`
  }
  return null
}
