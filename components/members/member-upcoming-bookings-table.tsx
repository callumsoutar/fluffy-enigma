"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"
import { IconCalendar, IconPlane, IconSchool, IconClock, IconChevronRight } from "@tabler/icons-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { BookingWithRelations, BookingStatus } from "@/lib/types/bookings"

export type MemberUpcomingBookingsTableProps = {
  memberId: string
}

async function fetchMemberUpcomingBookings(memberId: string): Promise<BookingWithRelations[]> {
  const statuses: BookingStatus[] = ['unconfirmed', 'confirmed', 'briefing', 'flying']
  const statusQuery = statuses.join(',')
  const res = await fetch(`/api/bookings?user_id=${memberId}&status=${statusQuery}`)
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload?.error || "Failed to load upcoming bookings")
  }
  return (payload.bookings || []) as BookingWithRelations[]
}

function getStatusBadge(status: BookingStatus) {
  switch (status) {
    case 'unconfirmed':
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Unconfirmed</Badge>
    case 'confirmed':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Confirmed</Badge>
    case 'briefing':
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Briefing</Badge>
    case 'flying':
      return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse">Flying</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export function MemberUpcomingBookingsTable({ memberId }: MemberUpcomingBookingsTableProps) {
  const { data: bookings, isLoading, isError, error } = useQuery({
    queryKey: ["member-upcoming-bookings", memberId],
    queryFn: () => fetchMemberUpcomingBookings(memberId),
    enabled: !!memberId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading upcoming bookings...
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-destructive">
          {error instanceof Error ? error.message : "Failed to load upcoming bookings"}
        </div>
      </div>
    )
  }

  // Filter to only show future or current bookings based on end_time
  const upcomingBookings = (bookings || []).filter(b => new Date(b.end_time) >= new Date())
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

  if (upcomingBookings.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
          <IconCalendar className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-sm font-medium text-slate-900">No upcoming bookings</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">
          This member has no scheduled flights or groundwork sessions.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Desktop View */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">Date & Time</th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">Aircraft / Type</th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">Instructor</th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">Purpose</th>
              <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wide text-slate-600">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {upcomingBookings.map((booking) => {
              const start = new Date(booking.start_time)
              const end = new Date(booking.end_time)
              const aircraftLabel = booking.aircraft?.registration || "No Aircraft"
              const instructorName = booking.instructor 
                ? `${booking.instructor.first_name} ${booking.instructor.last_name}`.trim() 
                : "Solo"
              
              return (
                <tr key={booking.id} className="group transition-colors hover:bg-slate-50/50">
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">{format(start, "dd MMM yyyy")}</span>
                      <span className="text-xs text-slate-500">{format(start, "HH:mm")} - {format(end, "HH:mm")}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <IconPlane className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="font-semibold text-slate-900">{aircraftLabel}</div>
                        <div className="text-xs text-slate-500">{booking.booking_type}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <IconSchool className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-700">{instructorName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-slate-600 truncate block max-w-[150px]" title={booking.purpose}>
                      {booking.purpose || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {getStatusBadge(booking.status)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Button variant="outline" size="sm" asChild className="h-8">
                      <Link href={`/bookings/${booking.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        {upcomingBookings.map((booking) => {
          const start = new Date(booking.start_time)
          const aircraftLabel = booking.aircraft?.registration || "No Aircraft"
          
          return (
            <Link 
              key={booking.id}
              href={`/bookings/${booking.id}`}
              className="block relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50 transition-colors"
            >
              <div className={cn(
                "absolute left-0 top-0 bottom-0 w-1",
                booking.status === 'confirmed' ? "bg-green-500" : 
                booking.status === 'flying' ? "bg-indigo-500" : "bg-amber-500"
              )} />
              
              <div className="flex justify-between items-start mb-2 pl-2">
                <div>
                  <div className="flex items-center gap-2">
                    <IconPlane className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-slate-900">{aircraftLabel}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{booking.purpose || booking.booking_type}</div>
                </div>
                {getStatusBadge(booking.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 pl-2 mt-3">
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Date & Time</div>
                  <div className="text-xs font-medium text-slate-900">
                    {format(start, "dd MMM")} @ {format(start, "HH:mm")}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Instructor</div>
                  <div className="text-xs font-medium text-slate-700 truncate">
                    {booking.instructor ? `${booking.instructor.first_name} ${booking.instructor.last_name}` : "Solo"}
                  </div>
                </div>
              </div>

              <div className="absolute right-4 bottom-4">
                <IconChevronRight className="w-4 h-4 text-slate-300" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
