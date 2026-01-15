import { redirect } from "next/navigation"
import BookingCheckinClient from "./booking-checkin-client"
import {
  getBookingAccess,
  getBookingCheckinRedirect,
} from "../booking-access"

export default async function BookingCheckinPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { booking, canAccess, isAdminOrInstructor } = await getBookingAccess(id)

  if (!booking) {
    redirect("/bookings")
  }

  if (!isAdminOrInstructor) {
    redirect(`/bookings/${id}`)
  }

  if (canAccess) {
    const redirectPath = getBookingCheckinRedirect(booking)
    if (redirectPath) {
      redirect(redirectPath)
    }
  }

  return <BookingCheckinClient bookingId={id} />
}
