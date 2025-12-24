"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { CalendarIcon, Check, ChevronsUpDown, User, Plane, NotebookPen, Plus } from "lucide-react"
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
          className="h-10 w-full justify-between rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0"
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

export type NewBookingPrefill = {
  date?: Date
  startTime?: string
  aircraftId?: string
  instructorId?: string
}

export function NewBookingModal(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefill?: NewBookingPrefill
  onCreated?: (booking: BookingWithRelations) => void
}) {
  const { open, onOpenChange, prefill, onCreated } = props
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
      member: null,
      bookingType: "flight",
      purpose: "",
      remarks: "",
    },
    mode: "onSubmit",
  })

  const startTime = form.watch("startTime")

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
      member: null,
      bookingType: "flight",
      purpose: "",
      remarks: "",
    })
    setBookingMode("regular")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill?.date, prefill?.startTime, prefill?.aircraftId, prefill?.instructorId])

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

    setSubmitting(true)
    try {
      const startIso = combineLocalDateAndTimeToIso(values.date, values.startTime)
      const endIso = combineLocalDateAndTimeToIso(values.date, values.endTime)

      const payload: Record<string, unknown> = {
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

      // Staff can select a member; members/students are always forced to self on server
      if (isStaff && values.member?.id) {
        payload.user_id = values.member.id
      }

      // Staff can optionally confirm on creation
      if (isStaff && statusOverride) {
        payload.status = statusOverride
      }

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = typeof json?.error === "string" ? json.error : "Failed to create booking"
        toast.error(msg)
        return
      }

      const booking = json.booking as BookingWithRelations | undefined
      if (!booking?.id) {
        toast.error("Booking created, but response was unexpected.")
        return
      }

      toast.success("Booking created")
      onCreated?.(booking)
      queryClient.invalidateQueries({ queryKey: ["scheduler", "bookings"] })
      queryClient.invalidateQueries({ queryKey: ["bookings"] })
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  const errors = form.formState.errors

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] overflow-hidden rounded-[24px] p-0 border-none shadow-2xl">
        <div className="flex h-full flex-col bg-white">
          <DialogHeader className="px-6 pt-6 pb-4 text-left">
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
            className="max-h-[80vh] overflow-y-auto px-6 pb-6"
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
                            className="h-10 w-full justify-start rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0"
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
                        <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0">
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
                            className="h-10 w-full justify-start rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0"
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
                        <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0">
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
                    disabled={optionsLoading || !options || shouldHideInstructor}
                    value={form.watch("instructorId") || "none"}
                    onValueChange={(id) => form.setValue("instructorId", id === "none" ? null : id, { shouldValidate: true })}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                      <div className="flex items-center gap-2 truncate">
                        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <SelectValue placeholder={
                          shouldHideInstructor
                            ? "Not required"
                            : optionsLoading
                              ? "Loading..."
                              : "No instructor"
                        } />
                      </div>
                    </SelectTrigger>
                    <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                      <SelectItem value="none" className="rounded-lg py-2 text-xs">
                        No instructor
                      </SelectItem>
                      {(options?.instructors ?? []).map((i) => {
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
                    disabled={optionsLoading || !options}
                    value={form.watch("aircraftId") || undefined}
                    onValueChange={(id) => form.setValue("aircraftId", id, { shouldValidate: true })}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0">
                      <div className="flex items-center gap-2 truncate">
                        <Plane className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <SelectValue placeholder={optionsLoading ? "Loading..." : "Select aircraft"} />
                      </div>
                    </SelectTrigger>
                    <SelectContent position="popper" className="w-[var(--radix-select-trigger-width)] rounded-xl border-slate-200 shadow-xl">
                      {(options?.aircraft ?? []).map((a) => (
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
                    <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0">
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
                    <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-0">
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
                    className="rounded-xl border-slate-200 focus:ring-slate-900 text-xs"
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
                    className="rounded-xl border-slate-200 focus:ring-slate-900 text-xs"
                    {...form.register("remarks")} 
                  />
                  {errors.remarks ? <p className="text-[10px] text-destructive mt-1">{errors.remarks.message}</p> : null}
                </div>
              </div>
            </section>
          </div>
        </form>

        {/* Footer */}
        <div className="border-t bg-white px-6 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
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


