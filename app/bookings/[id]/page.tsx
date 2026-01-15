import { redirect } from "next/navigation"
import BookingDetailClient from "./booking-detail-client"
import {
  getBookingAccess,
  getBookingViewRedirect,
} from "./booking-access"

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { booking, canAccess } = await getBookingAccess(id)

  if (booking && canAccess) {
    const redirectPath = getBookingViewRedirect(booking)
    if (redirectPath) {
      redirect(redirectPath)
    }
  }

  return <BookingDetailClient bookingId={id} />
}
