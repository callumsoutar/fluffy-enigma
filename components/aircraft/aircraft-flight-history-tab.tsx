"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  IconPlane,
  IconCalendar,
  IconClock,
  IconUser,
  IconSchool,
  IconChartBar,
  IconChevronDown,
} from "@tabler/icons-react"
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns"

interface FlightEntry {
  id: string
  user_id: string | null
  instructor_id: string | null
  checked_out_aircraft_id: string | null
  checked_out_instructor_id: string | null
  start_time: string
  end_time: string
  status: string
  purpose: string
  hobbs_start: number | null
  hobbs_end: number | null
  tach_start: number | null
  tach_end: number | null
  flight_time: number | null
  created_at: string
  student?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  }
  instructor?: {
    id: string
    first_name: string | null
    last_name: string | null
    user_id: string | null
  }
  flight_type?: {
    id: string
    name: string
  }
  lesson?: {
    id: string
    name: string
  }
}

interface AircraftFlightHistoryTabProps {
  flights: FlightEntry[]
}

function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return "—"
  try {
    const date = new Date(dateString)
    return format(date, "HH:mm")
  } catch {
    return "—"
  }
}

interface UserData {
  first_name: string | null
  last_name: string | null
  email?: string
}

function getUserName(user: UserData | null | undefined): string {
  if (!user) return "—"
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ")
  return name || user.email || "—"
}

function getFlightHours(flight: FlightEntry): number {
  const flightTime = flight.flight_time
  if (flightTime == null) return 0
  const hours = typeof flightTime === 'string' ? Number(flightTime) : flightTime
  return isFinite(hours) ? hours : 0
}

function getFlightHoursDisplay(flight: FlightEntry): string {
  const flightTime = flight.flight_time
  if (flightTime == null) return "-"
  const hoursStr = String(flightTime)
  return hoursStr.includes('.') ? hoursStr : `${hoursStr}.0`
}

export function AircraftFlightHistoryTab({ flights: allFlights }: AircraftFlightHistoryTabProps) {
  // Date range state - default to last 30 days
  const [dateFrom, setDateFrom] = React.useState<Date>(startOfDay(subDays(new Date(), 30)))
  const [dateTo, setDateTo] = React.useState<Date>(endOfDay(new Date()))

  const handlePresetClick = (days: number) => {
    setDateFrom(startOfDay(subDays(new Date(), days)))
    setDateTo(endOfDay(new Date()))
  }

  // Filter flights by date range
  const flights = allFlights.filter((flight) => {
    // Use end time as the primary date for filtering
    const dateToCheck = flight.end_time || flight.created_at
    if (!dateToCheck) return false

    const flightDate = new Date(dateToCheck)
    return isWithinInterval(flightDate, { start: dateFrom, end: dateTo })
  })

  const totalFlightHours = flights.reduce((total, f) => total + getFlightHours(f), 0)
  const avgHoursPerFlight = flights.length > 0 ? totalFlightHours / flights.length : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold">Flight History</h3>

        {/* Date Range Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Quick shortcuts */}
          <div className="flex gap-2">
            <Button
              variant={dateFrom && dateTo && (new Date().getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24) <= 31 && (new Date().getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24) >= 29 ? "default" : "outline"}
              size="sm"
              onClick={() => handlePresetClick(30)}
              className="flex-1 sm:flex-none"
            >
              30 days
            </Button>
            <Button
              variant={dateFrom && dateTo && (new Date().getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24) <= 91 && (new Date().getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24) >= 89 ? "default" : "outline"}
              size="sm"
              onClick={() => handlePresetClick(90)}
              className="flex-1 sm:flex-none"
            >
              90 days
            </Button>
          </div>

          {/* Date pickers */}
          <div className="flex gap-2 items-center flex-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("flex-1 sm:flex-none sm:w-[150px] justify-start text-left font-normal text-sm", !dateFrom && "text-muted-foreground")}
                >
                  <IconCalendar className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "MMM dd, yyyy") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={(date) => date && setDateFrom(startOfDay(date))}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <span className="text-muted-foreground text-sm">to</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("flex-1 sm:flex-none sm:w-[150px] justify-start text-left font-normal text-sm", !dateTo && "text-muted-foreground")}
                >
                  <IconCalendar className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "MMM dd, yyyy") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={(date) => date && setDateTo(endOfDay(date))}
                  disabled={(date) => date > new Date() || date < dateFrom}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-col md:flex-row items-stretch gap-4 bg-slate-50 rounded-lg p-4 mb-6 border border-slate-200">
        <div className="flex-1 flex flex-col items-center justify-center">
          <IconPlane className="w-6 h-6 mb-1 text-indigo-600" />
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Total Flights</div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{flights.length}</div>
        </div>
        <div className="hidden md:block w-px bg-slate-300 mx-2" />
        <div className="flex-1 flex flex-col items-center justify-center">
          <IconClock className="w-6 h-6 mb-1 text-blue-600" />
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Total Hours</div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{totalFlightHours.toFixed(1)}h</div>
        </div>
        <div className="hidden md:block w-px bg-slate-300 mx-2" />
        <div className="flex-1 flex flex-col items-center justify-center">
          <IconChartBar className="w-6 h-6 mb-1 text-emerald-600" />
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Avg Hours / Flight</div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{avgHoursPerFlight.toFixed(1)}h</div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm border-collapse">
                <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Date
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Member
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Instructor
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Description
              </th>
              <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wide text-slate-600">
                Hobbs
              </th>
              <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wide text-slate-600">
                Tach
              </th>
              <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide text-slate-600">
                Flight Time
              </th>
              <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wide text-slate-600">
                Actions
              </th>
                  </tr>
                </thead>
          <tbody className="divide-y divide-slate-100">
            {flights.length === 0 ? (
              <tr>
                <td colSpan={8} className="h-24 text-center text-slate-500 font-medium">
                  No completed flights found in this date range.
                </td>
              </tr>
            ) : (
              flights.map((flight) => {
                    const flightDate = flight.end_time || flight.created_at
                    const bookingStart = flight.start_time
                    const bookingEnd = flight.end_time
                    const description = flight.lesson?.name || flight.flight_type?.name || flight.purpose || "Flight"
                const isSolo = !flight.instructor
                    
                    return (
                  <tr key={flight.id} className="group transition-colors hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 align-middle">
                          <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">
                          {flightDate ? format(new Date(flightDate), 'dd MMM yyyy') : '—'}
                            </span>
                            {bookingStart && bookingEnd && (
                          <span className="text-slate-500 text-xs">
                                {formatTime(bookingStart)}-{formatTime(bookingEnd)}
                              </span>
                            )}
                          </div>
                        </td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex items-center gap-2">
                        <IconUser className="w-4 h-4 text-slate-500" />
                        <span className="font-semibold text-slate-900">
                          {flight.student ? getUserName(flight.student) : 'Member'}
                            </span>
                          </div>
                        </td>
                    <td className="px-4 py-3.5 align-middle">
                      {isSolo ? (
                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-medium px-2 py-0.5">
                          Solo
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <IconSchool className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-slate-700">{getUserName(flight.instructor)}</span>
                            </div>
                          )}
                        </td>
                    <td className="px-4 py-3.5 align-middle max-w-[200px]">
                      <span className="text-slate-600 text-sm truncate block" title={description}>
                            {description}
                          </span>
                        </td>
                    <td className="px-4 py-3.5 align-middle text-center">
                      <div className="flex flex-col gap-0.5 text-xs font-mono">
                        <span className="text-slate-600">
                          {flight.hobbs_start != null ? Number(flight.hobbs_start).toFixed(1) : '-'}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="text-slate-900 font-semibold">
                          {flight.hobbs_end != null ? Number(flight.hobbs_end).toFixed(1) : '-'}
                        </span>
                      </div>
                        </td>
                    <td className="px-4 py-3.5 align-middle text-center">
                      <div className="flex flex-col gap-0.5 text-xs font-mono">
                        <span className="text-slate-600">
                          {flight.tach_start != null ? Number(flight.tach_start).toFixed(1) : '-'}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="text-slate-900 font-semibold">
                          {flight.tach_end != null ? Number(flight.tach_end).toFixed(1) : '-'}
                        </span>
                      </div>
                        </td>
                    <td className="px-4 py-3.5 align-middle text-right">
                      <span className="font-mono font-semibold text-slate-900">{getFlightHoursDisplay(flight)}h</span>
                        </td>
                    <td className="px-4 py-3.5 align-middle text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.location.href = `/bookings/${flight.id}`}
                        className="h-8 px-3 text-xs font-medium"
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    )
              })
            )}
                </tbody>
              </table>
            </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {flights.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-200">
            <div className="text-slate-500 font-medium mb-4">No completed flights found</div>
            <Button onClick={() => (window.location.href = "/bookings")} variant="outline" size="sm">
              <IconCalendar className="w-4 h-4 mr-2" />
              Schedule Flight
            </Button>
          </div>
        ) : (
          flights.map((flight) => {
            const flightDate = flight.end_time || flight.created_at
            const bookingStart = flight.start_time
            const bookingEnd = flight.end_time
            const description = flight.lesson?.name || flight.flight_type?.name || flight.purpose || "Flight"
            const isSolo = !flight.instructor
            const memberName = flight.student ? getUserName(flight.student) : 'Member'

            return (
              <div
                key={flight.id}
                className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => (window.location.href = `/bookings/${flight.id}`)}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-l-lg" />
                
                <div className="flex justify-between items-start mb-3 pl-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <IconUser className="w-4 h-4 text-slate-500" />
                      <h3 className="font-semibold text-slate-900">{memberName}</h3>
                    </div>
                    <span className="text-xs text-slate-600">{description}</span>
                  </div>
                  {isSolo && (
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-medium px-2 py-0.5">
                      Solo
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <IconCalendar className="w-3 h-3" /> Date
                    </div>
                    <div className="font-semibold text-sm text-slate-900">
                      {flightDate ? format(new Date(flightDate), "dd MMM yyyy") : "—"}
                    </div>
                    {bookingStart && bookingEnd && (
                      <div className="text-xs text-slate-500">
                        {formatTime(bookingStart)}-{formatTime(bookingEnd)}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <IconClock className="w-3 h-3" /> Flight Time
                    </div>
                    <div className="font-mono font-semibold text-sm text-slate-900">
                      {getFlightHoursDisplay(flight)}h
                    </div>
                  </div>
                  {!isSolo && (
                    <div className="space-y-1 col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                        <IconSchool className="w-3 h-3" /> Instructor
                      </div>
                      <div className="font-semibold text-sm text-slate-700">
                        {getUserName(flight.instructor)}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Hobbs
                    </div>
                    <div className="font-mono text-xs text-slate-700">
                      {flight.hobbs_start != null ? Number(flight.hobbs_start).toFixed(1) : '-'} → {flight.hobbs_end != null ? Number(flight.hobbs_end).toFixed(1) : '-'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tach
                    </div>
                    <div className="font-mono text-xs text-slate-700">
                      {flight.tach_start != null ? Number(flight.tach_start).toFixed(1) : '-'} → {flight.tach_end != null ? Number(flight.tach_end).toFixed(1) : '-'}
                    </div>
                  </div>
                </div>

                <div className="absolute right-4 bottom-4">
                  <IconChevronDown className="w-4 h-4 text-slate-400 transform -rotate-90" />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
