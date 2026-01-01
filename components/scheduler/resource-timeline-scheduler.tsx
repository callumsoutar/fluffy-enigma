"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, CalendarDays, Clock, User, Plane, Eye, X, UserCircle, CheckCircle, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { format as formatDate } from "date-fns"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

import {
  type AircraftResource,
  type InstructorResource,
} from "./mock-data"
import {
  buildTimeSlots,
  formatTimeLabel,
  formatTimeRangeLabel,
  getBookingLayout,
  minutesFromMidnight,
  type TimelineConfig,
} from "./scheduler-utils"

import type { BookingStatus, BookingWithRelations, BookingsResponse } from "@/lib/types/bookings"
import type { AircraftResponse, AircraftWithType } from "@/lib/types/aircraft"
import type { MemberWithRelations, MembersResponse } from "@/lib/types/members"
import type { RosterRule } from "@/lib/types/roster"
import { NewBookingModal, type NewBookingPrefill } from "@/components/bookings/new-booking-modal"
import { CancelBookingModal } from "@/components/bookings/cancel-booking-modal"

type Resource =
  | { kind: "instructor"; data: InstructorResource }
  | { kind: "aircraft"; data: AircraftResource }

type SchedulerBooking = {
  id: string
  startsAt: Date
  endsAt: Date
  studentName: string
  instructorId: string | null
  aircraftId: string
  userId: string | null
  status: BookingStatus
  aircraftLabel?: string
  instructorLabel?: string
}

// UI/layout tuning only (no behavior changes)
const ROW_HEIGHT = 34
const GROUP_HEIGHT = 28
const LEFT_COL_WIDTH = "w-[160px] sm:w-[240px] lg:w-[280px]"

type MinutesWindow = { startMin: number; endMin: number }

function parseTimeToMinutes(time: string) {
  // Accepts "HH:MM" or "HH:MM:SS"
  const [hhRaw, mmRaw] = time.split(":")
  const hh = Number(hhRaw)
  const mm = Number(mmRaw)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

function buildInstructorAvailabilityMap(rules: RosterRule[]) {
  const map = new Map<string, MinutesWindow[]>()

  for (const r of rules) {
    // Defensive: API should already filter inactive/voided, but keep it safe.
    if (!r.is_active || r.voided_at) continue

    const startMin = parseTimeToMinutes(r.start_time)
    const endMin = parseTimeToMinutes(r.end_time)
    if (startMin === null || endMin === null) continue
    if (endMin <= startMin) continue

    const existing = map.get(r.instructor_id) ?? []
    existing.push({ startMin, endMin })
    map.set(r.instructor_id, existing)
  }

  return map
}

function isMinutesWithinAnyWindow(mins: number, windows: MinutesWindow[]) {
  // start inclusive, end exclusive (17:00 slot is unavailable if end is 17:00)
  return windows.some((w) => mins >= w.startMin && mins < w.endMin)
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, days: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

function formatDateLabel(d: Date) {
  // Deterministic across server/client and browsers (avoids Intl locale ordering differences → hydration errors)
  return formatDate(d, "EEE, dd MMM")
}

function statusBadgeVariant(status: BookingStatus) {
  switch (status) {
    case "flying":
      return "secondary"
    case "complete":
      return "default"
    case "cancelled":
      return "outline"
    case "briefing":
      return "secondary"
    case "confirmed":
      return "outline"
    case "unconfirmed":
      return "outline"
    default:
      return "outline"
  }
}

function statusPillClasses(status: BookingStatus) {
  switch (status) {
    case "flying":
      return "bg-amber-500 text-white"
    case "complete":
      return "bg-emerald-600 text-white"
    case "cancelled":
      return "bg-muted text-muted-foreground"
    case "briefing":
      return "bg-sky-600 text-white"
    case "confirmed":
      return "bg-indigo-600 text-white"
    case "unconfirmed":
      return "bg-slate-600 text-white"
    default:
      return "bg-indigo-600 text-white"
  }
}

function statusIndicatorClasses(status: BookingStatus) {
  switch (status) {
    case "flying":
      return "bg-amber-500"
    case "complete":
      return "bg-emerald-600"
    case "cancelled":
      return "bg-muted-foreground/40"
    case "briefing":
      return "bg-sky-600"
    case "confirmed":
      return "bg-indigo-600"
    case "unconfirmed":
      return "bg-slate-600"
    default:
      return "bg-indigo-600"
  }
}

function getResourceTitle(resource: Resource) {
  if (resource.kind === "instructor") return resource.data.name
  return `${resource.data.registration} (${resource.data.type})`
}


function bookingMatchesResource(booking: SchedulerBooking, resource: Resource) {
  if (resource.kind === "instructor") return booking.instructorId === resource.data.id
  return booking.aircraftId === resource.data.id
}

function parseSupabaseUtcTimestamp(ts: string) {
  // Supabase typically returns RFC3339 with an explicit offset (`Z` or `+00:00`).
  // If timezone info is missing, treat it as UTC to avoid accidentally interpreting as local.
  const hasTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(ts)
  return new Date(hasTimezone ? ts : `${ts}Z`)
}

function getSelectedDayRangeUtc(selectedDateLocal: Date) {
  // selectedDateLocal is local midnight. `.toISOString()` converts that instant to UTC,
  // which is exactly what we want for querying UTC timestamps in the DB.
  const startLocal = new Date(selectedDateLocal)
  startLocal.setHours(0, 0, 0, 0)
  const endLocal = new Date(startLocal)
  endLocal.setDate(endLocal.getDate() + 1)
  return { startUtcIso: startLocal.toISOString(), endUtcIso: endLocal.toISOString() }
}

async function fetchBookingsForRange(range: { startUtcIso: string; endUtcIso: string }) {
  const params = new URLSearchParams()
  params.set("start_date", range.startUtcIso)
  params.set("end_date", range.endUtcIso)

  const res = await fetch(`/api/bookings?${params.toString()}`)
  if (!res.ok) throw new Error("Failed to fetch bookings")
  const data = (await res.json()) as BookingsResponse
  return data.bookings
}

async function fetchAircraft() {
  const res = await fetch("/api/aircraft")
  if (!res.ok) throw new Error("Failed to fetch aircraft")
  const data = (await res.json()) as AircraftResponse
  return data.aircraft
}

async function fetchInstructors() {
  const params = new URLSearchParams()
  params.set("person_type", "instructor")
  params.set("is_active", "true")
  const res = await fetch(`/api/members?${params.toString()}`)
  if (!res.ok) throw new Error("Failed to fetch instructors")
  const data = (await res.json()) as MembersResponse
  return data.members
}

async function fetchRosterRules(date: string) {
  const params = new URLSearchParams()
  params.set("date", date)
  const res = await fetch(`/api/roster-rules?${params.toString()}`)
  if (!res.ok) throw new Error("Failed to fetch roster rules")
  const data = await res.json()
  return data.roster_rules as RosterRule[]
}

function getDisplayNameForMember(m: Pick<MemberWithRelations, "first_name" | "last_name" | "email">) {
  const full = [m.first_name, m.last_name].filter(Boolean).join(" ").trim()
  return full || m.email
}

function bookingToSchedulerBooking(b: BookingWithRelations): SchedulerBooking | null {
  if (!b.start_time || !b.end_time) return null
  const startsAt = parseSupabaseUtcTimestamp(b.start_time)
  const endsAt = parseSupabaseUtcTimestamp(b.end_time)
  const studentName =
    b.student ? [b.student.first_name, b.student.last_name].filter(Boolean).join(" ").trim() || b.student.email : "Unassigned"
  const aircraftLabel = b.aircraft ? `${b.aircraft.registration} (${b.aircraft.type})` : undefined
  const instructorLabel =
    b.instructor
      ? [b.instructor.first_name, b.instructor.last_name].filter(Boolean).join(" ").trim() || b.instructor.user?.email || undefined
      : undefined

  return {
    id: b.id,
    startsAt,
    endsAt,
    studentName,
    instructorId: b.instructor_id,
    aircraftId: b.aircraft_id,
    userId: b.user_id,
    status: b.status,
    aircraftLabel,
    instructorLabel,
  }
}

export function ResourceTimelineScheduler() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()

  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null)
  const [newBookingOpen, setNewBookingOpen] = React.useState(false)
  const [newBookingPrefill, setNewBookingPrefill] = React.useState<NewBookingPrefill | undefined>(undefined)
  const [cancelModalOpen, setCancelModalOpen] = React.useState(false)
  const [selectedBookingForCancel, setSelectedBookingForCancel] = React.useState<BookingWithRelations | null>(null)

  // Initialize date on client-side only to avoid hydration mismatch
  React.useEffect(() => {
    setSelectedDate(startOfDay(new Date()))
  }, [])

  const config: TimelineConfig = React.useMemo(
    () => ({
      startHour: 7,
      endHour: 19,
      intervalMinutes: 30,
    }),
    []
  )

  const { slots, start: timelineStart, end: timelineEnd } = React.useMemo(
    () => selectedDate ? buildTimeSlots(selectedDate, config) : { slots: [], start: new Date(), end: new Date() },
    [selectedDate, config]
  )

  const slotCount = slots.length
  const slotMinWidth = 56 // px (denser, improves visible range on mobile)
  const timelineMinWidth = isMobile ? slotCount * slotMinWidth : undefined

  const dayRange = React.useMemo(() => selectedDate ? getSelectedDayRangeUtc(selectedDate) : { startUtcIso: '', endUtcIso: '' }, [selectedDate])
  const dateKey = React.useMemo(() => selectedDate ? formatDate(selectedDate, "yyyy-MM-dd") : '', [selectedDate])

  const { data: aircraft = [], isLoading: isLoadingAircraft } = useQuery({
    queryKey: ["scheduler", "aircraft"],
    queryFn: fetchAircraft,
    staleTime: 60_000,
  })

  const { data: members = [], isLoading: isLoadingInstructors } = useQuery({
    queryKey: ["scheduler", "instructors"],
    queryFn: fetchInstructors,
    staleTime: 60_000,
  })

  const { data: rosterRules = [], isLoading: isLoadingRoster } = useQuery({
    queryKey: ["scheduler", "roster-rules", dateKey],
    queryFn: () => fetchRosterRules(dateKey),
    staleTime: 60_000,
    enabled: !!selectedDate && !!dateKey,
  })

  const instructorAvailabilityById = React.useMemo(() => {
    return buildInstructorAvailabilityMap(rosterRules)
  }, [rosterRules])

  const { data: bookingsRaw = [], isLoading: isLoadingBookings } = useQuery({
    queryKey: ["scheduler", "bookings", dayRange.startUtcIso, dayRange.endUtcIso],
    queryFn: () => fetchBookingsForRange(dayRange),
    staleTime: 15_000,
    enabled: !!selectedDate && !!dayRange.startUtcIso,
  })

  const isLoading = !selectedDate || isLoadingAircraft || isLoadingInstructors || isLoadingRoster || isLoadingBookings

  const instructorResources: InstructorResource[] = React.useMemo(() => {
    // Only show instructors who have at least one active roster rule for this day
    const rosteredInstructorIds = new Set(rosterRules.map((r) => r.instructor_id))

    return members
      .filter((m) => !!m.instructor?.id && rosteredInstructorIds.has(m.instructor.id))
      .map((m) => ({
        id: m.instructor!.id,
        name: getDisplayNameForMember(m),
        endorsements: undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [members, rosterRules])

  const aircraftResources: AircraftResource[] = React.useMemo(() => {
    return aircraft
      .filter((a) => a.on_line)
      .map((a: AircraftWithType) => ({
        id: a.id,
        registration: a.registration,
        type: a.type,
      }))
      .sort((a, b) => a.registration.localeCompare(b.registration))
  }, [aircraft])

  const bookings = React.useMemo(() => {
    const mapped = bookingsRaw
      .map(bookingToSchedulerBooking)
      .filter((x): x is SchedulerBooking => !!x)
    return mapped
  }, [bookingsRaw])

  const navigateDate = React.useCallback((deltaDays: number) => {
    setSelectedDate((d) => d ? startOfDay(addDays(d, deltaDays)) : null)
  }, [])

  const goToToday = React.useCallback(() => {
    setSelectedDate(startOfDay(new Date()))
  }, [])

  const handleDateSelect = React.useCallback((d: Date | undefined) => {
    if (!d) return
    setSelectedDate(startOfDay(d))
  }, [])

  const handleBookingClick = React.useCallback(
    (booking: SchedulerBooking) => {
      router.push(`/bookings/${booking.id}`)
    },
    [router]
  )

  const handleCancelBookingClick = React.useCallback(
    async (booking: SchedulerBooking) => {
      // Fetch full booking details for the modal
      try {
        const res = await fetch(`/api/bookings/${booking.id}`)
        if (!res.ok) throw new Error("Failed to fetch booking")
        const data = await res.json()
        setSelectedBookingForCancel(data.booking as BookingWithRelations)
        setCancelModalOpen(true)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load booking details")
      }
    },
    []
  )

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: BookingStatus }) => {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update booking")
      }
      return res.json()
    },
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["scheduler", "bookings"] })
      toast.success(`Booking ${variables.status === 'confirmed' ? 'confirmed' : variables.status === 'cancelled' ? 'cancelled' : 'updated'} successfully`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update booking")
    },
  })

  const handleEmptySlotClick = React.useCallback(
    ({
      resource,
      clientX,
      container,
    }: {
      resource: Resource
      clientX: number
      container: HTMLDivElement
    }) => {
      if (!selectedDate) return
      const rect = container.getBoundingClientRect()
      if (!rect.width) return
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
      // Snap to the clicked grid cell (each cell = one interval).
      // This avoids "halfway through a cell changes the time" issues from continuous rounding.
      const rawIdx = Math.floor((x / rect.width) * slotCount)
      const idx = Math.max(0, Math.min(rawIdx, slotCount - 1))
      const when = slots[idx] ?? timelineStart

      if (resource.kind === "instructor") {
        const windows = instructorAvailabilityById.get(resource.data.id) ?? []
        const mins = minutesFromMidnight(when)
        if (!isMinutesWithinAnyWindow(mins, windows)) {
          // Unavailable slot: ignore click (cell is visually disabled)
          return
        }
      }

      setNewBookingPrefill({
        date: selectedDate,
        startTime: formatTimeLabel(when),
        aircraftId: resource.kind === "aircraft" ? resource.data.id : undefined,
        instructorId: resource.kind === "instructor" ? resource.data.id : undefined,
      })
      setNewBookingOpen(true)
    },
    [slotCount, slots, timelineStart, selectedDate, instructorAvailabilityById]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateDate(-1)}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-10 justify-start gap-2 px-3 font-semibold flex-1 sm:flex-initial"
                aria-label="Select date"
              >
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{selectedDate ? formatDateLabel(selectedDate) : "Loading..."}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate ?? undefined}
                onSelect={handleDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateDate(1)}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button variant="ghost" onClick={goToToday} className="hidden sm:inline-flex">
            Today
          </Button>
        </div>

        {/* Desktop only: New booking button */}
        <div className="hidden sm:flex items-center gap-2">
          <Button
            onClick={() => {
              if (selectedDate) {
                setNewBookingPrefill({ date: selectedDate, startTime: "09:00" })
                setNewBookingOpen(true)
              }
            }}
            disabled={!selectedDate}
          >
            <CalendarDays className="h-4 w-4 mr-2" />
            New booking
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading scheduler data...</p>
          </div>
        ) : (
          <div className="flex">
            {/* Left column (resources) */}
            <div className={cn("shrink-0 border-r border-border/60 bg-muted/10", LEFT_COL_WIDTH)}>
              {/* Left header */}
              <div className="sticky top-0 z-30 flex h-10 items-center border-b bg-card/95 px-2 sm:h-12 sm:px-4 backdrop-blur">
                <div className="text-xs font-semibold text-foreground/90 sm:text-sm">Resources</div>
              </div>

              {/* Group: Instructors */}
              <div
                className="flex items-center border-b border-border/60 bg-muted/20 px-2 text-[11px] font-semibold text-muted-foreground sm:px-4"
                style={{ height: GROUP_HEIGHT }}
              >
                Instructors
              </div>
              {instructorResources.map((inst) => (
                <div
                  key={inst.id}
                  className="flex items-center border-b border-border/60 px-2 sm:px-4"
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="min-w-0 truncate text-[13px] font-semibold leading-tight sm:text-sm">
                    {inst.name}
                  </div>
                </div>
              ))}

              {/* Group: Aircraft */}
              <div
                className="flex items-center border-b border-border/60 bg-muted/20 px-2 text-[11px] font-semibold text-muted-foreground sm:px-4"
                style={{ height: GROUP_HEIGHT }}
              >
                Aircraft
              </div>
              {aircraftResources.map((ac) => (
                <div
                  key={ac.id}
                  className="flex items-center border-b border-border/60 px-2 sm:px-4"
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold leading-tight sm:text-sm">
                      {ac.registration}{" "}
                      <span className="font-medium text-muted-foreground/90">({ac.type})</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right column (timeline) */}
            <div className="min-w-0 flex-1 overflow-x-auto">
              <div style={timelineMinWidth ? { minWidth: timelineMinWidth } : undefined}>
                {/* Time header */}
                <div className="sticky top-0 z-30 h-10 border-b border-border/60 bg-card/95 backdrop-blur sm:h-12">
                  <div
                    className="grid h-full"
                    style={{
                      gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))`,
                    }}
                  >
                    {slots.map((slot) => {
                      const minutes = slot.getMinutes()
                      const showLabel = minutes === 0
                      return (
                        <div
                          key={slot.toISOString()}
                          className={cn(
                            "flex items-center justify-center border-r border-border/60 px-0.5 text-[10px] text-muted-foreground sm:px-1 sm:text-xs",
                            "last:border-r-0"
                          )}
                        >
                          <div className={cn("select-none font-medium", showLabel ? "" : "opacity-40")}>
                            {formatTimeLabel(slot)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Rows */}
                <div className="divide-y">
                  {/* Instructors group header (timeline side) */}
                  <div
                    className="bg-muted/20"
                    style={{ height: GROUP_HEIGHT }}
                    aria-hidden="true"
                  >
                    <div
                      className="grid h-full"
                      style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
                    >
                      {slots.map((slot) => (
                        <div key={slot.toISOString()} className="border-r last:border-r-0" />
                      ))}
                    </div>
                  </div>

                  {instructorResources.map((inst) => {
                    const resource: Resource = { kind: "instructor", data: inst }
                    const rowBookings = bookings.filter((b) => bookingMatchesResource(b, resource))
                    const windows = instructorAvailabilityById.get(inst.id) ?? []

                    return (
                      <TimelineRow
                        key={inst.id}
                        height={ROW_HEIGHT}
                        slotCount={slotCount}
                        slots={slots}
                        timelineStart={timelineStart}
                        timelineEnd={timelineEnd}
                        bookings={rowBookings}
                        resourceTitle={getResourceTitle(resource)}
                        isSlotAvailable={(slot) =>
                          isMinutesWithinAnyWindow(minutesFromMidnight(slot), windows)
                        }
                        onEmptyClick={(clientX, container) =>
                          handleEmptySlotClick({ resource, clientX, container })
                        }
                        onBookingClick={handleBookingClick}
                        onStatusUpdate={statusUpdateMutation.mutate}
                        onCancelBooking={handleCancelBookingClick}
                      />
                    )
                  })}

                  {/* Aircraft group header (timeline side) */}
                  <div
                    className="bg-muted/20"
                    style={{ height: GROUP_HEIGHT }}
                    aria-hidden="true"
                  >
                    <div
                      className="grid h-full"
                      style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
                    >
                      {slots.map((slot) => (
                        <div key={slot.toISOString()} className="border-r last:border-r-0" />
                      ))}
                    </div>
                  </div>

                  {aircraftResources.map((ac) => {
                    const resource: Resource = { kind: "aircraft", data: ac }
                    const rowBookings = bookings.filter((b) => bookingMatchesResource(b, resource))

                    return (
                      <TimelineRow
                        key={ac.id}
                        height={ROW_HEIGHT}
                        slotCount={slotCount}
                        slots={slots}
                        timelineStart={timelineStart}
                        timelineEnd={timelineEnd}
                        bookings={rowBookings}
                        resourceTitle={getResourceTitle(resource)}
                        onEmptyClick={(clientX, container) =>
                          handleEmptySlotClick({ resource, clientX, container })
                        }
                        onBookingClick={handleBookingClick}
                        onStatusUpdate={statusUpdateMutation.mutate}
                        onCancelBooking={handleCancelBookingClick}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <NewBookingModal
        open={newBookingOpen}
        onOpenChange={setNewBookingOpen}
        prefill={newBookingPrefill}
        onCreated={(booking) => {
          toast("Booking created", {
            description: `${booking.aircraft?.registration || "Aircraft"} • ${formatDate(new Date(booking.start_time), "dd MMM")} ${formatTimeLabel(new Date(booking.start_time))}`,
            action: {
              label: "Open",
              onClick: () => router.push(`/bookings/${booking.id}`),
            },
          })
        }}
      />
      <CancelBookingModal
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        booking={selectedBookingForCancel}
        onCancelled={() => {
          // Refresh scheduler bookings after cancellation
          queryClient.invalidateQueries({ queryKey: ["scheduler", "bookings"] })
          setSelectedBookingForCancel(null)
        }}
      />
    </div>
  )
}

function TimelineRow({
  height,
  slotCount,
  slots,
  timelineStart,
  timelineEnd,
  bookings,
  resourceTitle,
  isSlotAvailable,
  onEmptyClick,
  onBookingClick,
  onStatusUpdate,
  onCancelBooking,
}: {
  height: number
  slotCount: number
  slots: Date[]
  timelineStart: Date
  timelineEnd: Date
  bookings: SchedulerBooking[]
  resourceTitle?: string
  isSlotAvailable?: (slot: Date) => boolean
  onEmptyClick: (clientX: number, container: HTMLDivElement) => void
  onBookingClick: (booking: SchedulerBooking) => void
  onStatusUpdate: (variables: { bookingId: string; status: BookingStatus }) => void
  onCancelBooking: (booking: SchedulerBooking) => void
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const router = useRouter()

  return (
    <div className="relative" style={{ height }}>
      {/* Click-capture layer */}
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-default"
        onClick={(e) => {
          if (!containerRef.current) return
          if (isSlotAvailable) {
            const rect = containerRef.current.getBoundingClientRect()
            if (!rect.width) return
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
            const rawIdx = Math.floor((x / rect.width) * slotCount)
            const idx = Math.max(0, Math.min(rawIdx, slotCount - 1))
            const slot = slots[idx]
            if (slot && !isSlotAvailable(slot)) {
              // Slot is unavailable: ignore click
              return
            }
          }
          onEmptyClick(e.clientX, containerRef.current)
        }}
        aria-label={resourceTitle ? `Timeline row for ${resourceTitle}` : "Timeline row"}
      >
        <div
          className="grid h-full"
          style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
        >
          {slots.map((slot, idx) => {
            const isHour = slot.getMinutes() === 0
            const available = isSlotAvailable ? isSlotAvailable(slot) : true
            return (
              <div
                key={slot.toISOString()}
                className={cn(
                  "border-r last:border-r-0",
                  "transition-colors",
                  available ? "cursor-pointer hover:bg-sky-500/10" : "cursor-not-allowed bg-muted/20",
                  available && idx % 2 === 1 ? "bg-muted/[0.03]" : "",
                  available && isHour ? "bg-muted/[0.05]" : ""
                )}
              />
            )
          })}
        </div>
      </div>

      {/* Booking blocks */}
      {/* NOTE: This layer must not block hover/clicks on the grid when empty.
          We disable pointer events on the full overlay and re-enable them on actual booking blocks. */}
      <div className="absolute inset-0 pointer-events-none">
        {bookings.map((booking) => {
          const layout = getBookingLayout({
            bookingStart: booking.startsAt,
            bookingEnd: booking.endsAt,
            timelineStart,
            timelineEnd,
          })
          if (!layout) return null

          const label = booking.studentName
          const range = formatTimeRangeLabel(booking.startsAt, booking.endsAt)

          return (
            <div
              key={booking.id}
              // Full row height (no vertical inset) for clearer scanning and better density
              className="absolute inset-y-0 pointer-events-auto"
              style={{
                left: `${layout.leftPct}%`,
                width: `max(${layout.widthPct}%, 2%)`,
              }}
            >
              <ContextMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ContextMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onBookingClick(booking)
                        }}
                        className={cn(
                          "group h-full w-full rounded-md px-2 text-left",
                          "shadow-sm ring-1 ring-black/5",
                          "transition-all hover:shadow-md hover:brightness-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500/40",
                          statusPillClasses(booking.status)
                        )}
                      >
                        <div className="flex h-full flex-col justify-center">
                          <div className="truncate text-xs font-semibold leading-tight">
                            {label}
                          </div>
                        </div>
                      </button>
                    </ContextMenuTrigger>
                  </TooltipTrigger>
                <TooltipContent
                  variant="card"
                  side="top"
                  sideOffset={8}
                  className="max-w-[360px]"
                >
                  <div className="relative">
                    {/* Status indicator bar */}
                    <div
                      className={cn(
                        "absolute left-0 top-0 h-full w-1.5",
                        statusIndicatorClasses(booking.status)
                      )}
                      aria-hidden="true"
                    />

                    <div className="space-y-2 p-3 pl-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold leading-tight">
                            {booking.studentName}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="font-medium text-foreground/90">{range}</span>
                          </div>
                        </div>

                        <Badge variant={statusBadgeVariant(booking.status)} className="capitalize">
                          {booking.status}
                        </Badge>
                      </div>

                      <Separator className="bg-border/60" />

                      <div className="grid gap-1.5 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span>Instructor</span>
                          </div>
                          <span className="min-w-0 truncate font-medium text-foreground">
                            {booking.instructorLabel ?? "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Plane className="h-3.5 w-3.5" />
                            <span>Aircraft</span>
                          </div>
                          <span className="min-w-0 truncate font-medium text-foreground">
                            {booking.aircraftLabel ?? "—"}
                          </span>
                        </div>
                      </div>

                      <div className="pt-0.5 text-[11px] text-muted-foreground">
                        Click to open booking
                      </div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
              <ContextMenuContent>
                <ContextMenuItem
                  onClick={() => router.push(`/aircraft/${booking.aircraftId}`)}
                >
                  <Eye className="h-4 w-4" />
                  View Aircraft
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => {
                    onCancelBooking(booking)
                  }}
                  variant="destructive"
                >
                  <X className="h-4 w-4" />
                  Cancel Booking
                </ContextMenuItem>
                {booking.userId && (
                  <ContextMenuItem
                    onClick={() => router.push(`/members/${booking.userId}`)}
                  >
                    <UserCircle className="h-4 w-4" />
                    View Contact Details
                  </ContextMenuItem>
                )}
                {booking.status === 'unconfirmed' && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => {
                        onStatusUpdate({ bookingId: booking.id, status: 'confirmed' })
                      }}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Confirm Booking
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
            </div>
          )
        })}
      </div>
    </div>
  )
}


