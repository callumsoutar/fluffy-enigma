"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { format, addDays } from "date-fns"
import { CalendarIcon, Check, ChevronsUpDown, User, Plane, NotebookPen, Plus, Repeat, AlertCircle } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { useAuth } from "@/contexts/auth-context"
import MemberSelect, { type UserResult } from "@/components/invoices/MemberSelect"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/use-debounce"
import type { BookingType, BookingWithRelations } from "@/lib/types/bookings"

type BookingOptionsResponse = {
  aircraft: { id: string; registration: string; type: string; model: string | null; manufacturer: string | null }[]
  members: { id: string; first_name: string | null; last_name: string | null; email: string }[]
  instructors: { id: string; first_name: string | null; last_name: string | null; user: { id: string; email: string } | null }[]
  flightTypes: { id: string; name: string; instruction_type: string | null }[]
  lessons: { id: string; name: string; description: string | null }[]
}

const TIME_OPTIONS = Array.from({ length: ((23 - 7) * 2) + 3 }, (_, i) => {
  const hour = 7 + Math.floor(i / 2)
  const minute = i % 2 === 0 ? "00" : "30"
  return `${hour.toString().padStart(2, "0")}:${minute}`
})

const BOOKING_TYPE_OPTIONS: { value: BookingType; label: string }[] = [
  { value: "flight", label: "Flight" },
  { value: "groundwork", label: "Ground Work" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other" },
]

function combineLocalDateAndTimeToIso(date: Date, timeHHmm: string) {
  const [h, m] = timeHHmm.split(":").map(Number)
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0)
  return local.toISOString()
}

function addMinutesToHHmm(timeHHmm: string, minutesToAdd: number) {
  const [h, m] = timeHHmm.split(":").map(Number)
  const startMinutes = h * 60 + m
  const endMinutes = startMinutes + minutesToAdd
  const endH = Math.floor(endMinutes / 60)
  const endM = endMinutes % 60

  if (endH >= 24 || (endH === 23 && endM > 30)) return "23:30"
  return `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`
}

const formSchema = z.object({
  date: z.date(),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  aircraftId: z.string().uuid("Aircraft is required"),
  flightTypeId: z.string().uuid().optional().nullable(),
  lessonId: z.string().uuid().optional().nullable(),
  instructorId: z.string().uuid().optional().nullable(),
  member: z.custom<UserResult | null>().optional(),
  bookingType: z.enum(["flight", "groundwork", "maintenance", "other"]),
  purpose: z.string().min(1, "Description is required").max(1000),
  remarks: z.string().max(2000).optional(),
  // Recurring fields
  isRecurring: z.boolean(),
  recurringDays: z.array(z.number()), // 0-6 (Sun-Sat)
  repeatUntil: z.date().optional().nullable(),
}).superRefine((data, ctx) => {
  // Simple guard: end must be after start (same day)
  const [sh, sm] = data.startTime.split(":").map(Number)
  const [eh, em] = data.endTime.split(":").map(Number)
  if (eh * 60 + em <= sh * 60 + sm) {
    ctx.addIssue({ code: "custom", path: ["endTime"], message: "End time must be after start time" })
  }

  if (data.bookingType === "flight" && !data.flightTypeId) {
    ctx.addIssue({ code: "custom", path: ["flightTypeId"], message: "Flight type is required" })
  }

  if (data.isRecurring) {
    if (data.recurringDays.length === 0) {
      ctx.addIssue({ code: "custom", path: ["recurringDays"], message: "Select at least one day" })
    }
    if (!data.repeatUntil) {
      ctx.addIssue({ code: "custom", path: ["repeatUntil"], message: "Repeat until date is required" })
    } else if (data.repeatUntil <= data.date) {
      ctx.addIssue({ code: "custom", path: ["repeatUntil"], message: "Repeat until date must be after the booking date" })
    }
  }
})

type FormValues = z.infer<typeof formSchema>

function LocalCombobox<T extends { id: string }>(props: {
  valueId: string | null | undefined
  onChange: (nextId: string | null) => void
  disabled?: boolean
  placeholder: string
  items: T[]
  itemLabel: (item: T) => string
  itemMeta?: (item: T) => string | null
  icon?: React.ReactNode
}) {
  const { valueId, onChange, disabled, placeholder, items, itemLabel, itemMeta, icon } = props
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const selected = valueId ? items.find((x) => x.id === valueId) : undefined
  const selectedLabel = selected ? itemLabel(selected) : placeholder

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => {
      const label = itemLabel(i).toLowerCase()
      const meta = itemMeta?.(i)?.toLowerCase() || ""
      return label.includes(q) || meta.includes(q)
    })
  }, [items, itemLabel, itemMeta, query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-10 w-full justify-between rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
          aria-expanded={open}
        >
          <span className="flex min-w-0 items-center gap-2">
            {icon ? <span className="shrink-0 text-slate-400">{icon}</span> : null}
            <span className="truncate">{selectedLabel}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border-slate-200 shadow-xl" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search..." value={query} onValueChange={setQuery} className="border-none focus:ring-0" />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={() => {
                  onChange(null)
                  setOpen(false)
                }}
                className="rounded-lg py-2.5"
              >
                <Check className={cn("mr-2 h-4 w-4", !valueId ? "opacity-100" : "opacity-0")} />
                None
              </CommandItem>
              {filtered.map((item) => {
                const label = itemLabel(item)
                const meta = itemMeta?.(item)
                const isSelected = item.id === valueId
                return (
                  <CommandItem
                    key={item.id}
                    value={`${label} ${meta || ""}`}
                    onSelect={() => {
                      onChange(item.id)
                      setOpen(false)
                    }}
                    className="rounded-lg py-2.5"
                  >
                    <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{label}</div>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

async function fetchBookingOptions(): Promise<BookingOptionsResponse> {
  const res = await fetch("/api/bookings/options")
  if (!res.ok) throw new Error("Failed to load booking options")
  return (await res.json()) as BookingOptionsResponse
}

type BookingOverlapsResponse = {
  unavailable_aircraft_ids: string[]
  unavailable_instructor_ids: string[]
}

async function fetchBookingOverlaps(params: {
  startIso: string
  endIso: string
  excludeBookingId?: string
}): Promise<BookingOverlapsResponse> {
  const sp = new URLSearchParams()
  sp.set("start_time", params.startIso)
  sp.set("end_time", params.endIso)
  if (params.excludeBookingId) sp.set("exclude_booking_id", params.excludeBookingId)

  const res = await fetch(`/api/bookings/overlaps?${sp.toString()}`)
  if (!res.ok) throw new Error("Failed to load booking overlaps")
  return (await res.json()) as BookingOverlapsResponse
}

export type NewBookingPrefill = {
  date?: Date
  startTime?: string
  aircraftId?: string
  instructorId?: string
  member?: UserResult | null
}

export function NewBookingModal(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefill?: NewBookingPrefill
  /**
   * When used in "edit" contexts, exclude the current booking from overlap checks.
   * (New booking flow can leave this undefined.)
   */
  excludeBookingId?: string
  onCreated?: (booking: BookingWithRelations) => void
}) {
  const { open, onOpenChange, prefill, excludeBookingId, onCreated } = props
  const queryClient = useQueryClient()
  const { user, role, hasAnyRole } = useAuth()

  const isStaff = hasAnyRole(["owner", "admin", "instructor"])

  const [bookingMode, setBookingMode] = React.useState<"regular" | "trial">("regular")

  const { data: options, isLoading: optionsLoading, isError: optionsError } = useQuery({
    queryKey: ["bookings", "options"],
    queryFn: fetchBookingOptions,
    enabled: open,
    staleTime: 60_000,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: prefill?.date ?? new Date(),
      startTime: prefill?.startTime ?? "09:00",
      endTime: addMinutesToHHmm(prefill?.startTime ?? "09:00", 60),
      aircraftId: prefill?.aircraftId ?? "",
      flightTypeId: null,
      lessonId: null,
      instructorId: prefill?.instructorId ?? null,
      member: prefill?.member ?? null,
      bookingType: "flight",
      purpose: "",
      remarks: "",
      isRecurring: false,
      recurringDays: [],
      repeatUntil: null,
    },
    mode: "onSubmit",
  })

  const selectedDate = form.watch("date")
  const startTime = form.watch("startTime")
  const endTime = form.watch("endTime")

  // Auto-adjust end time when start time changes (simple/default behavior)
  React.useEffect(() => {
    if (!open) return
    if (!startTime) return
    const nextEnd = addMinutesToHHmm(startTime, 60)
    form.setValue("endTime", nextEnd, { shouldValidate: true })
  }, [open, startTime, form])

  // Apply prefill when opening
  React.useEffect(() => {
    if (!open) return
    const date = prefill?.date ?? new Date()
    const st = prefill?.startTime ?? "09:00"
    form.reset({
      date,
      startTime: st,
      endTime: addMinutesToHHmm(st, 60),
      aircraftId: prefill?.aircraftId ?? "",
      flightTypeId: null,
      lessonId: null,
      instructorId: prefill?.instructorId ?? null,
      member: prefill?.member ?? null,
      bookingType: "flight",
      purpose: "",
      remarks: "",
      isRecurring: false,
      recurringDays: [],
      repeatUntil: null,
    })
    setBookingMode("regular")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill?.date, prefill?.startTime, prefill?.aircraftId, prefill?.instructorId, prefill?.member])

  const [submitting, setSubmitting] = React.useState(false)

  const flightTypeId = form.watch("flightTypeId")
  const bookingType = form.watch("bookingType")

  const filteredFlightTypes = React.useMemo(() => {
    const all = options?.flightTypes ?? []
    if (bookingMode === "trial") return all.filter((ft) => ft.instruction_type === "trial")
    // "regular" includes everything except explicit trial, and any null/unknown instruction types.
    return all.filter((ft) => ft.instruction_type !== "trial")
  }, [options?.flightTypes, bookingMode])

  const selectedFlightType = React.useMemo(() => {
    if (!flightTypeId) return null
    return (options?.flightTypes ?? []).find((ft) => ft.id === flightTypeId) ?? null
  }, [flightTypeId, options?.flightTypes])

  const instructionType = (selectedFlightType?.instruction_type ?? null) as "trial" | "dual" | "solo" | null

  const shouldHideInstructor = bookingType === "flight" && instructionType === "solo"

  const isValidTimeRange = React.useMemo(() => {
    if (!selectedDate || !startTime || !endTime) return false
    const [sh, sm] = startTime.split(":").map(Number)
    const [eh, em] = endTime.split(":").map(Number)
    if (!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(eh) || !Number.isFinite(em)) return false
    return eh * 60 + em > sh * 60 + sm
  }, [selectedDate, startTime, endTime])

  const computedRange = React.useMemo(() => {
    if (!isValidTimeRange) return null
    return {
      startIso: combineLocalDateAndTimeToIso(selectedDate, startTime),
      endIso: combineLocalDateAndTimeToIso(selectedDate, endTime),
    }
  }, [isValidTimeRange, selectedDate, startTime, endTime])

  // Debounce to avoid refetching overlaps aggressively while the user is selecting times/dates.
  const debouncedRangeKey = useDebounce(
    computedRange ? `${computedRange.startIso}|${computedRange.endIso}` : null,
    250
  )
  const debouncedRange = React.useMemo(() => {
    if (!debouncedRangeKey) return null
    const [startIso, endIso] = debouncedRangeKey.split("|")
    if (!startIso || !endIso) return null
    return { startIso, endIso }
  }, [debouncedRangeKey])

  const {
    data: overlaps,
    isFetching: overlapsFetching,
    isError: overlapsError,
  } = useQuery({
    queryKey: ["bookings", "overlaps", debouncedRange?.startIso, debouncedRange?.endIso, excludeBookingId],
    queryFn: () =>
      fetchBookingOverlaps({
        startIso: debouncedRange!.startIso,
        endIso: debouncedRange!.endIso,
        excludeBookingId,
      }),
    enabled: open && !!debouncedRange && isValidTimeRange,
    staleTime: 15_000,
    // Keep previous overlap results during refetches so dropdowns don't "flash" full lists.
    placeholderData: (prev) => prev,
  })

  const unavailable = React.useMemo(() => {
    const unavailableAircraftIds = new Set(overlaps?.unavailable_aircraft_ids ?? [])
    const unavailableInstructorIds = new Set(overlaps?.unavailable_instructor_ids ?? [])
    return { unavailableAircraftIds, unavailableInstructorIds }
  }, [overlaps?.unavailable_aircraft_ids, overlaps?.unavailable_instructor_ids])

  const availableAircraft = React.useMemo(() => {
    const all = options?.aircraft ?? []
    if (!isValidTimeRange) return all
    return all.filter((a) => !unavailable.unavailableAircraftIds.has(a.id))
  }, [options?.aircraft, isValidTimeRange, unavailable.unavailableAircraftIds])

  const availableInstructors = React.useMemo(() => {
    const all = options?.instructors ?? []
    if (!isValidTimeRange) return all
    return all.filter((i) => !unavailable.unavailableInstructorIds.has(i.id))
  }, [options?.instructors, isValidTimeRange, unavailable.unavailableInstructorIds])

  // If a previously selected resource becomes unavailable after changing the time range, clear it proactively.
  React.useEffect(() => {
    if (!open) return
    if (!isValidTimeRange) return

    const selectedAircraftId = form.getValues("aircraftId")
    if (selectedAircraftId && unavailable.unavailableAircraftIds.has(selectedAircraftId)) {
      form.setValue("aircraftId", "", { shouldValidate: true, shouldDirty: true })
      toast.message("Selected aircraft is no longer available for this time range.")
    }

    const selectedInstructorId = form.getValues("instructorId")
    if (selectedInstructorId && unavailable.unavailableInstructorIds.has(selectedInstructorId)) {
      form.setValue("instructorId", null, { shouldValidate: true, shouldDirty: true })
      toast.message("Selected instructor is no longer available for this time range.")
    }
  }, [open, isValidTimeRange, form, unavailable.unavailableAircraftIds, unavailable.unavailableInstructorIds])

  // Keep flight_type_id consistent with the "Regular/Trial" toggle
  React.useEffect(() => {
    if (!open) return
    if (!flightTypeId) return
    const existsInFiltered = filteredFlightTypes.some((ft) => ft.id === flightTypeId)
    if (existsInFiltered) return
    form.setValue("flightTypeId", null, { shouldValidate: true })
  }, [open, bookingMode, filteredFlightTypes, flightTypeId, form])

  // If the selected flight type is solo, instructor should be hidden and cleared.
  React.useEffect(() => {
    if (!open) return
    if (!shouldHideInstructor) return
    if (form.getValues("instructorId")) {
      form.setValue("instructorId", null, { shouldValidate: true, shouldDirty: true })
    }
  }, [open, shouldHideInstructor, form])

  const isRecurring = form.watch("isRecurring")
  const recurringDays = form.watch("recurringDays")
  const repeatUntil = form.watch("repeatUntil")

  const occurrences = React.useMemo(() => {
    if (!isRecurring || !selectedDate || !repeatUntil || recurringDays.length === 0) return []
    
    const list: { date: Date; startIso: string; endIso: string }[] = []
    let current = addDays(selectedDate, 0) // Start from the initial booking date

    while (current <= repeatUntil) {
      if (recurringDays.includes(current.getDay())) {
        list.push({
          date: new Date(current),
          startIso: combineLocalDateAndTimeToIso(current, startTime),
          endIso: combineLocalDateAndTimeToIso(current, endTime),
        })
      }
      current = addDays(current, 1)
    }
    return list
  }, [isRecurring, selectedDate, repeatUntil, recurringDays, startTime, endTime])

  const [occurrenceConflicts, setOccurrenceConflicts] = React.useState<Record<string, { aircraft: boolean; instructor: boolean }>>({})
  const [checkingOccurrences, setCheckingOccurrences] = React.useState(false)

  const aircraftIdWatched = form.watch("aircraftId")
  const instructorIdWatched = form.watch("instructorId")

  // Batch check occurrences for conflicts
  React.useEffect(() => {
    if (!open || !isRecurring || occurrences.length <= 1) {
      setOccurrenceConflicts({})
      return
    }

    const checkConflicts = async () => {
      setCheckingOccurrences(true)
      const conflicts: Record<string, { aircraft: boolean; instructor: boolean }> = {}
      
      try {
        const aircraftId = aircraftIdWatched
        const instructorId = instructorIdWatched

        // Check each occurrence (except the first one which is handled by the main overlap check)
        // Actually, let's check ALL of them to be safe and consistent
        await Promise.all(occurrences.map(async (occ) => {
          const res = await fetchBookingOverlaps({
            startIso: occ.startIso,
            endIso: occ.endIso,
            excludeBookingId,
          })
          
          const aircraftConflict = aircraftId ? res.unavailable_aircraft_ids.includes(aircraftId) : false
          const instructorConflict = instructorId ? res.unavailable_instructor_ids.includes(instructorId) : false
          
          if (aircraftConflict || instructorConflict) {
            conflicts[occ.startIso] = { aircraft: aircraftConflict, instructor: instructorConflict }
          }
        }))
        
        setOccurrenceConflicts(conflicts)
      } catch (err) {
        console.error("Failed to check occurrence conflicts:", err)
      } finally {
        setCheckingOccurrences(false)
      }
    }

    const timer = setTimeout(checkConflicts, 500)
    return () => clearTimeout(timer)
  }, [open, isRecurring, occurrences, excludeBookingId, aircraftIdWatched, instructorIdWatched])

  const hasConflicts = Object.keys(occurrenceConflicts).length > 0

  async function submit(values: FormValues, statusOverride?: "unconfirmed" | "confirmed") {
    if (!user) {
      toast.error("You must be signed in to create a booking.")
      return
    }

    if (isStaff && !values.member?.id) {
      form.setError("member", { type: "manual", message: "Member is required" })
      toast.error("Please select a member for this booking.")
      return
    }

    if (values.isRecurring && hasConflicts) {
      toast.error("Please resolve the resource conflicts before saving.")
      return
    }

    setSubmitting(true)
    try {
      const isRecurringMode = values.isRecurring && occurrences.length > 0

      let endpoint = "/api/bookings"
      let payload: Record<string, unknown>

      if (isRecurringMode) {
        endpoint = "/api/bookings/batch"
        payload = {
          bookings: occurrences.map((occ) => ({
            aircraft_id: values.aircraftId,
            start_time: occ.startIso,
            end_time: occ.endIso,
            booking_type: values.bookingType,
            purpose: values.purpose,
            remarks: values.remarks || null,
            instructor_id: shouldHideInstructor ? null : (values.instructorId || null),
            flight_type_id: values.flightTypeId || null,
            lesson_id: values.lessonId || null,
            user_id: isStaff && values.member?.id ? values.member.id : undefined,
            status: isStaff && statusOverride ? statusOverride : undefined,
          }))
        }
      } else {
        const startIso = combineLocalDateAndTimeToIso(values.date, values.startTime)
        const endIso = combineLocalDateAndTimeToIso(values.date, values.endTime)
        
        const singlePayload: Record<string, unknown> = {
          aircraft_id: values.aircraftId,
          start_time: startIso,
          end_time: endIso,
          booking_type: values.bookingType,
          purpose: values.purpose,
          remarks: values.remarks || null,
          instructor_id: shouldHideInstructor ? null : (values.instructorId || null),
          flight_type_id: values.flightTypeId || null,
          lesson_id: values.lessonId || null,
        }

        if (isStaff && values.member?.id) {
          singlePayload.user_id = values.member.id
        }

        if (isStaff && statusOverride) {
          singlePayload.status = statusOverride
        }
        
        payload = singlePayload
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = typeof json?.error === "string" ? json.error : "Failed to create booking(s)"
        toast.error(msg)
        return
      }

      if (isRecurring) {
        const bookings = json.bookings as BookingWithRelations[] | undefined
        if (!bookings || bookings.length === 0) {
          toast.error("Bookings created, but response was unexpected.")
          return
        }
        toast.success(`${bookings.length} bookings created`)
        onCreated?.(bookings[0]) // Just pass the first one or update the whole scheduler
      } else {
        const booking = json.booking as BookingWithRelations | undefined
        if (!booking?.id) {
          toast.error("Booking created, but response was unexpected.")
          return
        }
        toast.success("Booking created")
        onCreated?.(booking)
      }

      queryClient.invalidateQueries({ queryKey: ["scheduler", "bookings"] })
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  const errors = form.formState.errors
  const isCheckingAvailability = open && isValidTimeRange && overlapsFetching && !overlaps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden flex flex-col",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[720px]",
          "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
          "h-[calc(100dvh-2rem)] sm:h-fit sm:max-h-[90vh]"
        )}
      >
        <div className="flex flex-1 flex-col min-h-0 bg-white overflow-hidden">
          <DialogHeader className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-4 text-left sm:pt-6 shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                  New Booking
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm text-slate-500">
                  Enter details for the new booking. Required fields are marked with{" "}
                  <span className="text-destructive">*</span>.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit((v) => submit(v, "unconfirmed"))}
            className="flex-1 overflow-y-auto px-6 pb-6"
          >
          <div className="space-y-6">
            {/* Booking kind (Regular / Trial) */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <span className="text-xs font-semibold tracking-tight text-slate-900">Booking Category</span>
              </div>
              <Tabs value={bookingMode} onValueChange={(v) => setBookingMode(v as "regular" | "trial")} className="w-full">
                <TabsList className="grid h-9 w-full grid-cols-2 rounded-[12px] bg-slate-50 p-1 ring-1 ring-slate-100">
                  <TabsTrigger 
                    value="regular" 
                    className="gap-2 rounded-[8px] text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200 py-1"
                  >
                    <User className="h-3.5 w-3.5" />
                    Regular Booking
                  </TabsTrigger>
                  <TabsTrigger 
                    value="trial" 
                    className="gap-2 rounded-[8px] text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200 py-1"
                  >
                    <Plane className="h-3.5 w-3.5" />
                    Trial Flight
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </section>

            {/* Recurring Toggle */}
            <section className="rounded-[24px] bg-slate-50/50 p-5 ring-1 ring-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Repeat className="h-4 w-4" />
                  </div>
                  <div>
                    <Label htmlFor="recurring" className="text-sm font-bold text-slate-900">Recurring Booking</Label>
                    <p className="text-[10px] font-medium text-slate-500">Automatically repeat this schedule</p>
                  </div>
                </div>
                <Switch
                  id="recurring"
                  checked={form.watch("isRecurring")}
                  onCheckedChange={(checked) => {
                    form.setValue("isRecurring", checked)
                    if (!checked) {
                      form.setValue("recurringDays", [])
                      form.setValue("repeatUntil", null)
                    } else {
                      const currentDay = form.getValues("date").getDay()
                      form.setValue("recurringDays", [currentDay])
                    }
                  }}
                />
              </div>

              {form.watch("isRecurring") && (
                <div className="mt-5 space-y-5 border-t border-slate-100 pt-5">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Repeat on days</Label>
                    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => {
                        const isSelected = form.watch("recurringDays").includes(index)
                        return (
                          <Button
                            key={index}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            className={cn(
                              "h-9 w-full p-0 text-[10px] font-bold rounded-xl transition-all",
                              isSelected 
                                ? "bg-slate-900 hover:bg-slate-800 text-white border-slate-900 shadow-sm" 
                                : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-none"
                            )}
                            onClick={() => {
                              const current = form.getValues("recurringDays")
                              if (current.includes(index)) {
                                form.setValue("recurringDays", current.filter(d => d !== index))
                              } else {
                                form.setValue("recurringDays", [...current, index])
                              }
                            }}
                          >
                            <span className="sm:hidden">{day.charAt(0)}</span>
                            <span className="hidden sm:inline">{day}</span>
                          </Button>
                        )
                      })}
                    </div>
                    {errors.recurringDays && (
                      <p className="text-[10px] font-medium text-destructive">{errors.recurringDays.message as string}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-xl bg-white p-3 ring-1 ring-slate-100">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Until Date</Label>
                      <p className="text-[10px] font-medium text-slate-500">Last occurrence</p>
                    </div>
                    <div className="w-[140px]">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "h-9 w-full justify-start rounded-lg border-slate-200 bg-white px-2.5 text-xs font-bold shadow-none hover:bg-slate-50 focus:ring-0 transition-colors",
                              !form.watch("repeatUntil") && "text-slate-400"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate">
                              {form.watch("repeatUntil") ? format(form.watch("repeatUntil")!, "dd MMM yyyy") : "End date"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-2xl border-slate-200 shadow-2xl" align="end">
                          <Calendar
                            mode="single"
                            selected={form.watch("repeatUntil") || undefined}
                            onSelect={(d) => form.setValue("repeatUntil", d, { shouldValidate: true })}
                            disabled={(date) => date <= form.getValues("date")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  {errors.repeatUntil && (
                    <p className="text-[10px] font-medium text-destructive">{errors.repeatUntil.message as string}</p>
                  )}
                </div>
              )}
            </section>

            {isRecurring && occurrences.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Occurrences ({occurrences.length})</span>
                  </div>
                  {checkingOccurrences && (
                    <span className="text-[10px] text-slate-500 animate-pulse">Checking availability...</span>
                  )}
                </div>

                {hasConflicts ? (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-xs font-bold">Resource Conflicts Detected</span>
                    </div>
                    <p className="text-[10px] text-destructive/80 leading-relaxed">
                      Some occurrences have conflicts with existing bookings. Please adjust your schedule or resources.
                    </p>
                    <div className="max-h-[160px] overflow-y-auto space-y-1 pr-2">
                      {occurrences.map((occ) => {
                        const conflict = occurrenceConflicts[occ.startIso]
                        if (!conflict) return null
                        return (
                          <div key={occ.startIso} className="flex items-center justify-between rounded-lg bg-white/50 px-3 py-2 text-[10px] ring-1 ring-destructive/10">
                            <span className="font-semibold text-slate-700">{format(occ.date, "EEE, dd MMM")}</span>
                            <div className="flex gap-2">
                              {conflict.aircraft && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive font-bold uppercase tracking-wider">Aircraft Conflict</span>}
                              {conflict.instructor && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive font-bold uppercase tracking-wider">Instructor Conflict</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : occurrences.length > 1 ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 flex items-center gap-2 text-emerald-700">
                    <Check className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium">All {occurrences.length} occurrences are available</span>
                  </div>
                ) : null}
              </section>
            )}

            {/* Scheduled times (two-column) */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <span className="text-xs font-semibold tracking-tight text-slate-900">Schedule Times</span>
              </div>
              
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    START TIME <span className="text-destructive">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-[1.4] space-y-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            type="button" 
                            variant="outline" 
                            className="h-10 w-full justify-start rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{format(form.watch("date"), "dd MMM yyyy")}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={form.watch("date")}
                            onSelect={(d) => {
                              if (!d) return
                              form.setValue("date", d, { shouldValidate: true })
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {errors.date ? (
                        <p className="text-[10px] text-destructive">{errors.date.message as string}</p>
                      ) : null}
                    </div>
                    <div className="flex-1 space-y-1">
                      <Select
                        value={form.watch("startTime")}
                        onValueChange={(v) => form.setValue("startTime", v, { shouldValidate: true })}
                      >
                        <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                          <SelectValue placeholder="Time" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                          {TIME_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t} className="rounded-lg py-2 text-xs">
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.startTime ? (
                        <p className="text-[10px] text-destructive">{errors.startTime.message}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    END TIME <span className="text-destructive">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-[1.4] space-y-1">
                      {/* For now we keep the same date (booking is same-day). UI matches screenshot. */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            type="button" 
                            variant="outline" 
                            className="h-10 w-full justify-start rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0"
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{format(form.watch("date"), "dd MMM yyyy")}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={form.watch("date")}
                            onSelect={(d) => {
                              if (!d) return
                              form.setValue("date", d, { shouldValidate: true })
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex-1 space-y-1">
                      <Select
                        value={form.watch("endTime")}
                        onValueChange={(v) => form.setValue("endTime", v, { shouldValidate: true })}
                      >
                        <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                          <SelectValue placeholder="Time" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                          {TIME_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t} className="rounded-lg py-2 text-xs">
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.endTime ? <p className="text-[10px] text-destructive">{errors.endTime.message}</p> : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Details (two-column grid) */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <span className="text-xs font-semibold tracking-tight text-slate-900">Booking Details</span>
              </div>

              {optionsError ? (
                <div className="mb-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-2 text-[10px] font-medium text-destructive">
                  Could not load booking options. Please refresh and try again.
                </div>
              ) : null}
              {overlapsError ? (
                <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-[10px] font-medium text-amber-700">
                  Could not verify aircraft/instructor availability. You can still try to save; the database will prevent invalid overlaps.
                </div>
              ) : null}

              <div className="grid gap-5 sm:grid-cols-2">
                {/* Member */}
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    SELECT MEMBER {isStaff ? <span className="text-destructive">*</span> : null}
                  </label>
                  {isStaff ? (
                    <>
                      <MemberSelect
                        value={(form.getValues("member") as UserResult | null) ?? null}
                        onSelect={(u) => form.setValue("member", u, { shouldValidate: true })}
                      />
                      {errors.member ? (
                        <p className="text-[10px] text-destructive mt-1">{errors.member.message as string}</p>
                      ) : null}
                    </>
                  ) : (
                    <div className="h-10 flex items-center rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium text-slate-600">
                      <User className="mr-2 h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{user?.email ?? "your account"}</span>
                      {role ? <span className="ml-1.5 text-[10px] text-slate-400 shrink-0">({role})</span> : null}
                    </div>
                  )}
                </div>

                {/* Instructor */}
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    SELECT INSTRUCTOR
                  </label>
                  <Select
                    disabled={optionsLoading || !options || shouldHideInstructor || isCheckingAvailability}
                    value={form.watch("instructorId") || "none"}
                    onValueChange={(id) => form.setValue("instructorId", id === "none" ? null : id, { shouldValidate: true })}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                      <div className="flex items-center gap-2 truncate">
                        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <SelectValue placeholder={
                          shouldHideInstructor
                            ? "Not required"
                            : optionsLoading
                              ? "Loading..."
                              : isCheckingAvailability
                                ? "Checking availability..."
                              : "No instructor"
                        } />
                      </div>
                    </SelectTrigger>
                    <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                      <SelectItem value="none" className="rounded-lg py-2 text-xs">
                        No instructor
                      </SelectItem>
                      {availableInstructors.map((i) => {
                        const full = [i.first_name, i.last_name].filter(Boolean).join(" ").trim()
                        const label = full || i.user?.email || "Instructor"
                        return (
                          <SelectItem key={i.id} value={i.id} className="rounded-lg py-2 text-xs">
                            {label}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  {errors.instructorId ? (
                    <p className="text-[10px] text-destructive mt-1">{errors.instructorId.message}</p>
                  ) : null}
                </div>

                {/* Aircraft */}
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    AIRCRAFT <span className="text-destructive">*</span>
                  </label>
                  <Select
                    disabled={optionsLoading || !options || isCheckingAvailability}
                    value={form.watch("aircraftId") || undefined}
                    onValueChange={(id) => form.setValue("aircraftId", id, { shouldValidate: true })}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                      <div className="flex items-center gap-2 truncate">
                        <Plane className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <SelectValue placeholder={
                          optionsLoading
                            ? "Loading..."
                            : isCheckingAvailability
                              ? "Checking availability..."
                              : "Select aircraft"
                        } />
                      </div>
                    </SelectTrigger>
                    <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                      {availableAircraft.map((a) => (
                        <SelectItem key={a.id} value={a.id} className="rounded-lg py-2 text-xs">
                          {a.registration} ({a.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.aircraftId ? <p className="text-[10px] text-destructive mt-1">{errors.aircraftId.message}</p> : null}
                </div>

                {/* Booking Type */}
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    BOOKING TYPE <span className="text-destructive">*</span>
                  </label>
                  <Select
                    value={bookingType}
                    onValueChange={(v) => {
                      form.setValue("bookingType", v as BookingType, { shouldValidate: true })
                      if (v !== "flight") {
                        form.setValue("flightTypeId", null, { shouldValidate: true })
                      }
                    }}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                      {BOOKING_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="rounded-lg py-2 text-xs">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.bookingType ? <p className="text-[10px] text-destructive mt-1">{errors.bookingType.message}</p> : null}
                </div>

                {/* Flight type */}
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    FLIGHT TYPE {bookingType === "flight" ? <span className="text-destructive">*</span> : null}
                  </label>
                  <Select
                    disabled={optionsLoading || !options || bookingType !== "flight"}
                    value={form.watch("flightTypeId") || "none"}
                    onValueChange={(id) => form.setValue("flightTypeId", id === "none" ? null : id, { shouldValidate: true })}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-base font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                      <div className="flex items-center gap-2 truncate">
                        <Plane className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <SelectValue placeholder={
                          bookingType !== "flight"
                            ? "N/A"
                            : optionsLoading
                              ? "Loading..."
                              : "Select flight type"
                        } />
                      </div>
                    </SelectTrigger>
                    <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                      <SelectItem value="none" className="rounded-lg py-2 text-xs">
                        None
                      </SelectItem>
                      {filteredFlightTypes.map((ft) => (
                        <SelectItem key={ft.id} value={ft.id} className="rounded-lg py-2 text-xs">
                          {ft.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.flightTypeId ? (
                    <p className="text-[10px] text-destructive mt-1">{errors.flightTypeId.message as string}</p>
                  ) : null}
                </div>

                {/* Lesson */}
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    LESSON
                  </label>
                  <LocalCombobox
                    disabled={optionsLoading || !options || bookingType !== "flight"}
                    valueId={form.watch("lessonId") || null}
                    onChange={(id) => form.setValue("lessonId", id, { shouldValidate: true })}
                    placeholder={
                      bookingType !== "flight"
                        ? "N/A"
                        : optionsLoading
                          ? "Loading..."
                          : "Select lesson"
                    }
                    items={options?.lessons ?? []}
                    icon={<NotebookPen className="h-3.5 w-3.5 shrink-0" />}
                    itemLabel={(l) => l.name}
                  />
                  {errors.lessonId ? (
                    <p className="text-[10px] text-destructive mt-1">{errors.lessonId.message as string}</p>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Notes */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold tracking-tight text-slate-900">Notes & Remarks</span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    DESCRIPTION <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    rows={3}
                    placeholder="e.g. Dual circuits..."
                    className="rounded-xl border-slate-200 focus:ring-slate-900 text-base"
                    {...form.register("purpose")}
                  />
                  {errors.purpose ? <p className="text-[10px] text-destructive mt-1">{errors.purpose.message}</p> : null}
                </div>

                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    REMARKS (OPTIONAL)
                  </label>
                  <Textarea 
                    rows={3} 
                    placeholder="Internal notes..." 
                    className="rounded-xl border-slate-200 focus:ring-slate-900 text-base"
                    {...form.register("remarks")} 
                  />
                  {errors.remarks ? <p className="text-[10px] text-destructive mt-1">{errors.remarks.message}</p> : null}
                </div>
              </div>
            </section>
          </div>
        </form>

        {/* Footer */}
        <div className="border-t bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:pb-4 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              disabled={submitting}
              className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
            >
              Cancel
            </Button>
            {isStaff ? (
              <Button
                type="button"
                disabled={submitting}
                onClick={form.handleSubmit((v) => submit(v, "confirmed"))}
                className="h-10 flex-1 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-lg shadow-emerald-600/10 hover:bg-emerald-500"
              >
                Save & Confirm
              </Button>
            ) : null}
            <Button 
              type="submit" 
              disabled={submitting}
              onClick={form.handleSubmit((v) => submit(v, "unconfirmed"))}
              className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
            >
              {submitting ? "Saving..." : "Save Booking"}
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
)
}


