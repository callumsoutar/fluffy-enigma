"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  IconCalendar,
  IconClock,
  IconPlane,
  IconUser,
  IconSchool,
  IconArrowLeft,
  IconAlertTriangle,
  IconDeviceFloppy,
  IconRotateClockwise,
  IconChevronDown,
  IconUsers,
  IconBook,
  IconDotsVertical,
  IconTrash,
  IconCheck

} from "@tabler/icons-react"
import { toast } from "sonner"
import Link from "next/link"
import { cn } from "@/lib/utils"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { BookingHeader } from "@/components/bookings/booking-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "@/components/ui/drawer"
import { CancelBookingModal } from "@/components/bookings/cancel-booking-modal"

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
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronDownIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { BookingWithRelations, BookingStatus, BookingType } from "@/lib/types/bookings"
import { useAuth } from "@/contexts/auth-context"
import { useIsMobile } from "@/hooks/use-mobile"

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    let message = "Request failed"
    try {
      const data = await res.json()
      if (typeof data?.error === "string") message = data.error
      // Surface validation details when present (Zod issues from API routes)
      if (Array.isArray(data?.details) && data.details.length > 0) {
        const first = data.details[0]
        const path = Array.isArray(first?.path) ? first.path.join(".") : undefined
        const issue = typeof first?.message === "string" ? first.message : undefined
        if (issue) message = path ? `${message}: ${path} — ${issue}` : `${message}: ${issue}`
      }
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
  flightTypes: Array<{ id: string; name: string; instruction_type: 'trial' | 'dual' | 'solo' | null }>
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

function getStatusBadgeStyles(status: BookingStatus): string {
  switch (status) {
    case "complete":
      return "bg-green-600 text-white border-green-700 hover:bg-green-700"
    case "flying":
      return "bg-orange-500 text-white border-orange-600 hover:bg-orange-600"
    case "confirmed":
      return "bg-blue-600 text-white border-blue-700 hover:bg-blue-700"
    case "unconfirmed":
      return "bg-amber-500 text-white border-amber-600 hover:bg-amber-600"
    case "briefing":
      return "bg-purple-600 text-white border-purple-700 hover:bg-purple-700"
    case "cancelled":
      return "bg-red-600 text-white border-red-700 hover:bg-red-700"
    default:
      return ""
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
  const router = useRouter()
  const { role } = useAuth()
  const bookingId = params.id as string
  const isMobile = useIsMobile()
  
  // Track sidebar state for banner positioning
  const [sidebarLeft, setSidebarLeft] = React.useState(0)
  
  React.useEffect(() => {
    if (isMobile) {
      setSidebarLeft(0)
      return
    }

    const updateSidebarPosition = () => {
      // Find the sidebar gap element which shows the actual sidebar width
      const sidebarGap = document.querySelector('[data-slot="sidebar-gap"]')
      if (sidebarGap) {
        const computedWidth = window.getComputedStyle(sidebarGap).width
        const width = parseFloat(computedWidth) || 0
        setSidebarLeft(width)
        return
      }

      // Fallback: Check sidebar state from data attributes
      const sidebar = document.querySelector('[data-slot="sidebar"]')
      if (!sidebar) {
        setSidebarLeft(0)
        return
      }

      const state = sidebar.getAttribute('data-state')
      const collapsible = sidebar.getAttribute('data-collapsible')
      
      // Calculate left offset based on sidebar state
      if (state === 'collapsed') {
        if (collapsible === 'icon') {
          // Icon mode: use icon width (3rem = 48px)
          setSidebarLeft(48)
        } else {
          // Offcanvas mode: sidebar is hidden
          setSidebarLeft(0)
        }
      } else {
        // Expanded: get actual width from CSS variable or computed style
        const sidebarContainer = sidebar.querySelector('[data-slot="sidebar-container"]')
        if (sidebarContainer) {
          const computedWidth = window.getComputedStyle(sidebarContainer).width
          const width = parseFloat(computedWidth) || 256
          setSidebarLeft(width)
        } else {
          setSidebarLeft(256) // Fallback
        }
      }
    }

    // Initial check with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(updateSidebarPosition, 100)

    // Watch for changes using MutationObserver
    const observer = new MutationObserver(updateSidebarPosition)
    const sidebarWrapper = document.querySelector('[data-slot="sidebar-wrapper"]')
    if (sidebarWrapper) {
      observer.observe(sidebarWrapper, {
        attributes: true,
        attributeFilter: ['data-state', 'data-collapsible'],
        subtree: true,
        childList: true,
        attributeOldValue: false
      })
    }

    // Also listen for resize in case sidebar width changes
    window.addEventListener('resize', updateSidebarPosition)
    // Listen for transition end in case sidebar is animating
    window.addEventListener('transitionend', updateSidebarPosition)

    return () => {
      clearTimeout(timeoutId)
      observer.disconnect()
      window.removeEventListener('resize', updateSidebarPosition)
      window.removeEventListener('transitionend', updateSidebarPosition)
    }
  }, [isMobile])

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
  const [isFormReady, setIsFormReady] = React.useState(false)
  const hasChanges = isFormReady && isDirty

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
    // IMPORTANT: keep timezone info (Z) so server validation (isoInstantSchema) passes.
    return combined.toISOString()
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
  const [cancelModalOpen, setCancelModalOpen] = React.useState(false)

  // Populate form when booking loads/changes (query-cached)
  React.useEffect(() => {
    if (!booking) return
    // If the user has unsaved edits, don't clobber the form due to background query updates.
    if (isFormReady && isDirty) return
    setIsFormReady(false)
    
    const start = parseDateTime(booking.start_time)
    const end = parseDateTime(booking.end_time)
    
    setStartDate(start.date)
    setStartTime(start.time)
    setEndDate(end.date)
    setEndTime(end.time)
    
      reset({
        start_time: booking.start_time ? new Date(booking.start_time).toISOString() : "",
        end_time: booking.end_time ? new Date(booking.end_time).toISOString() : "",
        aircraft_id: booking.aircraft_id || "",
        user_id: booking.user_id || null,
        instructor_id: booking.instructor_id || null,
        flight_type_id: booking.flight_type_id || null,
        lesson_id: booking.lesson_id || null,
        booking_type: booking.booking_type,
        purpose: booking.purpose || "",
        remarks: booking.remarks || null,
      })
    setIsFormReady(true)
  }, [booking, reset, isFormReady, isDirty])

  // Clear aircraft when booking type is changed to "groundwork"
  // Note: This is handled directly in the onValueChange handler for better UX,
  // but kept as a safeguard useEffect for programmatic changes
  const bookingType = watch("booking_type")
  const aircraftId = watch("aircraft_id")
  React.useEffect(() => {
    if (!isFormReady) return // Don't clear during initial hydration/reset
    if (bookingType === "groundwork" && aircraftId) {
      // Safeguard for programmatic changes: keep the form consistent without creating "fake" user edits.
      setValue("aircraft_id", "", { shouldDirty: false, shouldValidate: true })
    }
  }, [isFormReady, bookingType, aircraftId, setValue])

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
        start_time: result.booking.start_time ? new Date(result.booking.start_time).toISOString() : "",
        end_time: result.booking.end_time ? new Date(result.booking.end_time).toISOString() : "",
        aircraft_id: result.booking.aircraft_id || "",
        user_id: result.booking.user_id || null,
        instructor_id: result.booking.instructor_id || null,
        flight_type_id: result.booking.flight_type_id || null,
        lesson_id: result.booking.lesson_id || null,
        booking_type: result.booking.booking_type,
        purpose: result.booking.purpose || "",
        remarks: result.booking.remarks || null,
      })
      setIsFormReady(true)
      toast.success("Booking updated successfully")
      await queryClient.invalidateQueries({ queryKey: ["bookingAudit", bookingId] })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  const onSubmit = (data: BookingFormData) => {
    if (isReadOnly) return
    updateMutation.mutate(data)
  }

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
    // Route to checkout page instead of just updating status
    router.push(`/bookings/${bookingId}/checkout`)
  }

  const handleCheckFlightIn = () => {
    if (!booking) return
    // Route to check-in page instead of just updating status
    router.push(`/bookings/${bookingId}/checkin`)
  }

  const handleUndo = () => {
    if (booking) {
      const start = parseDateTime(booking.start_time)
      const end = parseDateTime(booking.end_time)
      
      setIsFormReady(false)
      setStartDate(start.date)
      setStartTime(start.time)
      setEndDate(end.date)
      setEndTime(end.time)
      
      reset({
        start_time: booking.start_time ? new Date(booking.start_time).toISOString() : '',
        end_time: booking.end_time ? new Date(booking.end_time).toISOString() : '',
        aircraft_id: booking.aircraft_id || '',
        user_id: booking.user_id || null,
        instructor_id: booking.instructor_id || null,
        flight_type_id: booking.flight_type_id || null,
        lesson_id: booking.lesson_id || null,
        booking_type: booking.booking_type,
        purpose: booking.purpose || '',
        remarks: booking.remarks || null,
      })
      setIsFormReady(true)
      
      toast.info('Changes reverted')
    }
  }

  const isAdminOrInstructor = role === 'owner' || role === 'admin' || role === 'instructor'
  const isMemberOrStudent = role === "member" || role === "student"
  const isComplete = booking?.status === 'complete'
  const isCancelled = booking?.status === 'cancelled'
  const isReadOnly = isComplete || isCancelled

  const isLoading = bookingQuery.isLoading || optionsQuery.isLoading || auditQuery.isLoading
  const isError = bookingQuery.isError

  // When default values are async, avoid rendering the form before `reset()` runs.
  // This prevents controlled Selects from briefly mounting with `undefined` values (mobile Safari especially).
  const isHydratingForm = !!booking && !isFormReady

  if (isLoading || isHydratingForm) {
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
            {/* Mobile Skeleton */}
            {isMobile ? (
              <div className="flex flex-col bg-background min-h-screen">
                {/* Header Section Skeleton */}
                <div className="bg-background border-b border-border/40">
                  <div className="px-6 pt-8 pb-8">
                    {/* Back Button & Status Badge */}
                    <div className="flex items-center justify-between mb-6">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                    
                    {/* Booking Number & Aircraft */}
                    <div className="space-y-3 mb-6">
                      <Skeleton className="h-8 w-48" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-5 w-32" />
                      </div>
                    </div>

                    {/* Schedule Section */}
                    <div className="mt-6 pt-4 border-t border-border/20 space-y-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-6 w-40" />
                      <Skeleton className="h-8 w-56" />
                    </div>
                  </div>
                </div>

                {/* Additional Details Section Skeleton */}
                <div className="px-4 mt-6 space-y-6 pb-6">
                  <Skeleton className="h-4 w-36 px-2" />
                  
                  {/* Aircraft & Flight Type Card Skeleton */}
                  <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                    <div className="p-5 flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-5 w-5 rounded" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <Skeleton className="h-8 w-24 ml-auto" />
                        <Skeleton className="h-3 w-32 ml-auto" />
                      </div>
                    </div>
                    <div className="h-[1px] bg-border mx-5" />
                    <div className="p-5 flex justify-between items-end">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-5 w-5 rounded" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-5 w-28" />
                    </div>
                  </div>

                  {/* Participants Card Skeleton */}
                  <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
                    <div className="flex justify-between items-start mb-6">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-5 w-5 rounded" />
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-9 w-9 rounded-full" />
                          <div className="space-y-1.5">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-border/50">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-9 w-9 rounded-full" />
                            <div className="space-y-1.5">
                              <Skeleton className="h-3 w-20" />
                              <Skeleton className="h-4 w-32" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reservation Details Card Skeleton */}
                  <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-5 w-48" />
                      </div>
                      <Skeleton className="h-5 w-5 rounded" />
                    </div>
                  </div>

                  {/* Form Section Skeleton */}
                  <div className="pt-6 space-y-6">
                    {/* Participants Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-1.5 px-1">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <div className="space-y-2.5">
                        <div className="p-3.5 bg-white dark:bg-gray-900 rounded-xl border border-border/60 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3.5">
                              <Skeleton className="h-9 w-9 rounded-full" />
                              <div className="space-y-1.5">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-4 w-32" />
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Skeleton className="h-8.5 w-8.5 rounded-lg" />
                              <Skeleton className="h-8.5 w-8.5 rounded-lg" />
                            </div>
                          </div>
                        </div>
                        <div className="p-3.5 bg-white dark:bg-gray-900 rounded-xl border border-border/60 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3.5">
                              <Skeleton className="h-9 w-9 rounded-full" />
                              <div className="space-y-1.5">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-4 w-32" />
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Skeleton className="h-8.5 w-8.5 rounded-lg" />
                              <Skeleton className="h-8.5 w-8.5 rounded-lg" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Scheduled Times Card Skeleton */}
                    <div className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-xl">
                      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-4 rounded" />
                          <Skeleton className="h-5 w-32" />
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-10 w-full rounded-md" />
                        </div>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-10 w-full rounded-md" />
                        </div>
                      </div>
                    </div>

                    {/* Additional Form Fields Skeleton */}
                    <div className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-xl">
                      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                        <Skeleton className="h-5 w-40" />
                      </div>
                      <div className="p-4 space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-full rounded-md" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Desktop Skeleton */
              <div className="flex flex-1 flex-col p-6 lg:p-8">
                <div className="max-w-7xl mx-auto w-full">
                  {/* Header Section */}
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-64" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    </div>
                    <Skeleton className="h-9 w-24 rounded-md" />
                  </div>

                  {/* Main Content Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Form */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* Date & Time Card */}
                      <Card className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-xl">
                        <CardHeader className="pb-4 border-b border-gray-200 dark:border-gray-800">
                          <Skeleton className="h-5 w-32" />
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-10 w-full rounded-md" />
                            </div>
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-10 w-full rounded-md" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-10 w-full rounded-md" />
                            </div>
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-10 w-full rounded-md" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Booking Details Card */}
                      <Card className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-xl">
                        <CardHeader className="pb-4 border-b border-gray-200 dark:border-gray-800">
                          <Skeleton className="h-5 w-40" />
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                          {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-10 w-full rounded-md" />
                            </div>
                          ))}
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-24 w-full rounded-md" />
                          </div>
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-24 w-full rounded-md" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Right Column - Status & Actions */}
                    <div className="space-y-6">
                      {/* Status Card */}
                      <Card className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-xl">
                        <CardHeader className="pb-4 border-b border-gray-200 dark:border-gray-800">
                          <Skeleton className="h-5 w-32" />
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                          <Skeleton className="h-6 w-24 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-full" />
                          </div>
                        </CardContent>
                      </Card>

                      {/* Actions Card */}
                      <Card className="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-xl">
                        <CardHeader className="pb-4 border-b border-gray-200 dark:border-gray-800">
                          <Skeleton className="h-5 w-24" />
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3">
                          <Skeleton className="h-10 w-full rounded-md" />
                          <Skeleton className="h-10 w-full rounded-md" />
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </div>
            )}
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

  const bookingInstructorId = booking?.instructor_id ?? null
  const bookingFlightTypeId = booking?.flight_type_id ?? null
  const bookingLessonId = booking?.lesson_id ?? null

  const bookingInstructorLabel = instructorName
  const bookingFlightTypeLabel = booking.flight_type?.name || "—"
  const bookingLessonLabel = booking.lesson?.name || "—"

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—"
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const headerActions = isAdminOrInstructor && (
    <div className="flex items-center gap-2 sm:gap-3">
      {booking.status === 'unconfirmed' && (
        <Button 
          size="sm" 
          className="bg-green-600 hover:bg-green-700 text-white shadow-sm h-9 px-4"
          onClick={handleConfirmBooking}
          disabled={statusUpdateMutation.isPending}
        >
          <IconCheck className="h-4 w-4 mr-2" />
          {statusUpdateMutation.isPending ? "Confirming..." : "Confirm Booking"}
        </Button>
      )}
      {booking.status === 'confirmed' && (
        <Button 
          size="sm" 
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all h-9 px-4"
          onClick={handleCheckFlightOut}
          disabled={statusUpdateMutation.isPending}
        >
          <IconPlane className="h-4 w-4 mr-2" />
          {statusUpdateMutation.isPending ? "Checking Out..." : "Check Out"}
        </Button>
      )}
      {booking.status === 'flying' && (
        <Button 
          size="sm" 
          className="bg-green-600 hover:bg-green-700 text-white shadow-sm h-9 px-4"
          onClick={handleCheckFlightIn}
          disabled={statusUpdateMutation.isPending}
        >
          <IconCheck className="h-4 w-4 mr-2" />
          {statusUpdateMutation.isPending ? "Checking In..." : "Check In"}
        </Button>
      )}
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="gap-2 bg-white hover:bg-gray-50 border-gray-300 text-gray-700 font-medium h-9 w-full sm:w-auto px-4"
          >
            Quick Actions
            <IconChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end"
          className="w-56"
        >
          <DropdownMenuItem 
            onClick={() => {
              if (booking?.cancelled_at) {
                toast.info("This booking is already cancelled")
                return
              }
              setCancelModalOpen(true)
            }}
            disabled={!!booking?.cancelled_at || isReadOnly}
            className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
          >
            <IconTrash className="h-4 w-4 mr-2" />
            Cancel Booking
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const primaryMobileAction = (() => {
    if (!isAdminOrInstructor || isReadOnly) return null
    if (booking.status === "unconfirmed") {
      return {
        label: statusUpdateMutation.isPending ? "Confirming..." : "Confirm Booking",
        onClick: handleConfirmBooking,
        icon: IconCheck,
        isPending: statusUpdateMutation.isPending,
        tone: "success" as const,
      }
    }
    if (booking.status === "confirmed") {
      return {
        label: statusUpdateMutation.isPending ? "Checking Out..." : "Check Out",
        onClick: handleCheckFlightOut,
        icon: IconPlane,
        isPending: statusUpdateMutation.isPending,
        tone: "primary" as const,
      }
    }
    if (booking.status === "flying") {
      return {
        label: statusUpdateMutation.isPending ? "Checking In..." : "Check In",
        onClick: handleCheckFlightIn,
        icon: IconCheck,
        isPending: statusUpdateMutation.isPending,
        tone: "success" as const,
      }
    }
    return null
  })()

  const hasSecondaryMobileActions = isAdminOrInstructor && !isReadOnly
  const showMobileActionBanner =
    isMobile && !hasChanges && (primaryMobileAction || hasSecondaryMobileActions)
  const mobileActionBarHeight = showMobileActionBanner ? 60 : 0
  const mobileSaveBarHeight = hasChanges && !isReadOnly ? 176 : 0
  const mobileContentPadding = isMobile
    ? Math.max(112, mobileActionBarHeight + mobileSaveBarHeight + 32)
    : undefined

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
          {/* Consolidated Header Section */}
          {!isMobile ? (
            <BookingHeader
              booking={booking}
              title={studentName}
              backHref="/bookings"
              backLabel="Back to Bookings"
              actions={headerActions}
            />
          ) : (
            <div className="border-b border-border/40 bg-background">
              <div className="mx-auto max-w-7xl px-4 pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <Link
                    href="/bookings"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <IconArrowLeft className="h-3.5 w-3.5" />
                    Back to Bookings
                  </Link>
                  <Badge
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border-none shadow-sm",
                      getStatusBadgeStyles(booking.status),
                      booking.status === "flying" && "animate-pulse"
                    )}
                  >
                    {booking.status === "flying" && <IconPlane className="h-3 w-3 mr-1.5 inline" />}
                    {getStatusLabel(booking.status)}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <h1 className="text-lg font-semibold text-foreground truncate">{studentName}</h1>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(booking.start_time)}
                  </span>
                </div>
              </div>
            </div>
          )}

            {/* Main Content with Generous Padding */}
          <div
            className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-28"
            style={
              isMobile
                ? {
                    paddingBottom: `calc(${mobileContentPadding}px + env(safe-area-inset-bottom, 0px))`,
                  }
                : undefined
            }
          >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Left Column: Booking Details */}
                <div className="lg:col-span-2 space-y-6">
                  <Card className="shadow-sm border border-border/50 bg-card">
                    <CardHeader className="pb-6 border-b border-border/20">
                      <CardTitle className="flex items-center gap-3 text-2xl font-bold text-foreground">
                        <IconCalendar className="h-6 w-6 text-foreground" />
                        {isReadOnly ? "Booking Details" : "Edit Booking Details"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <form onSubmit={handleSubmit(onSubmit)}>
                        <FieldGroup className="space-y-6">
                          {/* Scheduled Times */}
                          <div className="space-y-4 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                            <div className="flex items-center gap-3 mb-5">
                              <IconClock className="h-4 w-4 text-foreground" />
                              <h3 className="font-bold text-sm uppercase tracking-wider text-foreground">Scheduled Times</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                              <Field>
                                <FieldLabel className="text-sm font-semibold text-foreground mb-2">Start Time</FieldLabel>
                                <div className="flex gap-3 items-end">
                                  <div className="flex-1">
                                    <Popover open={openStartDate} onOpenChange={setOpenStartDate}>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          disabled={isReadOnly}
                                          className="w-full justify-between font-normal border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 h-10"
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
                                            const nextStartIso = date && startTime ? combineDateTime(date, startTime) : ""
                                            setValue("start_time", nextStartIso, { shouldDirty: true, shouldValidate: true })
                                            if (date && !endDate && endTime) {
                                              setValue("end_time", combineDateTime(date, endTime), { shouldDirty: true, shouldValidate: true })
                                            }
                                          }}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <div className="w-32">
                                    <Select
                                      value={startTime || "none"}
                                      onValueChange={(value) => {
                                        const next = value === "none" ? "" : value
                                        setStartTime(next)
                                        const nextStartIso = startDate && next ? combineDateTime(startDate, next) : ""
                                        setValue("start_time", nextStartIso, { shouldDirty: true, shouldValidate: true })
                                      }}
                                      disabled={isReadOnly}
                                    >
                                      <SelectTrigger className="w-full border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 h-10">
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
                                          disabled={isReadOnly}
                                          className="w-full justify-between font-normal border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 h-10"
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
                                            const nextEndIso = date && endTime ? combineDateTime(date, endTime) : ""
                                            setValue("end_time", nextEndIso, { shouldDirty: true, shouldValidate: true })
                                          }}
                                          disabled={startDate ? { before: startDate } : undefined}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <div className="w-32">
                                    <Select
                                      value={endTime || "none"}
                                      onValueChange={(value) => {
                                        const next = value === "none" ? "" : value
                                        setEndTime(next)
                                        const dateForEnd = endDate ?? startDate
                                        if (!endDate && dateForEnd) setEndDate(dateForEnd)
                                        const nextEndIso = dateForEnd && next ? combineDateTime(dateForEnd, next) : ""
                                        setValue("end_time", nextEndIso, { shouldDirty: true, shouldValidate: true })
                                      }}
                                      disabled={isReadOnly}
                                    >
                                      <SelectTrigger className="w-full border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 h-10">
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
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                      disabled={isReadOnly}
                                      aria-expanded={memberSearchOpen}
                                      className="w-full justify-between border-border/50 bg-background hover:bg-accent/50 transition-colors h-10"
                                    >
                                      {(() => {
                                        const userId = watch("user_id")
                                        if (!userId) return "Select Member"
                                        const selectedMember = options.members.find(m => m.id === userId)
                                        return selectedMember
                                          ? [selectedMember.first_name, selectedMember.last_name].filter(Boolean).join(" ") || selectedMember.email
                                          : "Select Member"
                                      })()}
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
                                <div className="px-3 py-2.5 border border-border/50 rounded-md bg-muted/30 text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {studentName}
                                </div>
                              )}
                            </Field>

                            <Field>
                              <FieldLabel className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <IconSchool className="h-4 w-4 text-foreground" />
                                Instructor
                              </FieldLabel>
                              {options ? (
                                <Select
                                  value={watch("instructor_id") || "none"}
                                  onValueChange={(value) => setValue("instructor_id", value === "none" ? null : value, { shouldDirty: true })}
                                  disabled={isReadOnly}
                                >
                                  <SelectTrigger className="w-full border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <SelectValue placeholder="Select Instructor" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No instructor</SelectItem>
                                    {!!bookingInstructorId &&
                                      !!bookingInstructorLabel &&
                                      !options.instructors.some((i) => i.id === bookingInstructorId) && (
                                        <SelectItem value={bookingInstructorId}>
                                          {bookingInstructorLabel} (inactive)
                                        </SelectItem>
                                      )}
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
                                <div className="px-3 py-2.5 border border-border/50 rounded-md bg-muted/30 text-sm font-medium text-gray-900 dark:text-gray-100">
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
                                  disabled={isReadOnly}
                                >
                                  <SelectTrigger className="w-full border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
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
                                <div className="px-3 py-2.5 border border-border/50 rounded-md bg-muted/30 text-sm font-medium text-gray-900 dark:text-gray-100">
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
                                  disabled={isReadOnly || isMemberOrStudent}
                                >
                                  <SelectTrigger className="w-full border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <SelectValue placeholder="Select Flight Type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No flight type</SelectItem>
                                    {!!bookingFlightTypeId &&
                                      !!bookingFlightTypeLabel &&
                                      !options.flightTypes.some((ft) => ft.id === bookingFlightTypeId) && (
                                        <SelectItem value={bookingFlightTypeId}>
                                          {bookingFlightTypeLabel} (inactive)
                                        </SelectItem>
                                      )}
                                    {options.flightTypes.map((ft) => (
                                      <SelectItem key={ft.id} value={ft.id}>
                                        {ft.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="px-3 py-2.5 border border-border/50 rounded-md bg-muted/30 text-sm font-medium text-gray-900 dark:text-gray-100">
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
                                onValueChange={(value) => {
                                  setValue("booking_type", value as BookingType, { shouldDirty: true })
                                  // Clear aircraft if changing to groundwork
                                  if (value === "groundwork" && watch("aircraft_id")) {
                                    setValue("aircraft_id", "", { shouldDirty: true })
                                  }
                                }}
                                disabled={isReadOnly}
                              >
                                <SelectTrigger className="w-full border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
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
                                  disabled={isReadOnly || isMemberOrStudent}
                                >
                                  <SelectTrigger className="w-full border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <SelectValue placeholder="Select Lesson" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No lesson selected</SelectItem>
                                    {!!bookingLessonId &&
                                      !!bookingLessonLabel &&
                                      !options.lessons.some((l) => l.id === bookingLessonId) && (
                                        <SelectItem value={bookingLessonId}>
                                          {bookingLessonLabel} (inactive)
                                        </SelectItem>
                                      )}
                                    {options.lessons.map((lesson) => (
                                      <SelectItem key={lesson.id} value={lesson.id}>
                                        {lesson.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="px-3 py-2.5 border border-border/50 rounded-md bg-muted/30 text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {booking.lesson_id ? "Lesson selected" : "No lesson selected"}
                                </div>
                              )}
                            </Field>

                            <Field>
                              <FieldLabel className="text-sm font-medium text-foreground">Description</FieldLabel>
                              <Textarea
                                {...register("purpose")}
                                disabled={isReadOnly}
                                placeholder="Enter booking description"
                                className="min-h-[100px] border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus-visible:ring-primary/20"
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
                                disabled={isReadOnly}
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
                <div className="space-y-6 lg:space-y-8">
                  {/* Resources Card - Combined People and Aircraft */}
                  <Card className="shadow-md border border-border/50 bg-card rounded-xl">
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
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-3 shadow-sm">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <IconUser className="h-4 w-4 text-foreground" />
                              <span className="text-sm font-medium text-foreground">Member</span>
                            </div>
                            <Badge variant="outline" className="text-xs font-semibold border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 shrink-0">
                              Student
                            </Badge>
                          </div>
                          <div className="font-bold text-base text-gray-900 dark:text-gray-100">{studentName}</div>
                          {booking.student?.email && (
                            <div className="text-sm text-gray-600 dark:text-gray-400">{booking.student.email}</div>
                          )}
                        </div>

                        {/* Instructor Card - Only render if instructor exists */}
                        {instructorName !== "—" && booking.instructor && (
                          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-3 shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <IconUser className="h-4 w-4 text-foreground" />
                                <span className="text-sm font-medium text-foreground">Instructor</span>
                              </div>
                              <Badge variant="outline" className="text-xs font-semibold border-gray-300 text-gray-700 dark:text-gray-300 dark:border-gray-600 shrink-0">
                                Staff
                              </Badge>
                            </div>
                            <div className="font-bold text-base text-gray-900 dark:text-gray-100">{instructorName}</div>
                            {booking.instructor?.user?.email && (
                              <div className="text-sm text-gray-600 dark:text-gray-400">{booking.instructor.user.email}</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Aircraft Section */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <IconPlane className="h-4 w-4 text-foreground" />
                          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Aircraft</h3>
                        </div>
                        
                        {booking.aircraft ? (
                          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-3 shadow-sm">
                            <div className="flex items-center gap-2">
                              <IconPlane className="h-4 w-4 text-foreground" />
                              <div className="font-bold text-base text-gray-900 dark:text-gray-100">
                                {booking.aircraft.registration} ({booking.aircraft.type})
                              </div>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {booking.aircraft.manufacturer}{booking.aircraft.model ? `, ${booking.aircraft.model}` : ''}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
                            <div className="text-sm text-gray-600 dark:text-gray-400">No aircraft assigned</div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Audit Log - Table Format at Bottom */}
              <Card className="shadow-md border border-border/50 bg-card rounded-xl mt-8">
                <CardHeader className="p-0 border-b border-border/20">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setAuditLogOpen(!auditLogOpen)}
                    className="flex items-center gap-2 w-full h-auto py-4 px-6 text-left hover:bg-muted/50 transition-all rounded-none"
                  >
                    <IconChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-foreground transition-transform ${auditLogOpen ? '' : '-rotate-90'}`} />
                    <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Booking History
                    </CardTitle>
                  </Button>
                </CardHeader>
                {auditLogOpen && (
                  <CardContent className="pt-3 sm:pt-4 px-0 sm:px-6">
                    {auditLogs.length === 0 ? (
                      <div className="text-center py-6 sm:py-8 px-4">
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">No history available</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Changes to this booking will appear here</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border/30">
                              <th className="text-left py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Date</th>
                              <th className="text-left py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">User</th>
                              <th className="text-left py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Description</th>
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
                                  <td className="py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                    <span className="hidden sm:inline">{formattedDate}, {formattedTime}</span>
                                    <span className="sm:hidden">{formattedDate}<br />{formattedTime}</span>
                                  </td>
                                  <td className="py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
                                    {userName}
                                  </td>
                                  <td className="py-1.5 sm:py-2 px-3 sm:px-4 text-xs sm:text-sm text-gray-900 dark:text-gray-100">
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
          
          {/* Mobile Bottom Action Banner */}
          {showMobileActionBanner && (
            <div
              className="fixed left-0 right-0 border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur shadow-[0_-8px_20px_rgba(0,0,0,0.08)] sm:hidden"
              role="banner"
              aria-label="Booking quick actions"
              style={{
                position: "fixed",
                bottom: 0,
                zIndex: 40,
                minHeight: "60px",
                paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
              }}
            >
              <div className="mx-auto max-w-7xl px-4 py-3">
                <div className={cn("flex items-center gap-3", primaryMobileAction ? "" : "justify-end")}>
                  {primaryMobileAction && (
                    <Button
                      size="lg"
                      onClick={primaryMobileAction.onClick}
                      disabled={primaryMobileAction.isPending}
                      className={cn(
                        "h-12 flex-1 font-semibold shadow-lg hover:shadow-xl transition-all",
                        primaryMobileAction.tone === "success" && "bg-green-600 hover:bg-green-700 text-white",
                        primaryMobileAction.tone === "primary" && "bg-primary hover:bg-primary/90 text-primary-foreground"
                      )}
                    >
                      <primaryMobileAction.icon className="h-4 w-4 mr-2" />
                      {primaryMobileAction.label}
                    </Button>
                  )}
                  {hasSecondaryMobileActions && (
                    isMobile ? (
                      <Drawer>
                        <DrawerTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 rounded-full border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                            aria-label="More booking actions"
                          >
                            <IconDotsVertical className="h-5 w-5" />
                          </Button>
                        </DrawerTrigger>
                        <DrawerContent>
                          <DrawerHeader>
                            <DrawerTitle>Booking actions</DrawerTitle>
                            <DrawerDescription>
                              Manage this booking.
                            </DrawerDescription>
                          </DrawerHeader>
                          <div className="px-4 pb-4 space-y-2">
                            <DrawerClose asChild>
                              <Button
                                variant="destructive"
                                className="w-full justify-start"
                                onClick={() => {
                                  if (booking?.cancelled_at) {
                                    toast.info("This booking is already cancelled")
                                    return
                                  }
                                  setCancelModalOpen(true)
                                }}
                                disabled={!!booking?.cancelled_at || isReadOnly}
                              >
                                <IconTrash className="h-4 w-4 mr-2" />
                                Cancel Booking
                              </Button>
                            </DrawerClose>
                            <DrawerClose asChild>
                              <Button variant="outline" className="w-full">
                                Close
                              </Button>
                            </DrawerClose>
                          </div>
                        </DrawerContent>
                      </Drawer>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 rounded-full border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                            aria-label="More booking actions"
                          >
                            <IconDotsVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem
                            onClick={() => {
                              if (booking?.cancelled_at) {
                                toast.info("This booking is already cancelled")
                                return
                              }
                              setCancelModalOpen(true)
                            }}
                            disabled={!!booking?.cancelled_at || isReadOnly}
                            className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                          >
                            <IconTrash className="h-4 w-4 mr-2" />
                            Cancel Booking
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sticky Bottom Bar - Save Changes */}
          {hasChanges && !isReadOnly && (
            <div 
              className="fixed bottom-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl"
              style={{ 
                position: 'fixed',
                bottom: isMobile && showMobileActionBanner
                  ? `calc(${mobileActionBarHeight}px + env(safe-area-inset-bottom, 0px))`
                  : 0,
                left: isMobile ? 0 : `${sidebarLeft}px`,
                right: 0,
                zIndex: 50
              }}
            >
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
                <div className={cn("flex items-center gap-4", isMobile ? "flex-col" : "justify-end")}>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleUndo}
                    disabled={updateMutation.isPending}
                    className={cn("h-12 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium", isMobile ? "w-full" : "px-8 min-w-[160px]")}
                  >
                    <IconRotateClockwise className="h-4 w-4 mr-2" />
                    Undo Changes
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleSubmit(onSubmit)}
                    disabled={updateMutation.isPending}
                    className={cn("bg-slate-700 hover:bg-slate-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all h-12", isMobile ? "w-full" : "px-8 min-w-[160px]")}
                  >
                    <IconDeviceFloppy className="h-4 w-4 mr-2" />
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
      <CancelBookingModal
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        booking={booking}
        onCancelled={() => {
          // Refresh booking data after cancellation
          queryClient.invalidateQueries({ queryKey: ["booking", bookingId] })
        }}
      />
    </SidebarProvider>
  )
}
