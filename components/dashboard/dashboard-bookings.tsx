"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  IconPlane,
  IconCalendar,
  IconAlertCircle,
  IconExternalLink,
  IconCheck
} from "@tabler/icons-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import type { BookingWithRelations, BookingStatus, BookingType } from "@/lib/types/bookings"
import { zonedDayRangeUtcIso, zonedTodayYyyyMmDd } from "@/lib/utils/timezone"
import { useSchoolConfig } from "@/lib/hooks/use-school-config"
import { toast } from "sonner"

// Helper to fetch bookings
async function fetchBookings(params: Record<string, string>): Promise<BookingWithRelations[]> {
  const searchParams = new URLSearchParams(params)
  const response = await fetch(`/api/bookings?${searchParams.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch bookings')
  }
  const data = await response.json()
  return data.bookings
}

// Helper to confirm booking
async function confirmBooking(id: string): Promise<void> {
  const response = await fetch(`/api/bookings/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'confirmed' }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to confirm booking')
  }
}

function getStatusBadgeVariant(status: BookingStatus) {
  switch (status) {
    case "confirmed": return "default"
    case "flying": return "default"
    case "briefing": return "secondary"
    case "unconfirmed": return "secondary"
    case "complete": return "outline"
    case "cancelled": return "destructive"
    default: return "outline"
  }
}

function getStatusLabel(status: BookingStatus) {
  switch (status) {
    case "confirmed": return "Confirmed"
    case "flying": return "Flying"
    case "briefing": return "Briefing"
    case "unconfirmed": return "Unconfirmed"
    case "complete": return "Complete"
    case "cancelled": return "Cancelled"
    default: return status
  }
}

function getBookingTypeLabel(type: BookingType) {
  switch (type) {
    case "flight": return "Flight"
    case "groundwork": return "Ground Work"
    case "maintenance": return "Maintenance"
    case "other": return "Other"
    default: return type
  }
}

export function DashboardBookings() {
  const { data: schoolConfig } = useSchoolConfig()
  const timeZone = schoolConfig?.timeZone ?? "Pacific/Auckland"
  const router = useRouter()
  const queryClient = useQueryClient()
  
  // Today's range
  const todayKey = zonedTodayYyyyMmDd(timeZone)
  const { startUtcIso, endUtcIso } = zonedDayRangeUtcIso({ dateYyyyMmDd: todayKey, timeZone })

  // Requested bookings (unconfirmed)
  const { data: requestedBookings = [], isLoading: isLoadingRequested } = useQuery({
    queryKey: ["bookings", "dashboard-requested"],
    queryFn: () => fetchBookings({ status: "unconfirmed" }),
    staleTime: 30_000,
  })

  // Today's bookings
  const { data: todayBookings = [], isLoading: isLoadingToday } = useQuery({
    queryKey: ["bookings", "dashboard-today"],
    queryFn: () => fetchBookings({ start_date: startUtcIso, end_date: endUtcIso }),
    staleTime: 30_000,
  })

  // Current flights (flying)
  const { data: currentFlights = [], isLoading: isLoadingFlying } = useQuery({
    queryKey: ["bookings", "dashboard-flying"],
    queryFn: () => fetchBookings({ status: "flying" }),
    staleTime: 30_000,
  })

  // Confirm booking mutation
  const confirmMutation = useMutation({
    mutationFn: confirmBooking,
    onSuccess: () => {
      toast.success("Booking confirmed successfully")
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const [activeTab, setActiveTab] = React.useState("active")

  // Auto-set tab based on priority data availability
  React.useEffect(() => {
    if (!isLoadingFlying && currentFlights.length > 0) {
      setActiveTab("active")
    } else if (!isLoadingToday && todayBookings.length > 0) {
      setActiveTab("today")
    }
  }, [isLoadingFlying, isLoadingToday, currentFlights.length, todayBookings.length])

  const tabItems = [
    { 
      id: "active", 
      label: "In the Air", 
      count: currentFlights.length, 
      icon: IconPlane,
      data: currentFlights,
      loading: isLoadingFlying,
      href: "/bookings?status=flying",
      description: "Aircraft currently flying."
    },
    { 
      id: "today", 
      label: "Today", 
      count: todayBookings.length, 
      icon: IconCalendar,
      data: todayBookings,
      loading: isLoadingToday,
      href: "/bookings?activeTab=today",
      description: "Today's schedule."
    },
  ]

  const currentTabData = tabItems.find(t => t.id === activeTab)

  return (
    <div className="px-4 lg:px-6 pb-10 space-y-10">
      {/* Standalone Requested Bookings Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-200/50">
              <IconAlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Pending Requests</h3>
              <p className="text-xs text-slate-500 font-medium">Bookings awaiting confirmation.</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-slate-500 hover:text-slate-900 h-8 px-2">
            <Link href="/bookings?status=unconfirmed" className="flex items-center gap-1.2 font-semibold text-xs">
              View All Requests
              <IconExternalLink className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          {isLoadingRequested ? (
            <div className="p-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-slate-800" />
            </div>
          ) : requestedBookings.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-200">
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 h-10 px-6">Aircraft</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 h-10 px-6">Time</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 h-10 px-6">Member</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 h-10 px-6">Instructor</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 h-10 px-6 text-right">Status</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 h-10 px-6 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestedBookings.map((booking) => {
                    const start = new Date(booking.start_time)
                    const end = new Date(booking.end_time)
                    
                    return (
                      <TableRow 
                            key={booking.id}
                            className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest('button')) return
                              // Route directly to checkout if status is flying
                              if (booking.status === 'flying' && booking.booking_type === 'flight') {
                                router.push(`/bookings/${booking.id}/checkout`)
                              } else {
                                router.push(`/bookings/${booking.id}`)
                              }
                            }}
                          >
                        <TableCell className="py-3 px-6">
                          <div className="font-medium text-slate-900 text-sm">
                            {booking.aircraft?.registration || getBookingTypeLabel(booking.booking_type)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {booking.aircraft?.type || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-6">
                          <div className="text-sm text-slate-700 whitespace-nowrap">
                            {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false })}
                            <span className="mx-1 text-slate-400">-</span>
                            {end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false })}
                          </div>
                          <div className="text-xs text-slate-500">
                            {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-6">
                          <div className="text-sm text-slate-700 truncate max-w-[150px]">
                            {booking.student ? `${booking.student.first_name} ${booking.student.last_name}` : "—"}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-6">
                          <div className="text-sm text-slate-700 truncate max-w-[150px]">
                            {booking.instructor ? (() => {
                              // Use user names as the source of truth (fallback to instructor table for backward compatibility)
                              const firstName = booking.instructor.user?.first_name ?? booking.instructor.first_name
                              const lastName = booking.instructor.user?.last_name ?? booking.instructor.last_name
                              return `${firstName} ${lastName}`.trim()
                            })() : ""}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-6 text-right">
                          <Badge 
                            variant="secondary" 
                            className="font-medium text-[10px] px-2.5 py-0 h-5 rounded-md bg-amber-100 text-amber-700 border-none hover:bg-amber-100"
                          >
                            Unconfirmed
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 px-6 text-right">
                          <Button
                            size="sm"
                            className="h-7 px-2.5 bg-slate-900 text-white hover:bg-slate-800 text-[10px] font-bold rounded-md"
                            onClick={(e) => {
                              e.stopPropagation()
                              confirmMutation.mutate(booking.id)
                            }}
                            disabled={confirmMutation.isPending && confirmMutation.variables === booking.id}
                          >
                            {confirmMutation.isPending && confirmMutation.variables === booking.id ? (
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-white" />
                            ) : (
                              <>
                                <IconCheck className="h-3 w-3 mr-1" />
                                Confirm
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-50/10">
              <div className="flex flex-col items-center justify-center gap-2">
                <p className="text-sm font-medium text-slate-900">No pending requests</p>
                <p className="text-xs text-slate-500">There are no bookings awaiting confirmation.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabbed Interface Section */}
      <div className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-200">
          <div className="flex items-center gap-1">
            {tabItems.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-4 py-2.5 text-sm font-semibold transition-all border-b-2 flex items-center gap-2",
                    isActive 
                      ? "border-slate-900 text-slate-900" 
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  )}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                      isActive ? "bg-slate-100 text-slate-900" : "bg-slate-50 text-slate-400"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {currentTabData && (
            <div className="flex items-center justify-between sm:justify-end gap-4 pb-2.5 sm:pb-0">
              <Button variant="ghost" size="sm" asChild className="h-9 px-3 text-slate-500 hover:text-slate-900 font-medium text-xs">
                <Link href={currentTabData.href} className="flex items-center gap-2">
                  View Full Page
                  <IconExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </div>

        {currentTabData && (
          <div className="mt-0 outline-none">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
              {currentTabData.loading ? (
                <div className="p-12 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-slate-800" />
                </div>
              ) : currentTabData.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-200">
                        <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 h-10 px-6">Aircraft</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 h-10 px-6">Time</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 h-10 px-6">Member</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 h-10 px-6">Instructor</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 h-10 px-6 text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentTabData.data.map((booking) => {
                        const start = new Date(booking.start_time)
                        const end = new Date(booking.end_time)
                        const status = booking.status
                        const variant = getStatusBadgeVariant(status)
                        const label = getStatusLabel(status)
                        const isFlying = status === "flying"
                        
                        return (
                          <TableRow 
                            key={booking.id}
                            className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                            onClick={() => {
                              // Route directly to checkout if status is flying
                              if (booking.status === 'flying' && booking.booking_type === 'flight') {
                                router.push(`/bookings/${booking.id}/checkout`)
                              } else {
                                router.push(`/bookings/${booking.id}`)
                              }
                            }}
                          >
                            <TableCell className="py-3 px-6">
                              <div className="font-medium text-slate-900 text-sm">
                                {booking.aircraft?.registration || getBookingTypeLabel(booking.booking_type)}
                              </div>
                              <div className="text-xs text-slate-500">
                                {booking.aircraft?.type || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="py-3 px-6">
                              <div className="text-sm text-slate-700 whitespace-nowrap">
                                {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false })}
                                <span className="mx-1 text-slate-400">-</span>
                                {end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false })}
                              </div>
                              <div className="text-xs text-slate-500">
                                {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </div>
                            </TableCell>
                            <TableCell className="py-3 px-6">
                              <div className="text-sm text-slate-700 truncate max-w-[150px]">
                                {booking.student ? `${booking.student.first_name} ${booking.student.last_name}` : "—"}
                              </div>
                            </TableCell>
                            <TableCell className="py-3 px-6">
                              <div className="text-sm text-slate-700 truncate max-w-[150px]">
                                {booking.instructor ? (() => {
                              // Use user names as the source of truth (fallback to instructor table for backward compatibility)
                              const firstName = booking.instructor.user?.first_name ?? booking.instructor.first_name
                              const lastName = booking.instructor.user?.last_name ?? booking.instructor.last_name
                              return `${firstName} ${lastName}`.trim()
                            })() : ""}
                              </div>
                            </TableCell>
                            <TableCell className="py-3 px-6 text-right">
                              <Badge 
                                variant={variant} 
                                className={cn(
                                  "font-medium text-[10px] px-2.5 py-0 h-5 rounded-md",
                                  isFlying && "bg-orange-500 text-white border-none hover:bg-orange-500"
                                )}
                              >
                                {label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-12 text-center bg-slate-50/10">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="text-sm font-medium text-slate-900">No {currentTabData.label.toLowerCase()} found</p>
                    <p className="text-xs text-slate-500">There are no bookings in this category.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
