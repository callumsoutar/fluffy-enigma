"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false)

  // Date range presets
  const datePresets = [
    { label: "Last 7 days", days: 7 },
    { label: "Last 30 days", days: 30 },
    { label: "Last 90 days", days: 90 },
    { label: "Last year", days: 365 },
  ]

  const handlePresetClick = (days: number) => {
    setDateFrom(startOfDay(subDays(new Date(), days)))
    setDateTo(endOfDay(new Date()))
    setIsDatePickerOpen(false)
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Flight History</h3>

        {/* Date Range Picker */}
        <div className="flex items-center gap-2">
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-auto justify-start text-left font-normal",
                  !dateFrom && "text-muted-foreground"
                )}
              >
                <IconCalendar className="mr-2 h-4 w-4" />
                {dateFrom && dateTo ? (
                  `${format(dateFrom, "MMM dd, yyyy")} - ${format(dateTo, "MMM dd, yyyy")}`
                ) : (
                  "Select date range"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3 border-b">
                <div className="grid grid-cols-2 gap-2">
                  {datePresets.map((preset) => (
                    <Button
                      key={preset.days}
                      variant="outline"
                      size="sm"
                      onClick={() => handlePresetClick(preset.days)}
                      className="text-xs h-8"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="p-3">
                <div className="flex gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">From</label>
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(date) => date && setDateFrom(startOfDay(date))}
                      disabled={(date) => date > new Date()}
                      className="scale-90 origin-top-left"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">To</label>
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(date) => date && setDateTo(endOfDay(date))}
                      disabled={(date) => date > new Date() || date < dateFrom}
                      className="scale-90 origin-top-left"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDatePickerOpen(false)}
                    className="h-8 px-3 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setIsDatePickerOpen(false)}
                    className="h-8 px-3 text-xs"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-col md:flex-row items-stretch gap-4 bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100">
        <div className="flex-1 flex flex-col items-center justify-center">
          <IconUser className="w-6 h-6 mb-1 text-indigo-500" />
          <div className="text-xs text-muted-foreground">Total Flights</div>
          <div className="text-3xl font-bold text-gray-800 mt-1">{flights.length}</div>
        </div>
        <div className="hidden md:block w-px bg-gray-200 mx-2" />
        <div className="flex-1 flex flex-col items-center justify-center">
          <IconClock className="w-6 h-6 mb-1 text-blue-500" />
          <div className="text-xs text-muted-foreground">Total Hours</div>
          <div className="text-3xl font-bold text-gray-800 mt-1">{totalFlightHours.toFixed(1)}h</div>
        </div>
        <div className="hidden md:block w-px bg-gray-200 mx-2" />
        <div className="flex-1 flex flex-col items-center justify-center">
          <IconChartBar className="w-6 h-6 mb-1 text-emerald-500" />
          <div className="text-xs text-muted-foreground">Avg Hours / Flight</div>
          <div className="text-3xl font-bold text-gray-800 mt-1">{avgHoursPerFlight.toFixed(1)}h</div>
        </div>
      </div>

      {flights.length === 0 ? (
        <Card className="rounded-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-muted-foreground mb-4">No completed flights found</div>
            <Button
              onClick={() => window.location.href = '/bookings'}
              variant="outline"
            >
              <IconCalendar className="w-4 h-4 mr-2" />
              Schedule Flight
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-md">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2 px-3 font-medium text-gray-900 text-xs">Date</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-900 text-xs">Member</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-900 text-xs">Instructor</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-900 text-xs">Description</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-900 text-xs">Hobbs Start</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-900 text-xs">Hobbs End</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-900 text-xs">Tach Start</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-900 text-xs">Tach End</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-900 text-xs">Flight Time</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-900 text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {flights.map((flight) => {
                    const flightDate = flight.end_time || flight.created_at
                    const bookingStart = flight.start_time
                    const bookingEnd = flight.end_time
                    const description = flight.lesson?.name || flight.flight_type?.name || flight.purpose || "Flight"
                    
                    return (
                      <tr key={flight.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 text-xs">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {flightDate ? format(new Date(flightDate), 'MMM dd, yyyy') : '—'}
                            </span>
                            {bookingStart && bookingEnd && (
                              <span className="text-gray-500 text-xs">
                                {formatTime(bookingStart)}-{formatTime(bookingEnd)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-xs">
                          <div className="flex items-center gap-1">
                            <IconUser className="w-3 h-3 text-gray-500" />
                            <span className="font-medium">
                              {flight.student
                                ? getUserName(flight.student)
                                : 'Member'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-xs">
                          {flight.instructor ? (
                            <div className="flex items-center gap-1">
                              <IconSchool className="w-3 h-3 text-gray-500" />
                              <span>
                                {getUserName(flight.instructor)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 flex items-center gap-1">
                              <IconPlane className="w-3 h-3" />
                              Solo
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-600 max-w-[150px]">
                          <span className="truncate block" title={description}>
                            {description}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center text-xs font-mono">
                          {flight.hobbs_start != null ? Number(flight.hobbs_start).toFixed(1) : '-'}
                        </td>
                        <td className="py-2 px-2 text-center text-xs font-mono">
                          {flight.hobbs_end != null ? Number(flight.hobbs_end).toFixed(1) : '-'}
                        </td>
                        <td className="py-2 px-2 text-center text-xs font-mono">
                          {flight.tach_start != null ? Number(flight.tach_start).toFixed(1) : '-'}
                        </td>
                        <td className="py-2 px-2 text-center text-xs font-mono">
                          {flight.tach_end != null ? Number(flight.tach_end).toFixed(1) : '-'}
                        </td>
                        <td className="py-2 px-2 text-center text-xs font-mono font-semibold">
                          {getFlightHoursDisplay(flight)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.location.href = `/bookings/${flight.id}`}
                            className="h-6 px-2 text-xs"
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
