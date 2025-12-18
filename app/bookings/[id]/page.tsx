"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  IconArrowLeft,
  IconCalendar,
  IconClock,
  IconPlane,
  IconUser,
  IconSchool,
  IconFileText,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconHistory,
  IconDeviceFloppy,
  IconRotateClockwise,
  IconChevronDown,
  IconInfoCircle,
  IconUsers,
  IconBook,
  IconDotsVertical,
  IconEye,
  IconTrash,
} from "@tabler/icons-react"
import { toast } from "sonner"
import Link from "next/link"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Generate time options in half-hour increments
function generateTimeOptions(): string[] {
  const times: string[] = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = String(hour).padStart(2, "0")
      const m = String(minute).padStart(2, "0")
      times.push(`${h}:${m}`)
    }
  }
  return times
}

const TIME_OPTIONS = generateTimeOptions()

// Format time for display (HH:mm to 12-hour format)
function formatTimeForDisplay(time: string): string {
  if (!time) return "Select time"
  const [hours, minutes] = time.split(":")
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? "pm" : "am"
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { ChevronDownIcon } from "lucide-react"
import type { BookingWithRelations, BookingStatus, BookingType } from "@/lib/types/bookings"
import { useAuth } from "@/contexts/auth-context"

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let message = "Request failed"
    try {
      const data = await res.json()
      if (typeof data?.error === "string") message = data.error
    } catch {
      // ignore
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

// Form schema
const bookingSchema = z.object({
  start_time: z.string(),
  end_time: z.string(),
  aircraft_id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  instructor_id: z.string().uuid().nullable(),
  flight_type_id: z.string().uuid().nullable(),
  lesson_id: z.string().uuid().nullable(),
  booking_type: z.enum(['flight', 'groundwork', 'maintenance', 'other']),
  purpose: z.string().min(1, "Purpose is required"),
  remarks: z.string().nullable(),
})

type BookingFormData = z.infer<typeof bookingSchema>

interface BookingOptions {
  aircraft: Array<{ id: string; registration: string; type: string; model: string | null; manufacturer: string | null }>
  members: Array<{ id: string; first_name: string | null; last_name: string | null; email: string }>
  instructors: Array<{ id: string; first_name: string | null; last_name: string | null; user: { id: string; email: string } | null }>
  flightTypes: Array<{ id: string; name: string }>
  lessons: Array<{ id: string; name: string; description: string | null }>
}

interface AuditLog {
  id: string
  action: string
  old_data: unknown
  new_data: unknown
  column_changes: Record<string, { old?: unknown; new?: unknown }> | null
  user_id: string | null
  created_at: string
  user?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
}

function getStatusBadgeVariant(status: BookingStatus) {
  switch (status) {
    case "confirmed":
      return "default"
    case "flying":
      return "default"
    case "briefing":
      return "secondary"
    case "unconfirmed":
      return "secondary"
    case "complete":
      return "outline"
    case "cancelled":
      return "destructive"
    default:
      return "outline"
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

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  return "Request failed"
}

// Format audit log description from column changes
function formatAuditDescription(log: AuditLog): string {
  if (log.action === 'INSERT') {
    return "Booking Created"
  }
  
  if (!log.column_changes || Object.keys(log.column_changes).length === 0) {
    return log.action
  }

  const changes = Object.entries(log.column_changes).map(([key, value]) => {
    const fieldName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    const oldVal = formatAuditValue((value as { old?: unknown }).old)
    const newVal = formatAuditValue((value as { new?: unknown }).new)
    
    // Format time values specially
    if (key.includes('time')) {
      const oldTime = oldVal ? formatTimeForAudit(oldVal) : oldVal
      const newTime = newVal ? formatTimeForAudit(newVal) : newVal
      return `${fieldName}: ${oldTime} → ${newTime}`
    }
    
    return `${fieldName}: ${oldVal} → ${newVal}`
  })

  return changes.join('; ')
}

// Format time value for audit display
function formatTimeForAudit(value: string): string {
  try {
    const date = new Date(value)
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = String(minutes).padStart(2, '0')
    return `${displayHours}:${displayMinutes} ${ampm}`
  } catch {
    return value
  }
}

// Format audit value for display
function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === 'string') {
    // Check if it's a datetime string
    if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return formatTimeForAudit(value)
    }
    return value
  }
  return String(value)
}

export default function BookingDetailPage() {
  const params = useParams()
  const { role } = useAuth()
  const bookingId = params.id as string

  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    setValue,
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
  })

  // Use isDirty directly from form state instead of manual tracking
  const hasChanges = isDirty

  const bookingQuery = useQuery({
    queryKey: ["booking", bookingId],
    enabled: !!bookingId,
    queryFn: () => fetchJson<{ booking: BookingWithRelations }>(`/api/bookings/${bookingId}`),
    staleTime: 30_000,
  })

  const auditQuery = useQuery({
    queryKey: ["bookingAudit", bookingId],
    enabled: !!bookingId,
    queryFn: () => fetchJson<{ auditLogs: AuditLog[] }>(`/api/bookings/${bookingId}/audit`),
    staleTime: 10_000,
  })

  const optionsQuery = useQuery({
    queryKey: ["bookingOptions"],
    queryFn: () => fetchJson<BookingOptions>(`/api/bookings/options`),
    staleTime: 15 * 60_000,
  })

  const booking = bookingQuery.data?.booking ?? null
  const auditLogs = auditQuery.data?.auditLogs ?? []
  const options = optionsQuery.data ?? null

  // Helper functions to convert ISO datetime string to Date and time string
  const parseDateTime = (isoString: string | null | undefined) => {
    if (!isoString) return { date: undefined, time: "" }
    const date = new Date(isoString)
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    return { date, time: `${hours}:${minutes}` }
  }

  // Helper function to combine Date and time string into ISO datetime string
  const combineDateTime = (date: Date | undefined, time: string): string => {
    if (!date || !time) return ""
    const [hours, minutes] = time.split(":")
    const combined = new Date(date)
    combined.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
    return combined.toISOString().slice(0, 16)
  }

  // Local state for date/time pickers
  const [startDate, setStartDate] = React.useState<Date | undefined>()
  const [startTime, setStartTime] = React.useState("")
  const [endDate, setEndDate] = React.useState<Date | undefined>()
  const [endTime, setEndTime] = React.useState("")
  const [openStartDate, setOpenStartDate] = React.useState(false)
  const [openEndDate, setOpenEndDate] = React.useState(false)
  const [auditLogOpen, setAuditLogOpen] = React.useState(true)
  const [memberSearchOpen, setMemberSearchOpen] = React.useState(false)

  // Populate form when booking loads/changes (query-cached)
  React.useEffect(() => {
    if (!booking) return
    
    const start = parseDateTime(booking.start_time)
    const end = parseDateTime(booking.end_time)
    
    setStartDate(start.date)
    setStartTime(start.time)
    setEndDate(end.date)
    setEndTime(end.time)
    
      reset({
        start_time: booking.start_time ? new Date(booking.start_time).toISOString().slice(0, 16) : "",
        end_time: booking.end_time ? new Date(booking.end_time).toISOString().slice(0, 16) : "",
        aircraft_id: booking.aircraft_id || "",
        user_id: booking.user_id || null,
        instructor_id: booking.instructor_id || null,
        flight_type_id: booking.flight_type_id || null,
        lesson_id: booking.lesson_id || null,
        booking_type: booking.booking_type,
        purpose: booking.purpose || "",
        remarks: booking.remarks || null,
      })
  }, [booking, reset])

  // Auto-set end date to start date if end date is not set
  React.useEffect(() => {
    if (startDate && !endDate) {
      setEndDate(startDate)
    }
  }, [startDate, endDate])

  // Update form values when date/time changes
  React.useEffect(() => {
    if (startDate && startTime) {
      const isoString = combineDateTime(startDate, startTime)
      setValue("start_time", isoString, { shouldDirty: true })
    } else if (!startDate || !startTime) {
      setValue("start_time", "", { shouldDirty: true })
    }
  }, [startDate, startTime, setValue])

  React.useEffect(() => {
    if (endDate && endTime) {
      const isoString = combineDateTime(endDate, endTime)
      setValue("end_time", isoString, { shouldDirty: true })
    } else if (!endDate || !endTime) {
      setValue("end_time", "", { shouldDirty: true })
    }
  }, [endDate, endTime, setValue])

  const updateMutation = useMutation({
    mutationFn: (data: BookingFormData) =>
      fetchJson<{ booking: BookingWithRelations }>(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: async (result) => {
      queryClient.setQueryData(["booking", bookingId], { booking: result.booking })
      // Reset form to mark as clean after successful save
      const start = parseDateTime(result.booking.start_time)
      const end = parseDateTime(result.booking.end_time)
      setStartDate(start.date)
      setStartTime(start.time)
      setEndDate(end.date)
      setEndTime(end.time)
      reset({
        start_time: result.booking.start_time ? new Date(result.booking.start_time).toISOString().slice(0, 16) : "",
        end_time: result.booking.end_time ? new Date(result.booking.end_time).toISOString().slice(0, 16) : "",
        aircraft_id: result.booking.aircraft_id || "",
        user_id: result.booking.user_id || null,
        instructor_id: result.booking.instructor_id || null,
        flight_type_id: result.booking.flight_type_id || null,
        lesson_id: result.booking.lesson_id || null,
        booking_type: result.booking.booking_type,
        purpose: result.booking.purpose || "",
        remarks: result.booking.remarks || null,
      }, { keepValues: true })
      toast.success("Booking updated successfully")
      await queryClient.invalidateQueries({ queryKey: ["bookingAudit", bookingId] })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  const onSubmit = (data: BookingFormData) => updateMutation.mutate(data)

  // Mutation for status updates (separate from form updates)
  const statusUpdateMutation = useMutation({
    mutationFn: async (status: BookingStatus) => {
      return fetchJson<{ booking: BookingWithRelations }>(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(["booking", bookingId], { booking: result.booking })
      await queryClient.invalidateQueries({ queryKey: ["bookings"] })
      toast.success(`Booking ${result.booking.status === 'confirmed' ? 'confirmed' : 'updated'} successfully`)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  const handleConfirmBooking = () => {
    if (!booking) return
    statusUpdateMutation.mutate('confirmed')
  }

  const handleCheckFlightOut = () => {
    if (!booking) return
    statusUpdateMutation.mutate('flying')
  }

  const handleCheckFlightIn = () => {
    if (!booking) return
    statusUpdateMutation.mutate('complete')
  }

  const handleUndo = () => {
    if (booking) {
      const start = parseDateTime(booking.start_time)
      const end = parseDateTime(booking.end_time)
      
      setStartDate(start.date)
      setStartTime(start.time)
      setEndDate(end.date)
      setEndTime(end.time)
      
      reset({
        start_time: booking.start_time ? new Date(booking.start_time).toISOString().slice(0, 16) : '',
        end_time: booking.end_time ? new Date(booking.end_time).toISOString().slice(0, 16) : '',
        aircraft_id: booking.aircraft_id || '',
        user_id: booking.user_id || null,
        instructor_id: booking.instructor_id || null,
        flight_type_id: booking.flight_type_id || null,
        lesson_id: booking.lesson_id || null,
        booking_type: booking.booking_type,
        purpose: booking.purpose || '',
        remarks: booking.remarks || null,
      })
      toast.info('Changes reverted')
    }
  }

  const isAdminOrInstructor = role === 'owner' || role === 'admin' || role === 'instructor'

  const isLoading = bookingQuery.isLoading || optionsQuery.isLoading || auditQuery.isLoading
  const isError = bookingQuery.isError

  if (isLoading) {
    return (
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties}
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div className="text-muted-foreground">Loading booking...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (isError || !booking) {
    return (
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties}
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Booking not found</h2>
              <p className="text-muted-foreground mb-4">
                The booking {"you're"} looking for doesn{"'"}t exist.
              </p>
              <Button asChild>
                <Link href="/bookings">Back to Bookings</Link>
              </Button>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const studentName = booking.student
    ? [booking.student.first_name, booking.student.last_name].filter(Boolean).join(" ") || booking.student.email
    : "—"
  
  const instructorName = booking.instructor
    ? [booking.instructor.first_name, booking.instructor.last_name].filter(Boolean).join(" ") || booking.instructor.user?.email || "—"
    : "—"


  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)",
      } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col bg-muted/30">
          <div className="flex flex-1 flex-col">
            {/* Header Section with Enhanced Design */}
            <div className="border-b border-border/40 bg-gradient-to-br from-slate-50 via-blue-50/30 to-background dark:from-slate-900 dark:via-slate-800/50 dark:to-background">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* Top Row: Back Button and Status Badge */}
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <Button variant="ghost" size="sm" asChild className="-ml-2 hover:bg-accent/80">
                    <Link href="/bookings">
                      <IconArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Link>
                  </Button>
                  <Badge 
                    variant={getStatusBadgeVariant(booking.status)} 
                    className={`text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 font-semibold shadow-sm ${
                      booking.status === 'flying' 
                        ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700' 
                        : booking.status === 'confirmed'
                        ? 'bg-green-600 text-white border-green-700 hover:bg-green-700'
                        : booking.status === 'unconfirmed'
                        ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                        : ''
                    }`}
                  >
                    {getStatusLabel(booking.status)}
                  </Badge>
                </div>

                {/* Name Row */}
                <div className="mb-4 sm:mb-6">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground leading-tight">
                    {studentName}
                  </h1>
                </div>

                {/* Action Buttons Row */}
                {isAdminOrInstructor && (
                  <div className="flex flex-row items-center gap-3">
                    {/* Conditional Status Buttons */}
                    {booking.status === 'unconfirmed' && (
                      <Button 
                        size="lg" 
                        className="bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transition-all h-12 sm:h-11 flex-1 sm:flex-initial px-6 sm:px-8 text-base font-semibold"
                        onClick={handleConfirmBooking}
                        disabled={statusUpdateMutation.isPending}
                      >
                        <IconCheck className="h-5 w-5 mr-2" />
                        <span className="hidden sm:inline">
                          {statusUpdateMutation.isPending ? "Confirming..." : "Confirm Booking"}
                        </span>
                        <span className="sm:hidden">
                          {statusUpdateMutation.isPending ? "Confirming..." : "Confirm"}
                        </span>
                      </Button>
                    )}
                    {booking.status === 'confirmed' && (
                      <Button 
                        size="lg" 
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all h-12 sm:h-11 flex-1 sm:flex-initial px-6 sm:px-8 text-base font-semibold"
                        onClick={handleCheckFlightOut}
                        disabled={statusUpdateMutation.isPending}
                      >
                        <IconPlane className="h-5 w-5 mr-2" />
                        <span className="hidden sm:inline">
                          {statusUpdateMutation.isPending ? "Checking Out..." : "Check Flight Out"}
                        </span>
                        <span className="sm:hidden">
                          {statusUpdateMutation.isPending ? "Checking..." : "Check Out"}
                        </span>
                      </Button>
                    )}
                    {booking.status === 'flying' && (
                      <Button 
                        size="lg" 
                        className="bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transition-all h-12 sm:h-11 flex-1 sm:flex-initial px-6 sm:px-8 text-base font-semibold"
                        onClick={handleCheckFlightIn}
                        disabled={statusUpdateMutation.isPending}
                      >
                        <IconCheck className="h-5 w-5 mr-2" />
                        <span className="hidden sm:inline">
                          {statusUpdateMutation.isPending ? "Checking In..." : "Check Flight In"}
                        </span>
                        <span className="sm:hidden">
                          {statusUpdateMutation.isPending ? "Checking..." : "Check In"}
                        </span>
                      </Button>
                    )}
                    
                    {/* Options Dropdown - Always Visible */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="lg" 
                          className="border-border/50 hover:bg-accent/80 h-12 sm:h-11 flex-1 sm:flex-initial px-6 sm:px-8 text-base font-medium"
                        >
                          <IconDotsVertical className="h-5 w-5 mr-2" />
                          Options
                          <IconChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => {
                          // TODO: Implement print checkout sheet functionality
                          toast.info("Print checkout sheet functionality to be implemented")
                        }}>
                          <IconFileText className="h-4 w-4 mr-2" />
                          Print Checkout Sheet
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          // TODO: Implement other options
                          toast.info("Additional options to be implemented")
                        }}>
                          <IconEye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          // TODO: Implement cancel booking
                          toast.info("Cancel booking functionality to be implemented")
                        }}>
                          <IconTrash className="h-4 w-4 mr-2" />
                          Cancel Booking
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </div>

            {/* Main Content with Generous Padding */}
            <div className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Booking Details */}
                <div className="lg:col-span-2 space-y-6">
                  <Card className="shadow-sm border border-border/50 bg-card">
                    <CardHeader className="pb-6 border-b border-border/20">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-3 text-2xl font-bold text-foreground">
                          <IconCalendar className="h-6 w-6 text-foreground" />
                          Booking Details
                        </CardTitle>
                        {hasChanges && (
                          <div className="flex items-center gap-3">
                            <Button
                              variant="outline"
                              size="default"
                              onClick={handleUndo}
                              disabled={updateMutation.isPending}
                              className="border-border/50 hover:bg-accent/80 h-10 px-5"
                            >
                              <IconRotateClockwise className="h-4 w-4 mr-2" />
                              Undo Changes
                            </Button>
                            <Button
                              size="default"
                              onClick={handleSubmit(onSubmit)}
                              disabled={updateMutation.isPending}
                              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all h-10 px-5"
                            >
                              <IconDeviceFloppy className="h-4 w-4 mr-2" />
                              {updateMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <form onSubmit={handleSubmit(onSubmit)}>
                        <FieldGroup className="space-y-6">
                          {/* Scheduled Times */}
                          <div className="space-y-4 p-6 bg-muted/30 rounded-xl border border-border/30">
                            <div className="flex items-center gap-3 mb-5">
                              <IconClock className="h-4 w-4 text-foreground" />
                              <h3 className="font-bold text-sm uppercase tracking-wider text-foreground">Scheduled Times</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                              <Field>
                                <FieldLabel className="text-sm font-semibold text-foreground mb-2">Start Time</FieldLabel>
                                <div className="flex gap-3 items-end">
                                  <div className="flex-1">
                                    <Popover open={openStartDate} onOpenChange={setOpenStartDate}>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          className="w-full justify-between font-normal border-border/50 bg-background hover:bg-accent/50 h-10"
                                        >
                                          {startDate
                                            ? startDate.toLocaleDateString("en-US", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                              })
                                            : "Select date"}
                                          <ChevronDownIcon className="h-4 w-4" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        className="w-auto overflow-hidden p-0"
                                        align="start"
                                      >
                                        <Calendar
                                          mode="single"
                                          selected={startDate}
                                          captionLayout="dropdown"
                                          onSelect={(date) => {
                                            setStartDate(date)
                                            setOpenStartDate(false)
                                            // Auto-set end date to start date if end date is not set
                                            if (date && !endDate) {
                                              setEndDate(date)
                                            }
                                          }}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <div className="w-32">
                                    <Select
                                      value={startTime || "none"}
                                      onValueChange={(value) => setStartTime(value === "none" ? "" : value)}
                                    >
                                      <SelectTrigger className="w-full border-border/50 bg-background hover:bg-accent/50 h-10">
                                        <SelectValue placeholder="Time">
                                          {startTime ? formatTimeForDisplay(startTime) : "Time"}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent className="max-h-[200px]">
                                        <SelectItem value="none">Select time</SelectItem>
                                        {TIME_OPTIONS.map((time) => (
                                          <SelectItem key={time} value={time}>
                                            {formatTimeForDisplay(time)}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                {errors.start_time && (
                                  <p className="text-sm text-destructive mt-1.5">{errors.start_time.message}</p>
                                )}
                              </Field>
                              <Field>
                                <FieldLabel className="text-sm font-semibold text-foreground mb-2">End Time</FieldLabel>
                                <div className="flex gap-3 items-end">
                                  <div className="flex-1">
                                    <Popover open={openEndDate} onOpenChange={setOpenEndDate}>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          className="w-full justify-between font-normal border-border/50 bg-background hover:bg-accent/50 h-10"
                                        >
                                          {endDate
                                            ? endDate.toLocaleDateString("en-US", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                              })
                                            : "Select date"}
                                          <ChevronDownIcon className="h-4 w-4" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        className="w-auto overflow-hidden p-0"
                                        align="start"
                                      >
                                        <Calendar
                                          mode="single"
                                          selected={endDate}
                                          captionLayout="dropdown"
                                          onSelect={(date) => {
                                            setEndDate(date)
                                            setOpenEndDate(false)
                                          }}
                                          disabled={startDate ? { before: startDate } : undefined}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <div className="w-32">
                                    <Select
                                      value={endTime || "none"}
                                      onValueChange={(value) => setEndTime(value === "none" ? "" : value)}
                                    >
                                      <SelectTrigger className="w-full border-border/50 bg-background hover:bg-accent/50 h-10">
                                        <SelectValue placeholder="Time">
                                          {endTime ? formatTimeForDisplay(endTime) : "Time"}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent className="max-h-[200px]">
                                        <SelectItem value="none">Select time</SelectItem>
                                        {TIME_OPTIONS.map((time) => (
                                          <SelectItem key={time} value={time}>
                                            {formatTimeForDisplay(time)}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                {errors.end_time && (
                                  <p className="text-sm text-destructive mt-1.5">{errors.end_time.message}</p>
                                )}
                              </Field>
                            </div>
                          </div>

                          {/* Booking Information - Two Column Layout */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Field>
                              <FieldLabel className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <IconUser className="h-4 w-4 text-foreground" />
                                Member
                              </FieldLabel>
                              {isAdminOrInstructor && options ? (
                                <Popover open={memberSearchOpen} onOpenChange={setMemberSearchOpen}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={memberSearchOpen}
                                      className="w-full justify-between border-border/50 bg-background hover:bg-accent/50 transition-colors h-10"
                                    >
                                      {watch("user_id") ? (
                                        (() => {
                                          const selectedMember = options.members.find(m => m.id === watch("user_id"))
                                          return selectedMember
                                            ? [selectedMember.first_name, selectedMember.last_name].filter(Boolean).join(" ") || selectedMember.email
                                            : "Select Member"
                                        })()
                                      ) : (
                                        "Select Member"
                                      )}
                                      <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Search members..." />
                                      <CommandList className="max-h-[300px]">
                                        <CommandEmpty>No members found.</CommandEmpty>
                                        <CommandGroup>
                                          <CommandItem
                                            value="none"
                                            onSelect={() => {
                                              setValue("user_id", null, { shouldDirty: true })
                                              setMemberSearchOpen(false)
                                            }}
                                          >
                                            No member selected
                                          </CommandItem>
                                          {options.members.map((member) => {
                                            const displayName = [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email
                                            return (
                                              <CommandItem
                                                key={member.id}
                                                value={`${displayName} ${member.email}`}
                                                onSelect={() => {
                                                  setValue("user_id", member.id, { shouldDirty: true })
                                                  setMemberSearchOpen(false)
                                                }}
                                              >
                                                {displayName}
                                                {member.email && (
                                                  <span className="ml-2 text-xs text-muted-foreground">
                                                    ({member.email})
                                                  </span>
                                                )}
                                              </CommandItem>
                                            )
                                          })}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <div className="px-3 py-2.5 border border-border/50 rounded-md bg-muted/30 text-sm font-medium">
                                  {studentName}
                                </div>
                              )}
                            </Field>

                            <Field>
                              <FieldLabel className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <IconSchool className="h-4 w-4 text-foreground" />
                                Instructor
                              </FieldLabel>
                              {isAdminOrInstructor && options ? (
                                <Select
                                  value={watch("instructor_id") || "none"}
                                  onValueChange={(value) => setValue("instructor_id", value === "none" ? null : value, { shouldDirty: true })}
                                >
                                  <SelectTrigger className="w-full border-border/50 bg-background hover:bg-accent/50 transition-colors">
                                    <SelectValue placeholder="Select Instructor" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No instructor</SelectItem>
                                    {options.instructors.map((instructor) => {
                                      const name = [instructor.first_name, instructor.last_name]
                                        .filter(Boolean)
                                        .join(" ") || instructor.user?.email || "Unknown"
                                      return (
                                        <SelectItem key={instructor.id} value={instructor.id}>
                                          {name}
                                        </SelectItem>
                                      )
                                    })}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="px-3 py-2.5 border border-border/50 rounded-md bg-muted/30 text-sm font-medium">
                                  {instructorName}
                                </div>
                              )}
                            </Field>

                            <Field>
                              <FieldLabel className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <IconPlane className="h-4 w-4 text-primary" />
                                Aircraft
                              </FieldLabel>
                              {options ? (
                                <Select
                                  value={watch("aircraft_id")}
                                  onValueChange={(value) => setValue("aircraft_id", value, { shouldDirty: true })}
                                >
                                  <SelectTrigger className="w-full border-border/50 bg-background hover:bg-accent/50 transition-colors">
                                    <SelectValue placeholder="Select Aircraft" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {options.aircraft.map((aircraft) => (
                                      <SelectItem key={aircraft.id} value={aircraft.id}>
                                        {aircraft.registration} - {aircraft.manufacturer} {aircraft.type} {aircraft.model && `(${aircraft.model})`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="px-3 py-2.5 border border-border/50 rounded-md bg-muted/30 text-sm font-medium">
                                  {booking.aircraft
                                    ? `${booking.aircraft.registration} - ${booking.aircraft.manufacturer} ${booking.aircraft.type}`
                                    : "—"}
                                </div>
                              )}
                            </Field>

                            <Field>
                              <FieldLabel className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <IconClock className="h-4 w-4 text-foreground" />
                                Flight Type
                              </FieldLabel>
                              {options ? (
                                <Select
                                  value={watch("flight_type_id") || "none"}
                                  onValueChange={(value) => setValue("flight_type_id", value === "none" ? null : value, { shouldDirty: true })}
                                >
                                  <SelectTrigger className="w-full border-border/50 bg-background hover:bg-accent/50 transition-colors">
                                    <SelectValue placeholder="Select Flight Type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No flight type</SelectItem>
                                    {options.flightTypes.map((ft) => (
                                      <SelectItem key={ft.id} value={ft.id}>
                                        {ft.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="px-3 py-2.5 border border-border/50 rounded-md bg-muted/30 text-sm font-medium">
                                  {booking.flight_type?.name || "—"}
                                </div>
                              )}
                            </Field>

                            <Field>
                              <FieldLabel className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <IconCalendar className="h-4 w-4 text-foreground" />
                                Booking Type
                              </FieldLabel>
                              <Select
                                value={watch("booking_type")}
                                onValueChange={(value) => setValue("booking_type", value as BookingType, { shouldDirty: true })}
                              >
                                <SelectTrigger className="w-full border-border/50 bg-background hover:bg-accent/50 transition-colors">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="flight">Flight</SelectItem>
                                  <SelectItem value="groundwork">Ground Work</SelectItem>
                                  <SelectItem value="maintenance">Maintenance</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </Field>

                            <Field>
                              <FieldLabel className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <IconBook className="h-4 w-4 text-foreground" />
                                Lesson
                              </FieldLabel>
                              {options ? (
                                <Select
                                  value={watch("lesson_id") || "none"}
                                  onValueChange={(value) => setValue("lesson_id", value === "none" ? null : value, { shouldDirty: true })}
                                >
                                  <SelectTrigger className="w-full border-border/50 bg-background hover:bg-accent/50 transition-colors">
                                    <SelectValue placeholder="Select Lesson" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No lesson selected</SelectItem>
                                    {options.lessons.map((lesson) => (
                                      <SelectItem key={lesson.id} value={lesson.id}>
                                        {lesson.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="px-3 py-2.5 border border-border/50 rounded-md bg-muted/30 text-sm font-medium">
                                  {booking.lesson_id ? "Lesson selected" : "No lesson selected"}
                                </div>
                              )}
                            </Field>

                            <Field>
                              <FieldLabel className="text-sm font-medium text-foreground">Description</FieldLabel>
                              <Textarea
                                {...register("purpose")}
                                placeholder="Enter booking description"
                                className="min-h-[100px] border-border/50 bg-background focus-visible:ring-primary/20"
                              />
                              {errors.purpose && (
                                <p className="text-sm text-destructive mt-1">{errors.purpose.message}</p>
                              )}
                            </Field>

                            <Field>
                              <FieldLabel className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <IconAlertTriangle className="h-4 w-4 text-foreground" />
                                Operational Remarks
                              </FieldLabel>
                              <Textarea
                                {...register("remarks")}
                                placeholder="Enter operational remarks or warnings"
                                className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 min-h-[100px] focus-visible:ring-amber-500/20"
                              />
                            </Field>
                          </div>
                        </FieldGroup>
                      </form>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: Resources */}
                <div className="space-y-6">
                  {/* Resources Card - Combined People and Aircraft */}
                  <Card className="shadow-sm border border-border/50 bg-card">
                    <CardHeader className="pb-5 border-b border-border/20">
                      <CardTitle className="text-xl font-bold text-foreground">
                        Resources
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      {/* People Section */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <IconUsers className="h-4 w-4 text-foreground" />
                          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">People</h3>
                        </div>
                        
                        {/* Member Card */}
                        <div className="bg-muted/30 rounded-lg border border-border/30 p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <IconUser className="h-4 w-4 text-foreground" />
                              <span className="text-sm font-medium text-foreground">Member</span>
                            </div>
                            <IconInfoCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <Badge variant="outline" className="text-xs font-semibold border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600">
                            Student
                          </Badge>
                          <div className="font-bold text-base text-foreground">{studentName}</div>
                          {booking.student?.email && (
                            <div className="text-sm text-muted-foreground">{booking.student.email}</div>
                          )}
                        </div>

                        {/* Solo Booking / Instructor Card */}
                        <div className="bg-muted/30 rounded-lg border border-border/30 p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <IconUser className="h-4 w-4 text-foreground" />
                            <span className="text-sm font-medium text-foreground">Solo Booking</span>
                          </div>
                          {instructorName !== "—" ? (
                            <>
                              <Badge variant="outline" className="text-xs font-semibold border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600">
                                Staff
                              </Badge>
                              <div className="font-bold text-base text-foreground">{instructorName}</div>
                              {booking.instructor?.user?.email && (
                                <div className="text-sm text-muted-foreground">{booking.instructor.user.email}</div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-muted-foreground">No instructor assigned</div>
                          )}
                        </div>
                      </div>

                      {/* Aircraft Section */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <IconPlane className="h-4 w-4 text-foreground" />
                          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Aircraft</h3>
                        </div>
                        
                        {booking.aircraft ? (
                          <div className="bg-muted/30 rounded-lg border border-border/30 p-4 space-y-2">
                            <div className="flex items-center gap-2">
                              <IconPlane className="h-4 w-4 text-foreground" />
                              <div className="font-bold text-base text-foreground">
                                {booking.aircraft.registration} ({booking.aircraft.type})
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {booking.aircraft.manufacturer}{booking.aircraft.model ? `, ${booking.aircraft.model}` : ''}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-muted/30 rounded-lg border border-border/30 p-4">
                            <div className="text-sm text-muted-foreground">No aircraft assigned</div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Audit Log - Table Format at Bottom */}
              <Card className="shadow-sm border border-border/40 bg-card mt-8">
                <CardHeader className="pb-2 sm:pb-3 border-b border-border/20">
                  <button
                    type="button"
                    onClick={() => setAuditLogOpen(!auditLogOpen)}
                    className="flex items-center gap-2 w-full text-left"
                  >
                    <IconChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-foreground transition-transform ${auditLogOpen ? '' : '-rotate-90'}`} />
                    <CardTitle className="text-base sm:text-lg font-semibold text-foreground">
                      Booking History
                    </CardTitle>
                  </button>
                </CardHeader>
                {auditLogOpen && (
                  <CardContent className="pt-3 sm:pt-4 px-0 sm:px-6">
                    {auditLogs.length === 0 ? (
                      <div className="text-center py-6 sm:py-8 px-4">
                        <p className="text-xs sm:text-sm text-muted-foreground">No history available</p>
                        <p className="text-xs text-muted-foreground mt-1">Changes to this booking will appear here</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border/30">
                              <th className="text-left py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-foreground">Date</th>
                              <th className="text-left py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-foreground">User</th>
                              <th className="text-left py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-foreground">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {auditLogs.map((log) => {
                              const userName = log.user
                                ? [log.user.first_name, log.user.last_name].filter(Boolean).join(" ") || log.user.email
                                : "Unknown"
                              const logDate = new Date(log.created_at)
                              const formattedDate = logDate.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                              const formattedTime = logDate.toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })
                              
                              return (
                                <tr key={log.id} className="border-b border-border/20 last:border-0">
                                  <td className="py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm text-foreground whitespace-nowrap">
                                    <span className="hidden sm:inline">{formattedDate}, {formattedTime}</span>
                                    <span className="sm:hidden">{formattedDate}<br />{formattedTime}</span>
                                  </td>
                                  <td className="py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm text-foreground">
                                    {userName}
                                  </td>
                                  <td className="py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm text-foreground">
                                    {formatAuditDescription(log)}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
