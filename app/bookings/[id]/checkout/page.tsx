import { redirect } from "next/navigation"
import BookingCheckoutClient from "./booking-checkout-client"
import {
  getBookingAccess,
  getBookingCheckoutRedirect,
} from "../booking-access"

export default async function BookingCheckoutPage({
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
    const redirectPath = getBookingCheckoutRedirect(booking)
    if (redirectPath) {
      redirect(redirectPath)
    }
  }

  return <BookingCheckoutClient bookingId={id} />
}
