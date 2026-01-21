"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  IconClock,
  IconPlane,
  IconSchool,
  IconFileText,
  IconReportAnalytics,
  IconTarget,
  IconCloudStorm,
  IconCheck,
  IconX,
  IconNotebook,
  IconAlertCircle,
  IconMessage,
  IconTrophy,
  IconPlus,
  IconTrash,
  IconPencil,
  IconLoader2,
  IconChevronDown,
  IconEdit,
  IconInfoCircle,
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
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BookingHeader } from "@/components/bookings/booking-header"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { FlightCorrectionDialog } from "@/components/bookings/FlightCorrectionDialog"

import { useAuth } from "@/contexts/auth-context"
import { useFlightCorrection } from "@/hooks/useFlightCorrection"
import { useIsMobile } from "@/hooks/use-mobile"
import { useOrganizationTaxRate } from "@/hooks/use-tax-rate"
import type { BookingWithRelations } from "@/lib/types/bookings"
import type { Invoice } from "@/lib/types/invoices"
import type { InvoiceItem } from "@/lib/types/invoice_items"
import type { ExperienceType } from "@/lib/types/experience-types"
import type { ExperienceUnit } from "@/lib/types/flight-experience"
import { bookingUpdateSchema } from "@/lib/validation/bookings"
import { z } from "zod"
import { BookingStatusTracker } from "@/components/bookings/booking-status-tracker"
import { InvoiceCalculations, roundToTwoDecimals } from "@/lib/invoice-calculations"
import ChargeableSearchDropdown from "@/components/invoices/ChargeableSearchDropdown"
import InvoiceDocumentView, { type InvoicingSettings } from "@/components/invoices/InvoiceDocumentView"
import { IconChevronRight } from "@tabler/icons-react"

type FlightLogCheckinFormData = z.infer<typeof bookingUpdateSchema>

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

interface BookingOptions {
  aircraft: Array<{ id: string; registration: string; type: string; model: string | null; manufacturer: string | null }>
  members: Array<{ id: string; first_name: string | null; last_name: string | null; email: string }>
  instructors: Array<{ id: string; first_name: string | null; last_name: string | null; user: { id: string; email: string } | null }>
  flightTypes: Array<{ id: string; name: string; instruction_type: 'trial' | 'dual' | 'solo' | null }>
  lessons: Array<{ id: string; name: string; description: string | null }>
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  return "Request failed"
}

// Calculate flight hours from meter readings
function calculateFlightHours(start: number | null | undefined, end: number | null | undefined): number {
  if (start == null || end == null || isNaN(start) || isNaN(end) || end < start) return 0
  return parseFloat((end - start).toFixed(1))
}

type ChargeBasis = 'hobbs' | 'tacho' | 'airswitch'

type ChargeRate = {
  id: string
  rate_per_hour: number | string
  charge_hobbs: boolean
  charge_tacho: boolean
  charge_airswitch: boolean
}

type GeneratedInvoiceItem = {
  chargeable_id: string | null
  description: string
  quantity: number
  unit_price: number // tax-exclusive
  tax_rate: number | null
  notes?: string | null
}

type CalculatedInvoiceLine = GeneratedInvoiceItem & {
  amount: number
  tax_amount: number
  rate_inclusive: number
  line_total: number
}

function deriveChargeBasisFromFlags(rate: ChargeRate | null | undefined): ChargeBasis | null {
  if (!rate) return null
  // Prefer the canonical single-flag case, but tolerate bad data.
  if (rate.charge_hobbs && !rate.charge_tacho && !rate.charge_airswitch) return 'hobbs'
  if (rate.charge_tacho && !rate.charge_hobbs && !rate.charge_airswitch) return 'tacho'
  if (rate.charge_airswitch && !rate.charge_hobbs && !rate.charge_tacho) return 'airswitch'

  // Multiple flags (data issue): choose deterministic priority.
  if (rate.charge_hobbs) return 'hobbs'
  if (rate.charge_tacho) return 'tacho'
  if (rate.charge_airswitch) return 'airswitch'
  return null
}

export default function BookingCheckinPage() {
  const params = useParams()
  const router = useRouter()
  const { role } = useAuth()
  const bookingId = params.id as string
  const isMobile = useIsMobile()
  const isAdminOrInstructor = role === 'owner' || role === 'admin' || role === 'instructor'
  const [isPerformanceNotesExpanded, setIsPerformanceNotesExpanded] = React.useState(false)
  const [isExperienceExpanded, setIsExperienceExpanded] = React.useState(false)
  const [isCalculating, setIsCalculating] = React.useState(false)
  const [isDebriefOpen, setIsDebriefOpen] = React.useState(false)

  const billingRef = React.useRef<HTMLDivElement>(null)
  const invoiceRef = React.useRef<HTMLDivElement>(null)
  const debriefRef = React.useRef<HTMLDivElement>(null)
  const isFirstMount = React.useRef(true)
  const suppressNextDebriefScroll = React.useRef(false)

  const queryClient = useQueryClient()

  const { taxRate: organizationTaxRate } = useOrganizationTaxRate()
  const taxRate = organizationTaxRate ?? 0.15
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<FlightLogCheckinFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(bookingUpdateSchema) as any,
    mode: 'onChange',
    defaultValues: {},
  })

  // Watch key check-in fields (used for live calculations + rate fetching)
  const hobbsStart = watch("hobbs_start")
  const hobbsEnd = watch("hobbs_end")
  const tachStart = watch("tach_start")
  const tachEnd = watch("tach_end")
  const soloEndHobbs = watch("solo_end_hobbs")
  const soloEndTach = watch("solo_end_tach")

  // Calculate displayed flight hours
  const displayedHobbsHours = React.useMemo(() => calculateFlightHours(hobbsStart, hobbsEnd), [hobbsStart, hobbsEnd])
  const displayedTachHours = React.useMemo(() => calculateFlightHours(tachStart, tachEnd), [tachStart, tachEnd])

  // Local state
  
  // Use a ref to track if we're currently initializing
  const isInitializingRef = React.useRef(false)

  // We keep this for future UX (e.g. warning before leaving), but there is no "sticky save" UI.

  // Fetch booking
  const bookingQuery = useQuery({
    queryKey: ["booking", bookingId],
    enabled: !!bookingId,
    queryFn: () => fetchJson<{ booking: BookingWithRelations }>(`/api/bookings/${bookingId}`),
    staleTime: 30_000,
  })

  // Extract booking data (now contains all flight log fields)
  const booking = bookingQuery.data?.booking ?? null

  // Get lesson_id from booking for options query
  const selectedLessonId = booking?.lesson_id

  const optionsQuery = useQuery({
    queryKey: ["bookingOptions", selectedLessonId],
    queryFn: () => {
      const url = selectedLessonId 
        ? `/api/bookings/options?lesson_id=${selectedLessonId}`
        : `/api/bookings/options`
      return fetchJson<BookingOptions>(url)
    },
    staleTime: 15 * 60_000,
  })

  const options = optionsQuery.data ?? null

  // Approval is the immutable/locked state. A draft invoice may exist before approval.
  const isApproved = !!booking?.checkin_approved_at
  const checkinInvoiceId = booking?.checkin_invoice_id ?? null

  // State for collapsible sections
  const [isBillingCollapsed, setIsBillingCollapsed] = React.useState(isApproved)
  const [isInvoiceCollapsed, setIsInvoiceCollapsed] = React.useState(isApproved)

  // Flight correction hook (for approved bookings)
  const {
    isCorrectionDialogOpen,
    openCorrectionDialog,
    closeCorrectionDialog,
    correctFlight,
    isSubmitting: isCorrecting,
  } = useFlightCorrection({ bookingId })

  // Fetch invoice details if approved
  const invoiceQuery = useQuery({
    queryKey: ["invoice", checkinInvoiceId],
    queryFn: () => fetchJson<{ invoice: Invoice }>(`/api/invoices/${checkinInvoiceId}`),
    enabled: !!checkinInvoiceId,
  })

  const invoiceItemsQuery = useQuery({
    queryKey: ["invoice_items", checkinInvoiceId],
    queryFn: () => fetchJson<{ invoice_items: InvoiceItem[] }>(`/api/invoice_items?invoice_id=${checkinInvoiceId}`),
    enabled: !!checkinInvoiceId,
  })

  const invoiceSettingsQuery = useQuery({
    queryKey: ["settings", "invoicing-full"],
    queryFn: () => fetchJson<{ settings: InvoicingSettings }>("/api/settings/invoicing"),
  })
  const lessonProgressExists = React.useMemo(() => {
    const lp = booking?.lesson_progress
    if (!lp) return false
    return Array.isArray(lp) ? lp.length > 0 : true
  }, [booking?.lesson_progress])

  React.useEffect(() => {
    if (!lessonProgressExists) return
    // Auto-open the section for convenience, but don't auto-scroll on initial load.
    suppressNextDebriefScroll.current = true
    setIsDebriefOpen(true)
  }, [lessonProgressExists])

  React.useEffect(() => {
    if (!isApproved) return
    // Auto-open the section for convenience, but don't auto-scroll on initial load.
    suppressNextDebriefScroll.current = true
    setIsDebriefOpen(true)
  }, [isApproved])

  // Scroll to section when it opens
  React.useEffect(() => {
    if (isFirstMount.current) return

    if (!isBillingCollapsed) {
      setTimeout(() => {
        billingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [isBillingCollapsed])

  React.useEffect(() => {
    if (isFirstMount.current) return

    if (!isInvoiceCollapsed) {
      setTimeout(() => {
        invoiceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [isInvoiceCollapsed])

  React.useEffect(() => {
    if (isFirstMount.current) return

    if (suppressNextDebriefScroll.current) {
      suppressNextDebriefScroll.current = false
      return
    }

    if (isDebriefOpen) {
      setTimeout(() => {
        debriefRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [isDebriefOpen])

  // Mark mount complete *after* the initial effect pass so we don't auto-scroll on page load.
  React.useEffect(() => {
    isFirstMount.current = false
  }, [])

  type ExperienceEntryDraft = {
    experience_type_id: string
    value: string
    unit: ExperienceUnit
    notes?: string | null
    conditions?: string | null
  }

  const [experienceEntries, setExperienceEntries] = React.useState<ExperienceEntryDraft[]>([])
  const [experienceDirty, setExperienceDirty] = React.useState(false)

  const addExperienceEntry = () => {
    setExperienceEntries((prev) => [
      ...prev,
      { experience_type_id: "", value: "", unit: "hours" },
    ])
    setExperienceDirty(true)
  }

  const experienceTypesQuery = useQuery({
    queryKey: ['experienceTypes'],
    enabled: isAdminOrInstructor,
    queryFn: async () => {
      const res = await fetchJson<{ experience_types: ExperienceType[] }>('/api/experience-types')
      return res.experience_types || []
    },
    staleTime: 10 * 60_000,
  })

  const bookingExperienceQuery = useQuery({
    queryKey: ['bookingExperience', bookingId],
    enabled: isAdminOrInstructor && !!bookingId && (isApproved || lessonProgressExists),
    queryFn: async () => {
      return fetchJson<{ entries: Array<{ experience_type_id: string; value: number; unit: ExperienceUnit; notes: string | null; conditions: string | null }> }>(
        `/api/bookings/${bookingId}/experience`
      )
    },
  })

  React.useEffect(() => {
    // Reset experience state when navigating between bookings
    setExperienceEntries([])
    setExperienceDirty(false)
  }, [bookingId])

  React.useEffect(() => {
    if (!bookingExperienceQuery.data) return
    // Only hydrate when we haven't changed anything locally
    if (experienceDirty) return

    const entries = bookingExperienceQuery.data.entries || []
    setExperienceEntries(
      entries.map((e) => ({
        experience_type_id: e.experience_type_id,
        value: String(e.value ?? ''),
        unit: e.unit ?? 'hours',
        notes: e.notes ?? null,
        conditions: e.conditions ?? null,
      }))
    )
    setExperienceDirty(false)
  }, [bookingExperienceQuery.data, experienceDirty])

  const [draftCalculation, setDraftCalculation] = React.useState<null | {
    signature: string
    calculated_at: string
    billing_basis: ChargeBasis
    billing_hours: number
    dual_time: number
    solo_time: number
    items: GeneratedInvoiceItem[]
    lines: CalculatedInvoiceLine[]
    totals: { subtotal: number; tax_total: number; total_amount: number }
  }>(null)

  const [manualItems, setManualItems] = React.useState<GeneratedInvoiceItem[]>([])
  const [excludedGeneratedKeys, setExcludedGeneratedKeys] = React.useState<Set<string>>(new Set())
  const [editingIdx, setEditingIdx] = React.useState<number | null>(null)
  const [openDropdownIdx, setOpenDropdownIdx] = React.useState<number | null>(null)

  const selectedAircraftId =
    watch("checked_out_aircraft_id") ??
    booking?.checked_out_aircraft_id ??
    booking?.aircraft_id ??
    null

  const selectedInstructorId =
    watch("checked_out_instructor_id") ??
    booking?.checked_out_instructor_id ??
    booking?.instructor_id ??
    null

  const selectedFlightTypeId = watch("flight_type_id") ?? booking?.flight_type_id ?? null

  // If the current booking's selection is inactive (not returned by /api/bookings/options),
  // Radix Select will render an empty placeholder unless we include the selected item.
  const bookingInstructorId = booking?.checked_out_instructor_id ?? booking?.instructor_id ?? null
  const bookingInstructor = booking?.checked_out_instructor ?? booking?.instructor ?? null
  const bookingFlightTypeId = booking?.flight_type_id ?? null
  const bookingFlightType = booking?.flight_type ?? null

  const bookingInstructorLabel = React.useMemo(() => {
    if (!bookingInstructor) return null
    const first = bookingInstructor.first_name
    const last = bookingInstructor.last_name
    
    // Support both direct user object and legacy array format if it persists in some responses,
    // though BookingWithRelations defines it as an object.
    const user = (bookingInstructor as { user?: { email: string } | { email: string }[] }).user
    const email = Array.isArray(user) ? user[0]?.email : user?.email
    
    const full = [first, last].filter(Boolean).join(" ")
    return full || email || "Instructor"
  }, [bookingInstructor])

  const bookingFlightTypeLabel = React.useMemo(() => {
    if (!bookingFlightType) return null
    return bookingFlightType.name
  }, [bookingFlightType])

  const memberName = React.useMemo(() => {
    if (!booking?.student) return "Member"
    return [booking.student.first_name, booking.student.last_name].filter(Boolean).join(" ")
  }, [booking?.student])

  const aircraftReg = React.useMemo(() => {
    return booking?.checked_out_aircraft?.registration || booking?.aircraft?.registration || "Aircraft"
  }, [booking?.checked_out_aircraft, booking?.aircraft])

  const bookingDate = React.useMemo(() => {
    if (!booking?.start_time) return ""
    return new Date(booking.start_time).toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    })
  }, [booking?.start_time])

  const lessonName = booking?.lesson?.name || "Lesson"
  const syllabusName = booking?.lesson?.syllabus?.name

  const selectedFlightType = React.useMemo(() => {
    if (!selectedFlightTypeId) return null
    const fromOptions = options?.flightTypes?.find((ft) => ft.id === selectedFlightTypeId) ?? null
    return fromOptions ?? (booking?.flight_type ?? null)
  }, [selectedFlightTypeId, options?.flightTypes, booking?.flight_type])

  const instructionType = (selectedFlightType as { instruction_type?: 'trial' | 'dual' | 'solo' | null } | null)?.instruction_type ?? null

  const [hasSoloAtEnd, setHasSoloAtEnd] = React.useState(false)
  const [hasAttemptedCalculation, setHasAttemptedCalculation] = React.useState(false)
  const lastSoloInitKey = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!booking) return
    const key = `${booking.id}:${booking.solo_end_hobbs ?? '—'}:${booking.solo_end_tach ?? '—'}`
    if (lastSoloInitKey.current === key) return
    lastSoloInitKey.current = key
    setHasSoloAtEnd(!!booking.solo_end_hobbs || !!booking.solo_end_tach)
  }, [booking])

  // Solo bookings never need a solo-end input; clear any legacy values.
  React.useEffect(() => {
    if (isInitializingRef.current) return
    if (instructionType !== 'solo') return
    if (hasSoloAtEnd) setHasSoloAtEnd(false)
    if (soloEndHobbs != null) setValue("solo_end_hobbs", null, { shouldDirty: true })
    if (soloEndTach != null) setValue("solo_end_tach", null, { shouldDirty: true })
  }, [instructionType, hasSoloAtEnd, soloEndHobbs, soloEndTach, setValue])

  const aircraftChargeRateQuery = useQuery({
    queryKey: ["aircraftChargeRate", selectedAircraftId, selectedFlightTypeId],
    enabled: !!selectedAircraftId && !!selectedFlightTypeId,
    queryFn: async () =>
      fetchJson<{ charge_rate: ChargeRate }>(
        `/api/aircraft-charge-rates?aircraft_id=${selectedAircraftId}&flight_type_id=${selectedFlightTypeId}`
      ),
    staleTime: 5 * 60_000,
  })

  const instructorChargeRateQuery = useQuery({
    queryKey: ["instructorChargeRate", selectedInstructorId, selectedFlightTypeId],
    enabled: !!selectedInstructorId && !!selectedFlightTypeId,
    queryFn: async () =>
      fetchJson<{ charge_rate: ChargeRate }>(
        `/api/instructor-charge-rates?instructor_id=${selectedInstructorId}&flight_type_id=${selectedFlightTypeId}`
      ),
    staleTime: 5 * 60_000,
  })

  const aircraftChargeRate = aircraftChargeRateQuery.data?.charge_rate ?? null
  const instructorChargeRate = instructorChargeRateQuery.data?.charge_rate ?? null

  const aircraftBillingBasis = React.useMemo(
    () => deriveChargeBasisFromFlags(aircraftChargeRate),
    [aircraftChargeRate]
  )

  // Enforce "no irrelevant solo-end inputs" based on billing basis
  React.useEffect(() => {
    if (isInitializingRef.current) return
    if (!aircraftBillingBasis) return
    if (aircraftBillingBasis === 'hobbs') {
      if (soloEndTach != null) setValue("solo_end_tach", null, { shouldDirty: true })
      return
    }
    if (aircraftBillingBasis === 'tacho') {
      if (soloEndHobbs != null) setValue("solo_end_hobbs", null, { shouldDirty: true })
      return
    }
  }, [aircraftBillingBasis, soloEndHobbs, soloEndTach, setValue])

  // Total time uses the solo-end meter reading when a dual/trial flight ends with a solo portion.
  const hobbsTotalHours = React.useMemo(() => {
    const effectiveEnd =
      instructionType !== 'solo' && hasSoloAtEnd && aircraftBillingBasis === 'hobbs'
        ? soloEndHobbs
        : hobbsEnd
    return calculateFlightHours(hobbsStart, effectiveEnd)
  }, [hobbsStart, hobbsEnd, soloEndHobbs, hasSoloAtEnd, aircraftBillingBasis, instructionType])

  const tachTotalHours = React.useMemo(() => {
    const effectiveEnd =
      instructionType !== 'solo' && hasSoloAtEnd && aircraftBillingBasis === 'tacho'
        ? soloEndTach
        : tachEnd
    return calculateFlightHours(tachStart, effectiveEnd)
  }, [tachStart, tachEnd, soloEndTach, hasSoloAtEnd, aircraftBillingBasis, instructionType])

  const splitTimes = React.useMemo(() => {
    if (!aircraftBillingBasis || aircraftBillingBasis === 'airswitch') {
      return { total: 0, dual: 0, solo: 0, error: null as string | null }
    }

    if (instructionType === 'solo') {
      const total = aircraftBillingBasis === 'hobbs' ? hobbsTotalHours : tachTotalHours
      return { total, dual: 0, solo: total, error: null }
    }

    const basisStart = aircraftBillingBasis === 'hobbs' ? hobbsStart : tachStart
    const dualEnd = aircraftBillingBasis === 'hobbs' ? hobbsEnd : tachEnd
    const finalEnd = aircraftBillingBasis === 'hobbs'
      ? (hasSoloAtEnd ? soloEndHobbs : hobbsEnd)
      : (hasSoloAtEnd ? soloEndTach : tachEnd)

    if (hasSoloAtEnd) {
      if (basisStart == null || dualEnd == null || finalEnd == null) {
        return { total: 0, dual: 0, solo: 0, error: 'Solo split requires start, dual end, and solo end.' }
      }
      if (dualEnd < basisStart) return { total: 0, dual: 0, solo: 0, error: 'Dual end cannot be less than start.' }
      if (finalEnd < dualEnd) return { total: 0, dual: 0, solo: 0, error: 'Solo end cannot be less than dual end.' }

      const roundToTenth = (v: number) => parseFloat(v.toFixed(1))
      const dual = roundToTenth(dualEnd - basisStart)
      const solo = roundToTenth(finalEnd - dualEnd)
      const total = roundToTenth(dual + solo)
      return { total, dual, solo, error: null }
    }

    const total = aircraftBillingBasis === 'hobbs' ? hobbsTotalHours : tachTotalHours
    return { total, dual: total, solo: 0, error: null }
  }, [
    aircraftBillingBasis,
    instructionType,
    hasSoloAtEnd,
    hobbsStart,
    hobbsEnd,
    tachStart,
    tachEnd,
    soloEndHobbs,
    soloEndTach,
    hobbsTotalHours,
    tachTotalHours,
  ])

  const billingHours = React.useMemo(() => {
    if (!aircraftBillingBasis) return 0
    if (aircraftBillingBasis === 'hobbs') return hobbsTotalHours
    if (aircraftBillingBasis === 'tacho') return tachTotalHours
    // UI does not support airswitch inputs; treat as unsupported configuration.
    return 0
  }, [aircraftBillingBasis, hobbsTotalHours, tachTotalHours])

  const isAirswitchBillingUnsupported = aircraftBillingBasis === 'airswitch'

  const aircraftRatePerHourExclTax = React.useMemo(() => {
    if (!aircraftChargeRate) return null
    const v = typeof aircraftChargeRate.rate_per_hour === 'string'
      ? parseFloat(aircraftChargeRate.rate_per_hour)
      : aircraftChargeRate.rate_per_hour
    return Number.isFinite(v) ? v : null
  }, [aircraftChargeRate])

  const aircraftRatePerHourInclTax = React.useMemo(() => {
    if (aircraftRatePerHourExclTax == null) return null
    return roundToTwoDecimals(aircraftRatePerHourExclTax * (1 + taxRate))
  }, [aircraftRatePerHourExclTax, taxRate])

  const instructorRatePerHourExclTax = React.useMemo(() => {
    if (!instructorChargeRate) return null
    const v = typeof instructorChargeRate.rate_per_hour === 'string'
      ? parseFloat(instructorChargeRate.rate_per_hour)
      : instructorChargeRate.rate_per_hour
    return Number.isFinite(v) ? v : null
  }, [instructorChargeRate])

  const instructorRatePerHourInclTax = React.useMemo(() => {
    if (instructorRatePerHourExclTax == null) return null
    return roundToTwoDecimals(instructorRatePerHourExclTax * (1 + taxRate))
  }, [instructorRatePerHourExclTax, taxRate])

  // Build invoice items on-demand (called on Save Draft Check-In / Approve),
  // rather than dynamically recalculating totals while typing.
  const buildDraftInvoiceItems = React.useCallback((): GeneratedInvoiceItem[] => {
    if (!booking) return []
    if (!aircraftChargeRate) return []
    if (!aircraftBillingBasis) return []
    if (aircraftBillingBasis === 'airswitch') return []
    if (billingHours <= 0) return []

    const aircraftRate = typeof aircraftChargeRate.rate_per_hour === 'string'
      ? parseFloat(aircraftChargeRate.rate_per_hour)
      : aircraftChargeRate.rate_per_hour

    if (!Number.isFinite(aircraftRate) || aircraftRate <= 0) return []

    const aircraftReg =
      options?.aircraft?.find((a) => a.id === selectedAircraftId)?.registration ||
      booking.aircraft?.registration ||
      'Aircraft'

    const items: GeneratedInvoiceItem[] = [
      {
        chargeable_id: null,
        description: `Aircraft Hire (${aircraftReg})`,
        quantity: billingHours,
        unit_price: aircraftRate,
        tax_rate: taxRate,
        notes: `Booking ${booking.id}; basis=${aircraftBillingBasis}; total=${billingHours.toFixed(1)}h; dual=${splitTimes.dual.toFixed(1)}h; solo=${splitTimes.solo.toFixed(1)}h; hobbs=${hobbsStart ?? '—'}→${hobbsEnd ?? '—'}${soloEndHobbs != null ? `→${soloEndHobbs}` : ''}; tacho=${tachStart ?? '—'}→${tachEnd ?? '—'}${soloEndTach != null ? `→${soloEndTach}` : ''}`,
      },
    ]

    if (selectedInstructorId && instructorChargeRate) {
      const instructorBasis = deriveChargeBasisFromFlags(instructorChargeRate) || aircraftBillingBasis
      const instructorHours = (() => {
        if (instructionType === 'solo') return 0
        // Deterministic rule: when splitting dual+solo, avoid mixed time sources.
        // If bases differ, we cannot compute instructor dual time safely.
        if (hasSoloAtEnd && instructorBasis !== aircraftBillingBasis) return 0
        return splitTimes.dual
      })()

      if (instructorHours > 0) {
        const instructorRate = typeof instructorChargeRate.rate_per_hour === 'string'
          ? parseFloat(instructorChargeRate.rate_per_hour)
          : instructorChargeRate.rate_per_hour

        if (Number.isFinite(instructorRate) && instructorRate > 0) {
          const instructorFromOptions = options?.instructors?.find((i) => i.id === selectedInstructorId) ?? null
          const instructorDisplayName =
            (instructorFromOptions
              ? [instructorFromOptions.first_name, instructorFromOptions.last_name].filter(Boolean).join(" ") ||
                instructorFromOptions.user?.email ||
                "Instructor"
              : booking.checked_out_instructor?.user?.email || booking.instructor?.user?.email || "Instructor")

          items.push({
            chargeable_id: null,
            description: `Instructor Rate - (${instructorDisplayName})`,
            quantity: instructorHours,
            unit_price: instructorRate,
            tax_rate: taxRate,
            notes: `Booking ${booking.id}; basis=${instructorBasis}; instructor_id=${selectedInstructorId}; dual_time=${splitTimes.dual.toFixed(1)}h`,
          })
        }
      }
    }

    return items
  }, [
    booking,
    aircraftChargeRate,
    aircraftBillingBasis,
    billingHours,
    taxRate,
    hobbsStart,
    hobbsEnd,
    tachStart,
    tachEnd,
    soloEndHobbs,
    soloEndTach,
    splitTimes.dual,
    splitTimes.solo,
    instructionType,
    hasSoloAtEnd,
    selectedInstructorId,
    instructorChargeRate,
    selectedAircraftId,
    options?.aircraft,
    options?.instructors,
  ])

  const instructorBasisConflictForSoloSplit = React.useMemo(() => {
    if (!selectedInstructorId || !instructorChargeRate) return false
    if (!hasSoloAtEnd) return false
    if (!aircraftBillingBasis || aircraftBillingBasis === 'airswitch') return false
    const instructorBasis = deriveChargeBasisFromFlags(instructorChargeRate) || aircraftBillingBasis
    return instructorBasis !== aircraftBillingBasis
  }, [selectedInstructorId, instructorChargeRate, hasSoloAtEnd, aircraftBillingBasis])

  const draftSignature = React.useMemo(() => {
    return JSON.stringify({
      booking_id: booking?.id ?? null,
      checked_out_aircraft_id: selectedAircraftId,
      checked_out_instructor_id: selectedInstructorId,
      flight_type_id: selectedFlightTypeId,

      hobbs_start: hobbsStart ?? null,
      hobbs_end: hobbsEnd ?? null,
      tach_start: tachStart ?? null,
      tach_end: tachEnd ?? null,
      solo_end_hobbs: hasSoloAtEnd ? (soloEndHobbs ?? null) : null,
      solo_end_tach: hasSoloAtEnd ? (soloEndTach ?? null) : null,
      hasSoloAtEnd,
      instructionType,

      aircraft_charge_rate: aircraftChargeRate ? {
        id: aircraftChargeRate.id,
        rate_per_hour: aircraftChargeRate.rate_per_hour,
        charge_hobbs: aircraftChargeRate.charge_hobbs,
        charge_tacho: aircraftChargeRate.charge_tacho,
        charge_airswitch: aircraftChargeRate.charge_airswitch,
      } : null,
      instructor_charge_rate: instructorChargeRate ? {
        id: instructorChargeRate.id,
        rate_per_hour: instructorChargeRate.rate_per_hour,
        charge_hobbs: instructorChargeRate.charge_hobbs,
        charge_tacho: instructorChargeRate.charge_tacho,
        charge_airswitch: instructorChargeRate.charge_airswitch,
      } : null,

      taxRate,
    })
  }, [
    booking?.id,
    selectedAircraftId,
    selectedInstructorId,
    selectedFlightTypeId,
    hobbsStart,
    hobbsEnd,
    tachStart,
    tachEnd,
    soloEndHobbs,
    soloEndTach,
    hasSoloAtEnd,
    instructionType,
    aircraftChargeRate,
    instructorChargeRate,
    taxRate,
  ])

  const isDraftCalculated = !!draftCalculation
  const isDraftStale = !!draftCalculation && draftCalculation.signature !== draftSignature

  const updateDraftLine = React.useCallback((idx: number, patch: Partial<GeneratedInvoiceItem>) => {
    // If it's a manual item, we also need to update the manualItems state
    // so that subsequent calculations (buildDraftInvoiceItems() + manualItems) stay in sync.
    const generatedItemsCount = buildDraftInvoiceItems().length
    if (idx >= generatedItemsCount) {
      const manualIdx = idx - generatedItemsCount
      setManualItems(prev => {
        const next = [...prev]
        if (next[manualIdx]) {
          next[manualIdx] = { ...next[manualIdx], ...patch }
        }
        return next
      })
    }

    setDraftCalculation((prev) => {
      if (!prev) return prev
      if (idx < 0 || idx >= prev.items.length) return prev

      const nextItems = prev.items.map((it, i) => {
        if (i !== idx) return it
        return {
          ...it,
          ...patch,
        }
      })

      const nextLines: CalculatedInvoiceLine[] = nextItems.map((item) => {
        const calculated = InvoiceCalculations.calculateItemAmounts({
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate ?? taxRate,
        })
        return {
          ...item,
          amount: calculated.amount,
          tax_amount: calculated.tax_amount,
          rate_inclusive: calculated.rate_inclusive,
          line_total: calculated.line_total,
        }
      })

      const subtotal = roundToTwoDecimals(nextLines.reduce((sum, l) => sum + l.amount, 0))
      const tax_total = roundToTwoDecimals(nextLines.reduce((sum, l) => sum + l.tax_amount, 0))
      const total_amount = roundToTwoDecimals(nextLines.reduce((sum, l) => sum + l.line_total, 0))

      return {
        ...prev,
        calculated_at: new Date().toISOString(),
        items: nextItems,
        lines: nextLines,
        totals: { subtotal, tax_total, total_amount },
      }
    })
  }, [taxRate, buildDraftInvoiceItems])

  const isDraftValidForApproval = React.useMemo(() => {
    if (!draftCalculation) return false
    if (draftCalculation.signature !== draftSignature) return false
    if (draftCalculation.items.length === 0) return false
    if (draftCalculation.items.some((i) => !Number.isFinite(i.quantity) || i.quantity <= 0)) return false
    if (draftCalculation.items.some((i) => !Number.isFinite(i.unit_price) || i.unit_price < 0)) return false
    if (!Number.isFinite(draftCalculation.totals.total_amount) || draftCalculation.totals.total_amount <= 0) return false
    return true
  }, [draftCalculation, draftSignature])

  const performCalculation = React.useCallback((
    customManualItems?: GeneratedInvoiceItem[],
    customExcludedKeys?: Set<string>
  ) => {
    if (!booking) return
    if (isApproved) return

    const mItems = customManualItems ?? manualItems
    const eKeys = customExcludedKeys ?? excludedGeneratedKeys

    if (!selectedAircraftId || !selectedFlightTypeId || !aircraftChargeRate || !aircraftBillingBasis) {
      return
    }

    if (aircraftBillingBasis === 'airswitch') return
    if (billingHours <= 0) return
    if (splitTimes.error) return
    if (instructorBasisConflictForSoloSplit) return

    const items = [
      ...buildDraftInvoiceItems().filter(item => !eKeys.has(item.description)),
      ...mItems
    ]

    if (items.length === 0) {
      setDraftCalculation(null)
      return
    }

    const lines: CalculatedInvoiceLine[] = items.map((item) => {
      const calculated = InvoiceCalculations.calculateItemAmounts({
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate ?? taxRate,
      })
      return {
        ...item,
        amount: calculated.amount,
        tax_amount: calculated.tax_amount,
        rate_inclusive: calculated.rate_inclusive,
        line_total: calculated.line_total,
      }
    })

    const subtotal = roundToTwoDecimals(lines.reduce((sum, l) => sum + l.amount, 0))
    const tax_total = roundToTwoDecimals(lines.reduce((sum, l) => sum + l.tax_amount, 0))
    const total_amount = roundToTwoDecimals(lines.reduce((sum, l) => sum + l.line_total, 0))

    // Store derived billing fields in the form (browser only; no DB writes).
    setValue("billing_basis", aircraftBillingBasis, { shouldDirty: false })
    setValue("billing_hours", billingHours, { shouldDirty: false })
    setValue("flight_time", billingHours, { shouldDirty: false })
    if (splitTimes.total > 0 && !splitTimes.error) {
      setValue("dual_time", splitTimes.dual, { shouldDirty: false })
      setValue("solo_time", splitTimes.solo, { shouldDirty: false })
    }

    setDraftCalculation({
      signature: draftSignature,
      calculated_at: new Date().toISOString(),
      billing_basis: aircraftBillingBasis,
      billing_hours: billingHours,
      dual_time: splitTimes.dual,
      solo_time: splitTimes.solo,
      items,
      lines,
      totals: { subtotal, tax_total, total_amount },
    })
  }, [
    booking,
    isApproved,
    manualItems,
    excludedGeneratedKeys,
    selectedAircraftId,
    selectedFlightTypeId,
    aircraftChargeRate,
    aircraftBillingBasis,
    billingHours,
    splitTimes,
    instructorBasisConflictForSoloSplit,
    buildDraftInvoiceItems,
    taxRate,
    setValue,
    draftSignature
  ])

  const calculateDraft = handleSubmit(async () => {
    setHasAttemptedCalculation(true)
    if (splitTimes.error) {
      toast.error(splitTimes.error)
      return
    }
    setIsCalculating(true)
    performCalculation()
    setIsCalculating(false)
  })

  const removeManualItem = React.useCallback((manualIdx: number) => {
    const nextManualItems = manualItems.filter((_, i) => i !== manualIdx)
    setManualItems(nextManualItems)
    performCalculation(nextManualItems)
  }, [manualItems, performCalculation])

  const excludeGeneratedItem = React.useCallback((description: string) => {
    const nextExcludedKeys = new Set(excludedGeneratedKeys)
    nextExcludedKeys.add(description)
    setExcludedGeneratedKeys(nextExcludedKeys)
    performCalculation(undefined, nextExcludedKeys)
  }, [excludedGeneratedKeys, performCalculation])

  // Calculate flight hours from meter readings
  React.useEffect(() => {
    if (isInitializingRef.current) return

    // Persist the deterministic split times (no manual overrides)
    if (splitTimes.total > 0 && !splitTimes.error) {
      setValue("dual_time", splitTimes.dual, { shouldDirty: false })
      setValue("solo_time", splitTimes.solo, { shouldDirty: false })
    }
  }, [hobbsTotalHours, tachTotalHours, splitTimes.total, splitTimes.dual, splitTimes.solo, splitTimes.error, setValue])

  // Track initialization key to reload form when booking changes
  const lastInitializedKey = React.useRef<string | null>(null)
  
  // Populate form when booking loads
  React.useEffect(() => {
    if (!booking) return
    
    const initializationKey = bookingId
    
    if (lastInitializedKey.current === initializationKey) {
      return
    }
    
    isInitializingRef.current = true
    lastInitializedKey.current = initializationKey

    // Reset form with initial values (use booking fields directly)
    const lp = Array.isArray(booking.lesson_progress) ? booking.lesson_progress[0] : booking.lesson_progress

    const initialValues: FlightLogCheckinFormData = {
      hobbs_start: (typeof booking.hobbs_start === 'number' && !isNaN(booking.hobbs_start)) ? booking.hobbs_start : null,
      hobbs_end: (typeof booking.hobbs_end === 'number' && !isNaN(booking.hobbs_end)) ? booking.hobbs_end : null,
      tach_start: (typeof booking.tach_start === 'number' && !isNaN(booking.tach_start)) ? booking.tach_start : null,
      tach_end: (typeof booking.tach_end === 'number' && !isNaN(booking.tach_end)) ? booking.tach_end : null,
      airswitch_start: (typeof booking.airswitch_start === 'number' && !isNaN(booking.airswitch_start)) ? booking.airswitch_start : null,
      airswitch_end: (typeof booking.airswitch_end === 'number' && !isNaN(booking.airswitch_end)) ? booking.airswitch_end : null,
      flight_time_hobbs: (typeof booking.flight_time_hobbs === 'number' && !isNaN(booking.flight_time_hobbs)) ? booking.flight_time_hobbs : null,
      flight_time_tach: (typeof booking.flight_time_tach === 'number' && !isNaN(booking.flight_time_tach)) ? booking.flight_time_tach : null,
      flight_time_airswitch: (typeof booking.flight_time_airswitch === 'number' && !isNaN(booking.flight_time_airswitch)) ? booking.flight_time_airswitch : null,
      flight_time: (typeof booking.flight_time === 'number' && !isNaN(booking.flight_time)) ? booking.flight_time : null,
      billing_basis: booking.billing_basis || null,
      billing_hours: (typeof booking.billing_hours === 'number' && !isNaN(booking.billing_hours)) ? booking.billing_hours : null,
      checked_out_aircraft_id: booking.checked_out_aircraft_id || booking.aircraft_id || null,
      checked_out_instructor_id: booking.checked_out_instructor_id || booking.instructor_id || null,
      flight_type_id: booking.flight_type_id || null,
      lesson_id: booking.lesson_id || null,
      remarks: null,
      fuel_on_board: null,
      passengers: null,
      route: null,
      flight_remarks: null,
      solo_end_hobbs: (typeof booking.solo_end_hobbs === 'number' && !isNaN(booking.solo_end_hobbs)) ? booking.solo_end_hobbs : null,
      solo_end_tach: (typeof booking.solo_end_tach === 'number' && !isNaN(booking.solo_end_tach)) ? booking.solo_end_tach : null,
      dual_time: (typeof booking.dual_time === 'number' && !isNaN(booking.dual_time)) ? booking.dual_time : null,
      solo_time: (typeof booking.solo_time === 'number' && !isNaN(booking.solo_time)) ? booking.solo_time : null,
      total_hours_start: (typeof booking.total_hours_start === 'number' && !isNaN(booking.total_hours_start)) ? booking.total_hours_start : null,
      total_hours_end: (typeof booking.total_hours_end === 'number' && !isNaN(booking.total_hours_end)) ? booking.total_hours_end : null,
      instructor_comments: lp?.instructor_comments || null,
      lesson_highlights: lp?.lesson_highlights || null,
      areas_for_improvement: lp?.areas_for_improvement || null,
      airmanship: lp?.airmanship || null,
      focus_next_lesson: lp?.focus_next_lesson || null,
      safety_concerns: lp?.safety_concerns || null,
      weather_conditions: lp?.weather_conditions || null,
      lesson_status: lp?.status || null,
    }
    
    reset(initialValues, { keepDirty: false, keepDefaultValues: false })
    
    // Wait for reset to complete, then mark as initialized
    Promise.resolve().then(() => {
      // Small delay to ensure form state has settled
      setTimeout(() => {
        isInitializingRef.current = false
        // No sticky "dirty" banner; keep initialization lightweight.
      }, 300)
    })
  }, [booking, bookingId, reset])

  function buildExperienceEntriesForSave(): Array<{
    experience_type_id: string
    value: number
    unit: ExperienceUnit
    notes?: string | null
    conditions?: string | null
  }> {
    const cleaned = experienceEntries
      .map((e) => ({
        experience_type_id: e.experience_type_id?.trim(),
        unit: e.unit,
        valueRaw: e.value,
        notes: e.notes ?? null,
        conditions: e.conditions ?? null,
      }))
      .filter((e) => e.experience_type_id || (e.valueRaw != null && String(e.valueRaw).trim().length > 0))

    const seen = new Set<string>()
    const output: Array<{
      experience_type_id: string
      value: number
      unit: ExperienceUnit
      notes?: string | null
      conditions?: string | null
    }> = []

    for (const e of cleaned) {
      if (!e.experience_type_id) throw new Error('Select an experience type for each entry')
      if (seen.has(e.experience_type_id)) throw new Error('Each experience type can only be added once per booking')
      seen.add(e.experience_type_id)

      const value = Number(e.valueRaw)
      if (!Number.isFinite(value) || value <= 0) throw new Error('Experience values must be greater than 0')
      if ((e.unit === 'count' || e.unit === 'landings') && !Number.isInteger(value)) {
        throw new Error('Counts/landings must be a whole number')
      }

      output.push({
        experience_type_id: e.experience_type_id,
        value,
        unit: e.unit,
        notes: e.notes,
        conditions: e.conditions,
      })
    }

    return output
  }

  const saveExperienceMutation = useMutation({
    mutationFn: async () => {
      const entries = buildExperienceEntriesForSave()
      return fetchJson<{ entries: unknown[] }>(`/api/bookings/${bookingId}/experience`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      })
    },
    onSuccess: async () => {
      setExperienceDirty(false)
      await queryClient.invalidateQueries({ queryKey: ['bookingExperience', bookingId] })
    },
  })

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!booking) throw new Error('Booking not loaded')
      if (isApproved) throw new Error('Check-in already approved')

      if (!selectedAircraftId) throw new Error('Aircraft is required')
      if (!selectedFlightTypeId) throw new Error('Flight type is required')
      if (!aircraftBillingBasis) throw new Error('No aircraft charge basis configured')
      if (billingHours <= 0) throw new Error('Billing hours must be greater than zero')
      if (splitTimes.error) throw new Error(splitTimes.error)
      if (instructorBasisConflictForSoloSplit) throw new Error('Instructor charge basis conflicts with aircraft charge basis for a dual+solo split.')
      if (!draftCalculation) throw new Error('Please calculate flight charges before approving.')
      if (draftCalculation.signature !== draftSignature) throw new Error('Flight charges are out of date. Recalculate before approving.')
      if (draftCalculation.items.length === 0) throw new Error('No invoice items to approve')

      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7)

      const payload = {
        checked_out_aircraft_id: selectedAircraftId,
        checked_out_instructor_id: selectedInstructorId,
        flight_type_id: selectedFlightTypeId,

        hobbs_start: hobbsStart ?? null,
        hobbs_end: hobbsEnd ?? null,
        tach_start: tachStart ?? null,
        tach_end: tachEnd ?? null,
        airswitch_start: null,
        airswitch_end: null,

        solo_end_hobbs: aircraftBillingBasis === 'hobbs' && hasSoloAtEnd ? (soloEndHobbs ?? null) : null,
        solo_end_tach: aircraftBillingBasis === 'tacho' && hasSoloAtEnd ? (soloEndTach ?? null) : null,
        dual_time: draftCalculation.dual_time > 0 ? draftCalculation.dual_time : null,
        solo_time: draftCalculation.solo_time > 0 ? draftCalculation.solo_time : null,

        billing_basis: draftCalculation.billing_basis,
        billing_hours: draftCalculation.billing_hours,

        tax_rate: taxRate,
        due_date: dueDate.toISOString(),
        reference: `Booking ${booking.id} check-in`,
        notes: `Auto-generated from booking check-in.`,
        items: draftCalculation.items.map((i) => ({
          chargeable_id: i.chargeable_id,
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
          tax_rate: i.tax_rate,
          notes: i.notes ?? null,
        })),
      }

      // Persist experience entries before approval so reporting is consistent immediately after check-in.
      if (experienceDirty) {
        await saveExperienceMutation.mutateAsync()
      }

      return fetchJson<{ invoice: { id: string } }>(`/api/bookings/${bookingId}/checkin/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["booking", bookingId] })
      await queryClient.invalidateQueries({ queryKey: ["bookings"] })
      await queryClient.invalidateQueries({ queryKey: ["invoices"] })
      toast.success("Check-in approved and invoice created")
      setIsBillingCollapsed(true)
      setIsInvoiceCollapsed(true)
      setIsDebriefOpen(true)
      setTimeout(() => {
        document.getElementById("lesson-debrief")?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 150)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })

  const saveProgressMutation = useMutation({
    mutationFn: async (data: Partial<FlightLogCheckinFormData>) => {
      return fetchJson(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["booking", bookingId] })
    },
  })

  // "Save Draft Check-In" is intentionally browser-only. It calculates and stores
  // invoice data locally; nothing is persisted until approval.

  const isLoading = bookingQuery.isLoading || optionsQuery.isLoading
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
            <div className="text-muted-foreground">Loading booking check-in...</div>
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

  // Only allow check-in for flight bookings
  if (booking.booking_type !== 'flight') {
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
              <h2 className="text-xl font-semibold mb-2">Invalid Booking Type</h2>
              <p className="text-muted-foreground mb-4">
                Flight check-in is only available for flight bookings.
              </p>
              <Button asChild>
                <Link href={`/bookings/${bookingId}`}>Back to Booking</Link>
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

  const aircraftRateMissing = !!selectedAircraftId && !!selectedFlightTypeId && aircraftChargeRateQuery.isFetched && !aircraftChargeRate
  const instructorRateMissing = !!selectedInstructorId && !!selectedFlightTypeId && instructorChargeRateQuery.isFetched && !instructorChargeRate

  const headerActions = isAdminOrInstructor && (
    <div className="flex items-center gap-2 sm:gap-3">
      {/* Correction button - shown only for approved bookings and admin/owner */}
      {isApproved && (role === 'owner' || role === 'admin') && (
        <Button
          size="sm"
          variant="outline"
          className="h-9 px-4 border-amber-200 hover:bg-amber-50 dark:border-amber-900 dark:hover:bg-amber-950 text-amber-700 dark:text-amber-300 font-medium"
          onClick={openCorrectionDialog}
          disabled={isCorrecting}
        >
          <IconEdit className="h-4 w-4 mr-2" />
          Correct Flight
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
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem 
            onClick={() => {
              if (!booking?.id) {
                toast.error("Booking ID not available")
                return
              }
              window.open(`/bookings/${booking.id}/print`, "_blank")
            }}
          >
            <IconFileText className="h-4 w-4 mr-2" />
            Print Checkout Sheet
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/bookings/${bookingId}`)}>
            <IconPlane className="h-4 w-4 mr-2" />
            View Booking Details
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const canApprove =
    !isApproved &&
    !!aircraftChargeRate &&
    !!aircraftBillingBasis &&
    !isAirswitchBillingUnsupported &&
    billingHours > 0 &&
    isDraftValidForApproval &&
    !instructorRateMissing &&
    !splitTimes.error &&
    !instructorBasisConflictForSoloSplit &&
    !approveMutation.isPending

  return (
    <>
    <SidebarProvider
      style={{
        "--sidebar-width": "calc(var(--spacing) * 72)",
        "--header-height": "calc(var(--spacing) * 12)",
      } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col bg-slate-100/50 dark:bg-slate-950/50">
          <div className="flex flex-1 flex-col">
            {/* Header Section */}
            <BookingHeader
              booking={booking}
              title="Flight Check-In"
              backHref={`/bookings/${bookingId}`}
              backLabel="Back to Booking"
              actions={headerActions}
              extra={(
                <>
                  {!isApproved && (
                    <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 rounded-full text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5">
                      Check-In In Progress
                    </Badge>
                  )}
                  {isApproved && booking?.corrected_at && (
                    <Badge variant="outline" className="bg-amber-50/50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800 rounded-full text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 flex items-center gap-1">
                      <IconEdit className="h-3 w-3" />
                      Corrected
                    </Badge>
                  )}
                </>
              )}
            />

            {/* Main Content */}
            <div className={`flex-1 mx-auto max-w-5xl w-full px-4 sm:px-6 lg:px-8 ${
              isMobile ? "pt-8 pb-24" : "pt-10 pb-8"
            }`}>
              <div className="space-y-6 lg:space-y-8">
                {/* Check-in Status Tracker */}
                <BookingStatusTracker 
                  stages={[
                    { id: 'charges', label: 'Charges Approved' },
                    { id: 'invoice', label: 'Invoice Created' },
                    // Only show debrief stage if not a solo flight
                    ...(instructionType !== 'solo' ? [{ id: 'debrief', label: 'Lesson Debrief' }] : []),
                  ]}
                  completedStageIds={[
                    ...(isApproved ? ['charges'] : []),
                    ...(checkinInvoiceId ? ['invoice'] : []),
                    // Only include debrief in completed stages if not a solo flight
                    ...(instructionType !== 'solo' && lessonProgressExists ? ['debrief'] : []),
                  ]}
                  activeStageId={
                    !isApproved ? 'charges' : 
                    !checkinInvoiceId ? 'invoice' : 
                    // Skip debrief stage for solo flights
                    (instructionType !== 'solo' && !lessonProgressExists) ? 'debrief' : 
                    undefined
                  }
                  className="mb-8"
                />

                {/* Step 1: Flight Details & Billing */}
                <Collapsible
                  open={!isBillingCollapsed}
                  onOpenChange={(next) => setIsBillingCollapsed(!next)}
                  className="space-y-4 scroll-mt-20"
                >
                  <div ref={billingRef} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-2">
                        <IconClock className="w-4 h-4 text-slate-500" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                          Flight Details & Billing
                        </h3>
                      </div>
                    {isApproved && (
                        <Badge variant="outline" className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full h-5">
                          <div className="h-1 w-1 rounded-full bg-slate-400 mr-1.5" />
                          Locked
                        </Badge>
                      )}
                    </div>
                    {isApproved && (
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all ml-auto sm:ml-0">
                          {isBillingCollapsed ? "View Details" : "Collapse"}
                          <IconChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", !isBillingCollapsed && "rotate-180")} />
                        </Button>
                      </CollapsibleTrigger>
                    )}
                  </div>

                  {isApproved && isBillingCollapsed && (
                    <div 
                      className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-border shadow-sm cursor-pointer hover:border-primary/30 hover:shadow-md transition-all flex items-center justify-between group"
                      onClick={() => setIsBillingCollapsed(false)}
                    >
                      <div className="flex flex-wrap items-center gap-y-4 gap-x-6 sm:gap-8">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Status</span>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Charges Finalized</span>
                          </div>
                        </div>
                        <div className="h-8 w-px bg-border/60 hidden sm:block" />
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Billing</span>
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                            <IconClock className="h-3.5 w-3.5 text-slate-500" />
                            <span>{billingHours.toFixed(1)}h billed</span>
                          </div>
                        </div>
                        <div className="h-8 w-px bg-border/60 hidden sm:block" />
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Flight Type</span>
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">
                            <IconPlane className="h-3.5 w-3.5 text-slate-500" />
                            <span>{selectedFlightType?.name || "Flight"}</span>
                          </div>
                        </div>
                      </div>
                      <IconChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all ml-4 shrink-0" />
                    </div>
                  )}

                  <CollapsibleContent>
                    <Card className="bg-card shadow-md border border-border/80 rounded-xl overflow-hidden">
                        <CardContent className="p-4 sm:p-6">
                          <form onSubmit={(e) => e.preventDefault()}>
                            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 lg:gap-6">
                              {/* Left: Meter readings */}
                              <div>
                                <FieldSet className="p-4 sm:p-3 gap-4 sm:gap-3 rounded-lg w-full max-w-full box-border bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-sm">
                                  <FieldGroup className="gap-4 sm:gap-3">
                                    {/* Charging basis indicator */}
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-sm font-semibold">
                                        Charging basis:{' '}
                                        <span className={aircraftBillingBasis === 'hobbs' || aircraftBillingBasis === 'tacho' ? 'text-primary' : 'text-destructive'}>
                                          {aircraftBillingBasis ?? '—'}
                                        </span>
                                      </div>
                                      <div className="text-xs text-muted-foreground tabular-nums">
                                        Hours used: {billingHours > 0 ? `${billingHours.toFixed(1)}h` : '—'}
                                      </div>
                                    </div>

                                    {/* Meter inputs: show active charging basis first */}
                                    {aircraftBillingBasis === 'hobbs' ? (
                                      <>
                                        {/* Hobbs Meter */}
                                        <FieldSet className="gap-3 sm:gap-2">
                                          <div className="flex items-center justify-between mb-2 sm:mb-1.5">
                                            <FieldLegend className="flex items-center gap-2 sm:gap-1.5 text-base sm:text-sm font-semibold">
                                              <IconClock className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                              Hobbs Meter
                                            </FieldLegend>
                                            <div className="text-sm sm:text-xs font-semibold sm:font-medium text-muted-foreground bg-white dark:bg-gray-800 px-2 py-1 rounded-md">
                                              {displayedHobbsHours > 0 ? `${displayedHobbsHours.toFixed(1)}h` : "0.0h"}
                                            </div>
                                          </div>
                                          <FieldGroup className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2.5">
                                            <Field data-invalid={!!errors.hobbs_start} className="gap-2 sm:gap-1">
                                              <FieldLabel htmlFor="hobbs_start" className="text-sm sm:text-xs font-medium">Start Hobbs</FieldLabel>
                                              <Input
                                                id="hobbs_start"
                                                inputMode="decimal"
                                                placeholder="0.0"
                                                disabled={isApproved}
                                                {...register("hobbs_start", { setValueAs: (v) => (v === "" || isNaN(parseFloat(v))) ? null : parseFloat(v) })}
                                                className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                                aria-invalid={!!errors.hobbs_start}
                                              />
                                              <FieldError errors={errors.hobbs_start ? [{ message: errors.hobbs_start.message }] : undefined} />
                                            </Field>
                                            <Field data-invalid={!!errors.hobbs_end} className="gap-2 sm:gap-1">
                                              <FieldLabel htmlFor="hobbs_end" className="text-sm sm:text-xs font-medium">End Hobbs</FieldLabel>
                                              <Input
                                                id="hobbs_end"
                                                inputMode="decimal"
                                                placeholder="0.0"
                                                disabled={isApproved}
                                                {...register("hobbs_end", { setValueAs: (v) => (v === "" || isNaN(parseFloat(v))) ? null : parseFloat(v) })}
                                                className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                                aria-invalid={!!errors.hobbs_end}
                                              />
                                              <FieldError errors={errors.hobbs_end ? [{ message: errors.hobbs_end.message }] : undefined} />
                                            </Field>
                                          </FieldGroup>

                                          {/* Solo at end option - only for dual/trial flights */}
                                          {(instructionType === 'dual' || instructionType === 'trial') && (
                                            <div className="mt-3 space-y-2">
                                              <div className="flex items-center justify-between">
                                                <FieldLabel className="text-sm font-medium">Solo at end</FieldLabel>
                                                <Switch
                                                  checked={hasSoloAtEnd}
                                                  disabled={isApproved}
                                                  onCheckedChange={(next) => {
                                                    setHasSoloAtEnd(next)
                                                    setHasAttemptedCalculation(false)
                                                    if (!next) {
                                                      setValue("solo_end_hobbs", null, { shouldDirty: true })
                                                      setValue("solo_end_tach", null, { shouldDirty: true })
                                                    }
                                                  }}
                                                />
                                              </div>

                                              {hasSoloAtEnd && (
                                                <Field data-invalid={hasAttemptedCalculation && !!splitTimes.error} className="gap-2 sm:gap-1">
                                                  <FieldLabel htmlFor="solo_end_hobbs" className="text-sm sm:text-xs font-medium">Solo End Hobbs</FieldLabel>
                                                  <Input
                                                    id="solo_end_hobbs"
                                                    inputMode="decimal"
                                                    placeholder="0.0"
                                                    disabled={isApproved}
                                                    {...register("solo_end_hobbs", { setValueAs: (v) => (v === "" || isNaN(parseFloat(v))) ? null : parseFloat(v) })}
                                                    className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                                  />
                                                </Field>
                                              )}

                                              {hasAttemptedCalculation && splitTimes.error && (
                                                <div className="text-sm text-destructive">{splitTimes.error}</div>
                                              )}

                                              {instructorBasisConflictForSoloSplit && (
                                                <div className="text-sm text-destructive">
                                                  Instructor charge basis differs from aircraft basis. Dual+solo split requires matching bases to stay auditable.
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </FieldSet>

                                        {/* Tacho Meter */}
                                        <FieldSet className="gap-3 sm:gap-2">
                                          <div className="flex items-center justify-between mb-2 sm:mb-1.5">
                                            <FieldLegend className="flex items-center gap-2 sm:gap-1.5 text-base sm:text-sm font-semibold">
                                              <IconPlane className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                              Tacho Meter
                                            </FieldLegend>
                                            <div className="text-sm sm:text-xs font-semibold sm:font-medium text-muted-foreground bg-white dark:bg-gray-800 px-2 py-1 rounded-md">
                                              {displayedTachHours > 0 ? `${displayedTachHours.toFixed(1)}h` : "0.0h"}
                                            </div>
                                          </div>
                                          <FieldGroup className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2.5">
                                            <Field data-invalid={!!errors.tach_start} className="gap-2 sm:gap-1">
                                              <FieldLabel htmlFor="tach_start" className="text-sm sm:text-xs font-medium">Start Tacho</FieldLabel>
                                              <Input
                                                id="tach_start"
                                                inputMode="decimal"
                                                placeholder="0.0"
                                                disabled={isApproved}
                                                {...register("tach_start", { setValueAs: (v) => (v === "" || isNaN(parseFloat(v))) ? null : parseFloat(v) })}
                                                className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                                aria-invalid={!!errors.tach_start}
                                              />
                                              <FieldError errors={errors.tach_start ? [{ message: errors.tach_start.message }] : undefined} />
                                            </Field>
                                            <Field data-invalid={!!errors.tach_end} className="gap-2 sm:gap-1">
                                              <FieldLabel htmlFor="tach_end" className="text-sm sm:text-xs font-medium">End Tacho</FieldLabel>
                                              <Input
                                                id="tach_end"
                                                inputMode="decimal"
                                                placeholder="0.0"
                                                disabled={isApproved}
                                                {...register("tach_end", { setValueAs: (v) => (v === "" || isNaN(parseFloat(v))) ? null : parseFloat(v) })}
                                                className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                                aria-invalid={!!errors.tach_end}
                                              />
                                              <FieldError errors={errors.tach_end ? [{ message: errors.tach_end.message }] : undefined} />
                                            </Field>
                                          </FieldGroup>
                                        </FieldSet>
                                      </>
                                    ) : (
                                      <>
                                        {/* Tacho Meter */}
                                        <FieldSet className="gap-3 sm:gap-2">
                                          <div className="flex items-center justify-between mb-2 sm:mb-1.5">
                                            <FieldLegend className="flex items-center gap-2 sm:gap-1.5 text-base sm:text-sm font-semibold">
                                              <IconPlane className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                              Tacho Meter
                                            </FieldLegend>
                                            <div className="text-sm sm:text-xs font-semibold sm:font-medium text-muted-foreground bg-white dark:bg-gray-800 px-2 py-1 rounded-md">
                                              {displayedTachHours > 0 ? `${displayedTachHours.toFixed(1)}h` : "0.0h"}
                                            </div>
                                          </div>
                                          <FieldGroup className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2.5">
                                            <Field data-invalid={!!errors.tach_start} className="gap-2 sm:gap-1">
                                              <FieldLabel htmlFor="tach_start" className="text-sm sm:text-xs font-medium">Start Tacho</FieldLabel>
                                              <Input
                                                id="tach_start"
                                                inputMode="decimal"
                                                placeholder="0.0"
                                                disabled={isApproved}
                                                {...register("tach_start", { setValueAs: (v) => (v === "" || isNaN(parseFloat(v))) ? null : parseFloat(v) })}
                                                className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                                aria-invalid={!!errors.tach_start}
                                              />
                                              <FieldError errors={errors.tach_start ? [{ message: errors.tach_start.message }] : undefined} />
                                            </Field>
                                            <Field data-invalid={!!errors.tach_end} className="gap-2 sm:gap-1">
                                              <FieldLabel htmlFor="tach_end" className="text-sm sm:text-xs font-medium">End Tacho</FieldLabel>
                                              <Input
                                                id="tach_end"
                                                inputMode="decimal"
                                                placeholder="0.0"
                                                disabled={isApproved}
                                                {...register("tach_end", { setValueAs: (v) => (v === "" || isNaN(parseFloat(v))) ? null : parseFloat(v) })}
                                                className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                                aria-invalid={!!errors.tach_end}
                                              />
                                              <FieldError errors={errors.tach_end ? [{ message: errors.tach_end.message }] : undefined} />
                                            </Field>
                                          </FieldGroup>

                                          {/* Solo at end option - only for dual/trial flights */}
                                          {(instructionType === 'dual' || instructionType === 'trial') && (
                                            <div className="mt-3 space-y-2">
                                              <div className="flex items-center justify-between">
                                                <FieldLabel className="text-sm font-medium">Solo at end</FieldLabel>
                                                <Switch
                                                  checked={hasSoloAtEnd}
                                                  disabled={isApproved}
                                                  onCheckedChange={(next) => {
                                                    setHasSoloAtEnd(next)
                                                    setHasAttemptedCalculation(false)
                                                    if (!next) {
                                                      setValue("solo_end_hobbs", null, { shouldDirty: true })
                                                      setValue("solo_end_tach", null, { shouldDirty: true })
                                                    }
                                                  }}
                                                />
                                              </div>

                                              {hasSoloAtEnd && (
                                                <Field data-invalid={hasAttemptedCalculation && !!splitTimes.error} className="gap-2 sm:gap-1">
                                                  <FieldLabel htmlFor="solo_end_tach" className="text-sm sm:text-xs font-medium">Solo End Tacho</FieldLabel>
                                                  <Input
                                                    id="solo_end_tach"
                                                    inputMode="decimal"
                                                    placeholder="0.0"
                                                    disabled={isApproved}
                                                    {...register("solo_end_tach", { setValueAs: (v) => (v === "" || isNaN(parseFloat(v))) ? null : parseFloat(v) })}
                                                    className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                                  />
                                                </Field>
                                              )}

                                              {hasAttemptedCalculation && splitTimes.error && (
                                                <div className="text-sm text-destructive">{splitTimes.error}</div>
                                              )}

                                              {instructorBasisConflictForSoloSplit && (
                                                <div className="text-sm text-destructive">
                                                  Instructor charge basis differs from aircraft basis. Dual+solo split requires matching bases to stay auditable.
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </FieldSet>

                                        {/* Hobbs Meter */}
                                        <FieldSet className="gap-3 sm:gap-2">
                                          <div className="flex items-center justify-between mb-2 sm:mb-1.5">
                                            <FieldLegend className="flex items-center gap-2 sm:gap-1.5 text-base sm:text-sm font-semibold">
                                              <IconClock className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                              Hobbs Meter
                                            </FieldLegend>
                                            <div className="text-sm sm:text-xs font-semibold sm:font-medium text-muted-foreground bg-white dark:bg-gray-800 px-2 py-1 rounded-md">
                                              {displayedHobbsHours > 0 ? `${displayedHobbsHours.toFixed(1)}h` : "0.0h"}
                                            </div>
                                          </div>
                                          <FieldGroup className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2.5">
                                            <Field data-invalid={!!errors.hobbs_start} className="gap-2 sm:gap-1">
                                              <FieldLabel htmlFor="hobbs_start" className="text-sm sm:text-xs font-medium">Start Hobbs</FieldLabel>
                                              <Input
                                                id="hobbs_start"
                                                inputMode="decimal"
                                                placeholder="0.0"
                                                disabled={isApproved}
                                                {...register("hobbs_start", { setValueAs: (v) => (v === "" || isNaN(parseFloat(v))) ? null : parseFloat(v) })}
                                                className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                                aria-invalid={!!errors.hobbs_start}
                                              />
                                              <FieldError errors={errors.hobbs_start ? [{ message: errors.hobbs_start.message }] : undefined} />
                                            </Field>
                                            <Field data-invalid={!!errors.hobbs_end} className="gap-2 sm:gap-1">
                                              <FieldLabel htmlFor="hobbs_end" className="text-sm sm:text-xs font-medium">End Hobbs</FieldLabel>
                                              <Input
                                                id="hobbs_end"
                                                inputMode="decimal"
                                                placeholder="0.0"
                                                disabled={isApproved}
                                                {...register("hobbs_end", { setValueAs: (v) => (v === "" || isNaN(parseFloat(v))) ? null : parseFloat(v) })}
                                                className="h-12 sm:h-10 px-4 sm:px-3 text-base sm:text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-primary/20"
                                                aria-invalid={!!errors.hobbs_end}
                                              />
                                              <FieldError errors={errors.hobbs_end ? [{ message: errors.hobbs_end.message }] : undefined} />
                                            </Field>
                                          </FieldGroup>
                                        </FieldSet>
                                      </>
                                    )}
                                  </FieldGroup>
                                </FieldSet>
                              </div>

                              {/* Right: Flight information & Calculate */}
                              <div className="flex flex-col gap-4 sm:gap-6">
                                <div className="rounded-lg border border-border/60 bg-muted/10 p-4 sm:p-3">
                                  <div className="text-sm font-semibold text-foreground mb-3">Flight information</div>
                                  <FieldGroup className="grid grid-cols-1 gap-4 sm:gap-4">
                                    <Field data-invalid={!!errors.flight_type_id} className="gap-2 sm:gap-1.5">
                                      <FieldLabel htmlFor="flight_type_id" className="flex items-center gap-2 text-base sm:text-sm font-medium text-foreground">
                                        <IconClock className="h-5 w-5 sm:h-4 sm:w-4 text-primary" />
                                        Flight Type
                                      </FieldLabel>
                                      {options ? (
                                        <Select
                                          disabled={isApproved}
                                          value={(watch("flight_type_id") ?? bookingFlightTypeId ?? "none") as string}
                                          onValueChange={(value) => setValue("flight_type_id", value === "none" ? null : value, { shouldDirty: true })}
                                        >
                                          <SelectTrigger id="flight_type_id" className="w-full h-12 sm:h-10 text-base sm:text-sm transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-gray-800 focus:ring-2 focus:ring-primary/20" aria-invalid={!!errors.flight_type_id}>
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
                                        <div className="px-4 sm:px-3 py-3 sm:py-2.5 border border-gray-300 dark:border-gray-700 rounded-md bg-slate-50 dark:bg-gray-900/50 text-base sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                                          {booking.flight_type?.name || "—"}
                                        </div>
                                      )}
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {aircraftChargeRateQuery.isLoading ? (
                                          <span>Loading aircraft rate…</span>
                                        ) : aircraftRatePerHourInclTax != null ? (
                                          <span className="tabular-nums">
                                            Aircraft rate: <span className="font-medium text-foreground">${aircraftRatePerHourInclTax.toFixed(2)}</span>/hr (inc. tax)
                                          </span>
                                        ) : (
                                          <span className="text-destructive">Aircraft rate not configured for this aircraft + flight type.</span>
                                        )}
                                      </div>
                                    </Field>

                                    <Field className="gap-2 sm:gap-1.5">
                                      <FieldLabel htmlFor="checked_out_instructor_id" className="flex items-center gap-2 text-base sm:text-sm font-medium text-foreground">
                                        <IconSchool className="h-5 w-5 sm:h-4 sm:w-4 text-foreground" />
                                        Instructor
                                      </FieldLabel>
                                      {isAdminOrInstructor && options ? (
                                        <Select
                                          disabled={isApproved}
                                          value={(watch("checked_out_instructor_id") ?? bookingInstructorId ?? "none") as string}
                                          onValueChange={(value) => setValue("checked_out_instructor_id", value === "none" ? null : value, { shouldDirty: true })}
                                        >
                                          <SelectTrigger id="checked_out_instructor_id" className="w-full h-12 sm:h-10 text-base sm:text-sm transition-colors border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-gray-800 focus:ring-2 focus:ring-primary/20">
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
                                        <div className="px-4 sm:px-3 py-3 sm:py-2.5 border border-gray-300 dark:border-gray-700 rounded-md bg-slate-50 dark:bg-gray-900/50 text-base sm:text-sm font-medium text-gray-900 dark:text-gray-100">
                                          {instructorName}
                                        </div>
                                      )}
                                      {!!selectedInstructorId && (
                                        <div className="mt-1 text-xs">
                                          {instructorChargeRateQuery.isLoading ? (
                                            <span className="text-muted-foreground">Loading instructor rate…</span>
                                          ) : instructorRatePerHourInclTax != null ? (
                                            <span className="text-muted-foreground tabular-nums">
                                              Instructor rate: <span className="font-medium text-foreground">${instructorRatePerHourInclTax.toFixed(2)}</span>/hr (inc. tax)
                                            </span>
                                          ) : (
                                            <span className="text-destructive">
                                              Instructor rate not configured for this flight type.
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </Field>
                                  </FieldGroup>
                                </div>

                                {/* Calculate Button */}
                                <div>
                                  <Button
                                    type="button"
                                    size="lg"
                                    onClick={() => {
                                      void calculateDraft().catch((err) => toast.error(getErrorMessage(err)))
                                    }}
                                    disabled={isApproved || isCalculating}
                                    className="w-full bg-slate-700 hover:bg-slate-800 text-white shadow-md hover:shadow-lg transition-all h-12 sm:h-11 text-base sm:text-sm font-semibold"
                                  >
                                    {isCalculating ? (
                                      <IconLoader2 className="h-5 w-5 mr-2 animate-spin" />
                                    ) : (
                                      <IconFileText className="h-5 w-5 mr-2" />
                                    )}
                                    {isCalculating 
                                      ? "Calculating..." 
                                      : isDraftCalculated 
                                        ? "Recalculate Flight Charges" 
                                        : "Calculate Flight Charges"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </form>
                        </CardContent>
                      </Card>
                  </CollapsibleContent>
                </Collapsible>
                              
                {/* Step 2: Invoice Review & Approval */}
                <Collapsible
                  open={!isInvoiceCollapsed}
                  onOpenChange={(next) => setIsInvoiceCollapsed(!next)}
                  className="space-y-4 scroll-mt-20"
                >
                  <div ref={invoiceRef} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-2">
                        <IconFileText className="w-4 h-4 text-slate-500" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                          Invoice
                        </h3>
                      </div>
                      {isApproved && (
                        <Badge variant="outline" className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full h-5">
                          <div className="h-1 w-1 rounded-full bg-slate-400 mr-1.5" />
                          Finalized
                        </Badge>
                      )}
                    </div>
                    {isApproved && (
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all ml-auto sm:ml-0">
                          {isInvoiceCollapsed ? "View Invoice" : "Collapse"}
                          <IconChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", !isInvoiceCollapsed && "rotate-180")} />
                        </Button>
                      </CollapsibleTrigger>
                    )}
                  </div>

                  {isApproved && isInvoiceCollapsed && (
                    <div 
                      className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-border shadow-sm cursor-pointer hover:border-primary/30 hover:shadow-md transition-all flex items-center justify-between group"
                      onClick={() => setIsInvoiceCollapsed(false)}
                    >
                      <div className="flex flex-wrap items-center gap-y-4 gap-x-6 sm:gap-8">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Invoice No.</span>
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {invoiceQuery.data?.invoice?.invoice_number || "—"}
                          </div>
                        </div>
                        <div className="h-8 w-px bg-border/60 hidden sm:block" />
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Total Amount</span>
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                            <span>${Number(invoiceQuery.data?.invoice?.total_amount || 0).toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="h-8 w-px bg-border/60 hidden sm:block" />
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Bill To</span>
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {studentName}
                          </div>
                        </div>
                      </div>
                      <IconChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all ml-4 shrink-0" />
                    </div>
                  )}

                  <CollapsibleContent>
                        {isApproved ? (
                      <div className="space-y-4">
                        {invoiceQuery.isLoading || invoiceItemsQuery.isLoading || invoiceSettingsQuery.isLoading ? (
                          <Card className="bg-card shadow-md border border-border/80 rounded-xl">
                            <CardContent className="p-8 text-center text-muted-foreground">
                              Loading invoice details...
                            </CardContent>
                          </Card>
                        ) : invoiceQuery.data?.invoice ? (
                          <InvoiceDocumentView
                            settings={invoiceSettingsQuery.data?.settings || {
                              schoolName: "Flight School",
                              billingAddress: "",
                              gstNumber: "",
                              contactPhone: "",
                              contactEmail: "",
                              invoiceFooter: "Thank you for your business.",
                              paymentTerms: "Payment terms: Net 30 days.",
                            }}
                            invoice={{
                              invoiceNumber: invoiceQuery.data.invoice.invoice_number || `#${invoiceQuery.data.invoice.id.slice(0, 8)}`,
                              issueDate: invoiceQuery.data.invoice.issue_date,
                              dueDate: invoiceQuery.data.invoice.due_date,
                              taxRate: invoiceQuery.data.invoice.tax_rate ?? 0.15,
                              subtotal: invoiceQuery.data.invoice.subtotal,
                              taxTotal: invoiceQuery.data.invoice.tax_total,
                              totalAmount: invoiceQuery.data.invoice.total_amount,
                              totalPaid: invoiceQuery.data.invoice.total_paid ?? 0,
                              balanceDue: invoiceQuery.data.invoice.balance_due,
                              billToName: studentName,
                            }}
                            items={(invoiceItemsQuery.data?.invoice_items || []).map((i: InvoiceItem) => ({
                              id: i.id,
                              description: i.description,
                              quantity: i.quantity,
                              unit_price: i.unit_price,
                              rate_inclusive: i.rate_inclusive,
                              line_total: i.line_total,
                            }))}
                            actionsSlot={
                              <div className="flex justify-end pt-4">
                                <Button asChild variant="outline" className="gap-2">
                                  <Link href={`/invoices/${checkinInvoiceId}`}>
                                    <IconFileText className="h-4 w-4" />
                                    View Full Invoice
                                  </Link>
                                </Button>
                              </div>
                            }
                          />
                        ) : (
                          <Card className="bg-card shadow-md border border-border/80 rounded-xl">
                            <CardContent className="p-8 text-center text-destructive">
                              Failed to load invoice details.
                            </CardContent>
                          </Card>
                        )}
                          </div>
                        ) : (
                      <Card className="bg-card shadow-md border border-border/80 rounded-xl overflow-hidden">
                        <CardContent className="pt-6">
                          <div className="space-y-6">
                            {(aircraftChargeRateQuery.isLoading || instructorChargeRateQuery.isLoading) && (
                              <div className="text-sm text-muted-foreground">Loading charge rates…</div>
                            )}

                            {isAirswitchBillingUnsupported && (
                              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                                This aircraft charge rate is configured to bill by <span className="font-semibold">airswitch</span>, but the check-in UI only supports Hobbs/Tacho.
                                Update the rate configuration to Hobbs or Tacho to proceed.
                              </div>
                            )}

                            {aircraftRateMissing && (
                              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                                No aircraft charge rate configured for this aircraft + flight type.
                              </div>
                            )}

                            {instructorRateMissing && (
                              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                                An instructor is assigned, but no instructor charge rate is configured for this flight type.
                                Approval is blocked to prevent underbilling.
                              </div>
                            )}

                          {!isDraftCalculated ? (
                            <div className="rounded-lg border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
                              Calculate flight charges to generate draft invoice items.
                            </div>
                          ) : isDraftStale ? (
                              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                                Draft is out of date. Recalculate flight charges before approving.
                              </div>
                            ) : (
                              <div className="rounded-lg border border-border/60 p-4">
                                <div className="text-sm font-semibold mb-3">Invoice items</div>

                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right w-[110px]">Qty (hrs)</TableHead>
                                        <TableHead className="text-right w-[160px]">Rate (inc. tax)</TableHead>
                                        <TableHead className="text-right w-[120px]">Line total</TableHead>
                                        <TableHead className="w-[90px] text-right">Actions</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {draftCalculation!.lines.map((line, idx) => {
                                        const generatedItems = buildDraftInvoiceItems().filter(item => !excludedGeneratedKeys.has(item.description));
                                        const generatedItemsCount = generatedItems.length;
                                        const isManualItem = idx >= generatedItemsCount;
                                        const manualIdx = isManualItem ? idx - generatedItemsCount : -1;
                                        const isEditing = editingIdx === idx;

                                        return (
                                          <TableRow key={`${line.description}-${idx}`} className="group hover:bg-muted/10">
                                            <TableCell className="font-medium py-2">
                                              {isEditing && isManualItem ? (
                                                <ChargeableSearchDropdown
                                                  value={line.description}
                                                  taxRate={taxRate}
                                                  open={openDropdownIdx === idx}
                                                  onOpenChange={(open) => {
                                                    if (open) {
                                                      setOpenDropdownIdx(idx)
                                                    } else {
                                                      setOpenDropdownIdx(null)
                                                    }
                                                  }}
                                                  onSelect={(chargeable) => {
                                                    const effectiveTaxRate = chargeable.is_taxable ? taxRate : 0;
                                                    updateDraftLine(idx, {
                                                      chargeable_id: chargeable.id,
                                                      description: chargeable.name,
                                                      quantity: 1,
                                                      unit_price: (chargeable.rate || 0) / (1 + effectiveTaxRate),
                                                      tax_rate: effectiveTaxRate
                                                    });
                                                    setOpenDropdownIdx(null);
                                                    // Automatically exit edit mode after selecting a chargeable
                                                    setEditingIdx(null);
                                                  }}
                                                />
                                              ) : (
                                                <div className="min-w-0 truncate px-0 py-1">{line.description}</div>
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right py-2">
                                              {isEditing ? (
                                                <Input
                                                  inputMode="decimal"
                                                  value={Number.isFinite(line.quantity) ? String(line.quantity) : ""}
                                                  onChange={(e) => {
                                                    const v = e.target.value === "" ? null : Number(e.target.value)
                                                    if (v !== null && isNaN(v)) return;
                                                    updateDraftLine(idx, { quantity: v ?? 0 })
                                                  }}
                                                  className="h-8 text-right tabular-nums w-full"
                                                />
                                              ) : (
                                                <div className="py-1 tabular-nums">{line.quantity?.toFixed(1) ?? "0.0"}</div>
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right py-2">
                                              {isEditing ? (
                                                <div className="relative">
                                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                                  <Input
                                                    inputMode="decimal"
                                                    value={(() => {
                                                      const effectiveTaxRate = (line.tax_rate ?? taxRate) || 0
                                                      if (!Number.isFinite(line.unit_price)) return ""
                                                      if (!Number.isFinite(effectiveTaxRate) || effectiveTaxRate <= 0) return String(line.unit_price)
                                                      return String(roundToTwoDecimals(line.unit_price * (1 + effectiveTaxRate)))
                                                    })()}
                                                    onChange={(e) => {
                                                      const effectiveTaxRate = (line.tax_rate ?? taxRate) || 0
                                                      const vInc = e.target.value === "" ? NaN : Number(e.target.value)
                                                      if (!Number.isFinite(vInc)) {
                                                        updateDraftLine(idx, { unit_price: NaN })
                                                        return
                                                      }
                                                      const divisor = 1 + (Number.isFinite(effectiveTaxRate) ? effectiveTaxRate : 0)
                                                      const vEx = divisor <= 0 ? vInc : (vInc / divisor)
                                                      updateDraftLine(idx, { unit_price: roundToTwoDecimals(vEx) })
                                                    }}
                                                    className="h-8 pl-5 text-right tabular-nums w-full"
                                                  />
                                                </div>
                                              ) : (
                                                <div className="py-1 tabular-nums">
                                                  ${(() => {
                                                    const effectiveTaxRate = (line.tax_rate ?? taxRate) || 0
                                                    const priceInc = Number.isFinite(line.unit_price) 
                                                      ? roundToTwoDecimals(line.unit_price * (1 + (effectiveTaxRate || 0)))
                                                      : 0
                                                    return priceInc.toFixed(2)
                                                  })()}
                                                </div>
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right py-2 tabular-nums font-semibold">
                                              ${Number(line.line_total ?? 0).toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right py-2">
                                              <div className="flex justify-end gap-1">
                                                {isEditing ? (
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                      setEditingIdx(null);
                                                      setOpenDropdownIdx(null);
                                                    }}
                                                    className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                  >
                                                    <IconCheck className="h-4 w-4" />
                                                  </Button>
                                                ) : (
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                      setEditingIdx(idx);
                                                      // If it's a manual item with no description, open the dropdown
                                                      if (isManualItem && !line.description) {
                                                        setOpenDropdownIdx(idx);
                                                      }
                                                    }}
                                                    className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                                  >
                                                    <IconPencil className="h-4 w-4" />
                                                  </Button>
                                                )}
                                                
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => {
                                                    if (editingIdx === idx) {
                                                      setEditingIdx(null);
                                                      setOpenDropdownIdx(null);
                                                    }
                                                    if (isManualItem) {
                                                      removeManualItem(manualIdx)
                                                    } else {
                                                      excludeGeneratedItem(line.description)
                                                    }
                                                  }}
                                                  className={cn(
                                                    "h-7 w-7 text-muted-foreground hover:text-destructive",
                                                    !isEditing && "opacity-0 group-hover:opacity-100 transition-opacity"
                                                  )}
                                                >
                                                  <IconTrash className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>

                                <div className="mt-4 pt-4 border-t">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full justify-start border-dashed"
                                    onClick={() => {
                                      const newItem: GeneratedInvoiceItem = {
                                        chargeable_id: null,
                                        description: "",
                                        quantity: 1,
                                        unit_price: 0,
                                        tax_rate: taxRate
                                      };
                                      
                                      const generatedItems = buildDraftInvoiceItems().filter(item => !excludedGeneratedKeys.has(item.description));
                                      const currentGeneratedCount = generatedItems.length;
                                      const currentManualCount = manualItems.length;
                                      
                                      const nextManualItems = [...manualItems, newItem];
                                      setManualItems(nextManualItems);
                                      const newItemIdx = currentGeneratedCount + currentManualCount;
                                      setEditingIdx(newItemIdx);

                                      // Perform synchronous-like calculation update
                                      performCalculation(nextManualItems);
                                      
                                      // Open dropdown after calculation completes and component re-renders
                                      setTimeout(() => {
                                        setOpenDropdownIdx(newItemIdx);
                                      }, 0);
                                    }}
                                  >
                                    <IconPlus className="mr-2 h-4 w-4" />
                                    Add Item
                                  </Button>
                                </div>

                                <div className="mt-4 border-t pt-4 space-y-2 text-sm">
                                  <div className="flex items-center justify-between">
                                    <div className="text-muted-foreground">Subtotal</div>
                                    <div className="tabular-nums font-medium">${draftCalculation!.totals.subtotal.toFixed(2)}</div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="text-muted-foreground">Tax</div>
                                    <div className="tabular-nums font-medium">${draftCalculation!.totals.tax_total.toFixed(2)}</div>
                                  </div>
                                  <div className="flex items-center justify-between border-t pt-2">
                                    <div className="text-base font-semibold">Total</div>
                                    <div className="text-lg font-semibold tabular-nums text-primary">
                                      ${draftCalculation!.totals.total_amount.toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="flex justify-end">
                              <Button
                                size="lg"
                                onClick={() => approveMutation.mutate()}
                                disabled={!canApprove}
                                className="h-12 px-8 min-w-[200px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg hover:shadow-xl transition-all rounded-xl"
                              >
                                {approveMutation.isPending ? "Approving..." : "Approve Check-In & Create Invoice"}
                              </Button>
                            </div>
                      </div>
                    </CardContent>
                  </Card>
                      )}
                    </CollapsibleContent>
                </Collapsible>

                {/* Step 3: Lesson Debrief (optional) - Only for non-solo flights */}
                {instructionType !== 'solo' && (
                <div id="lesson-debrief" className="scroll-mt-20">
                  <Collapsible
                    open={isDebriefOpen && (isApproved || lessonProgressExists)}
                    onOpenChange={(next) => {
                      if (!isApproved && !lessonProgressExists) return
                      setIsDebriefOpen(next)
                    }}
                    className="space-y-4 pb-12"
                  >
                    <div ref={debriefRef} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className="flex items-center gap-2">
                          <IconMessage className="w-4 h-4 text-slate-500" />
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                            Lesson Debrief
                          </h3>
                        </div>
                        <Badge variant="outline" className="bg-slate-100/80 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full h-5">
                          <div className="h-1 w-1 rounded-full bg-slate-400 mr-1.5" />
                          Optional
                        </Badge>
                        {lessonProgressExists && (
                          <Badge variant="outline" className="bg-green-50/50 dark:bg-green-900/10 border-green-100/50 dark:border-green-900/20 text-[10px] font-bold text-green-600/80 dark:text-green-400/80 uppercase tracking-wider px-2 py-0.5 rounded-full h-5">
                            <div className="h-1 w-1 rounded-full bg-green-500 mr-1.5" />
                            Saved
                          </Badge>
                        )}
                      </div>

                      {isApproved || lessonProgressExists ? (
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all ml-auto sm:ml-0">
                            {isDebriefOpen ? "Hide" : "Add / Edit"}
                            <IconChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isDebriefOpen && "rotate-180")} />
                          </Button>
                        </CollapsibleTrigger>
                      ) : (
                        <div className="px-2.5 py-1 rounded-lg bg-muted/50 border border-border/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 italic ml-auto sm:ml-0">
                          Available after approval
                        </div>
                      )}
                    </div>

                    {!isDebriefOpen && (
                      <div 
                        className={cn(
                          "p-4 rounded-xl border transition-all flex items-center justify-between group cursor-pointer shadow-sm",
                          lessonProgressExists 
                            ? "bg-white dark:bg-slate-900 border-border hover:border-primary/30" 
                            : "bg-white dark:bg-slate-900 border-primary/20 hover:border-primary/40 hover:shadow-md ring-1 ring-primary/5"
                        )}
                        onClick={() => setIsDebriefOpen(true)}
                      >
                        <div className="flex flex-wrap items-center gap-y-4 gap-x-6 sm:gap-8">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Status</span>
                            <div className="flex items-center gap-2">
                              {lessonProgressExists ? (
                                <>
                                  <div className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Debrief Completed</span>
                                </>
                              ) : (
                                <>
                                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Action Required</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="h-8 w-px bg-border/60 hidden sm:block" />
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-wider">Task</span>
                            <div className="flex items-center gap-2 text-sm font-bold">
                              {lessonProgressExists ? (
                                <span className="text-slate-600 dark:text-slate-400">Record Updated</span>
                              ) : (
                                <span className="text-primary font-bold">Log Flight Debrief</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          {!lessonProgressExists && (
                            <span className="text-[10px] font-bold text-primary uppercase tracking-wider hidden sm:inline-block mr-2">Click to debrief</span>
                          )}
                          <IconChevronRight className={cn(
                            "h-4 w-4 transition-all group-hover:translate-x-0.5",
                            lessonProgressExists ? "text-muted-foreground/50" : "text-primary"
                          )} />
                        </div>
                      </div>
                    )}

                      <CollapsibleContent>
                      <Card className="bg-card shadow-md border border-border/80 rounded-xl overflow-hidden">
                        <CardContent className="p-4 sm:p-6 space-y-8">
                          {/* Lesson Summary Header */}
                          <div className="flex flex-wrap items-center gap-x-10 gap-y-5 px-1 pb-8 mb-4 border-b border-border/40">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                <IconSchool className="h-3 w-3" />
                                Member
                              </div>
                              <div className="text-sm font-bold text-foreground">{memberName}</div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                <IconSchool className="h-3 w-3" />
                                Instructor
                              </div>
                              <div className="text-sm font-bold text-foreground">{instructorName || "Instructor"}</div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                <IconPlane className="h-3 w-3" />
                                Aircraft
                              </div>
                              <div className="text-sm font-bold text-foreground">{aircraftReg}</div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                <IconClock className="h-3 w-3" />
                                Date
                              </div>
                              <div className="text-sm font-bold text-foreground">{bookingDate}</div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                <IconNotebook className="h-3 w-3" />
                                Lesson
                              </div>
                              <div className="text-sm font-bold text-foreground">{lessonName}</div>
                            </div>
                            {syllabusName && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                  <IconFileText className="h-3 w-3" />
                                  Syllabus
                                </div>
                                <div className="text-sm font-bold text-foreground">{syllabusName}</div>
                              </div>
                            )}
                          </div>

                          <FieldSet className="gap-8">
                            {(instructionType === 'dual' || instructionType === 'trial') && (
                              <Field className="gap-3">
                                <FieldLabel className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  <IconTarget className="h-3.5 w-3.5" />
                                  Lesson Outcome
                                  <span className="ml-1 text-[10px] font-medium lowercase italic text-muted-foreground/60">(optional)</span>
                                </FieldLabel>
                                
                                <div className="grid grid-cols-2 gap-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setValue("lesson_status", "pass", { shouldDirty: true })}
                                  className={cn(
                                      "h-14 rounded-xl border-2 transition-all flex items-center justify-center gap-3",
                                    watch("lesson_status") === "pass"
                                        ? "bg-green-50/50 border-green-500 text-green-700 shadow-sm"
                                        : "bg-background border-border text-muted-foreground hover:border-green-200 hover:bg-green-50/30 hover:text-green-600"
                                  )}
                                >
                                  <div className={cn(
                                      "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
                                      watch("lesson_status") === "pass" ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                                  )}>
                                      <IconCheck className="h-3.5 w-3.5" />
                                  </div>
                                    <span className="font-bold text-xs uppercase tracking-wider">Pass</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setValue("lesson_status", "not yet competent", { shouldDirty: true })}
                                  className={cn(
                                      "h-14 rounded-xl border-2 transition-all flex items-center justify-center gap-3",
                                    watch("lesson_status") === "not yet competent"
                                        ? "bg-amber-50/50 border-amber-500 text-amber-700 shadow-sm"
                                        : "bg-background border-border text-muted-foreground hover:border-amber-200 hover:bg-amber-50/30 hover:text-amber-600"
                                  )}
                                >
                                  <div className={cn(
                                      "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
                                      watch("lesson_status") === "not yet competent" ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                                  )}>
                                      <IconX className="h-3.5 w-3.5" />
                                  </div>
                                    <span className="font-bold text-xs uppercase tracking-wider">NYC</span>
                                </Button>
                              </div>
                              </Field>
                          )}

                          {/* Instructor Comments - PRIMARY */}
                            <Field className="gap-3">
                              <FieldLabel className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <IconMessage className="h-3.5 w-3.5" />
                              Instructor Comments
                              </FieldLabel>
                            <Textarea 
                              {...register("instructor_comments")}
                              placeholder="General debrief notes for the student..."
                                className="min-h-[140px] bg-background border-border focus:ring-2 focus:ring-primary/20 transition-all text-sm rounded-xl"
                            />
                            </Field>

                          {/* Next Steps - SECONDARY */}
                            <Field className="gap-3">
                              <FieldLabel className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <IconNotebook className="h-3.5 w-3.5" />
                              Next Steps
                              </FieldLabel>
                            <Textarea 
                              {...register("focus_next_lesson")}
                              placeholder="What should be the priority next time?"
                                className="min-h-[100px] bg-background border-border focus:ring-2 focus:ring-primary/20 transition-all text-sm rounded-xl"
                              />
                            </Field>

                            {/* Full Debrief - Collapsible Extension */}
                            <Collapsible
                              open={isPerformanceNotesExpanded}
                              onOpenChange={setIsPerformanceNotesExpanded}
                              className="border-t border-border/40 pt-2 mt-2"
                            >
                              <CollapsibleTrigger asChild>
                                <div 
                                  role="button"
                                  tabIndex={0}
                                  className="w-full h-14 px-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-900/30 group transition-all rounded-xl relative overflow-hidden cursor-pointer outline-none"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setIsPerformanceNotesExpanded(!isPerformanceNotesExpanded);
                                    }
                                  }}
                                >
                                  {/* Interaction Hint: Vertical bar */}
                                  <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary/80 scale-y-0 group-hover:scale-y-100 transition-transform origin-center rounded-r-full" />
                                  
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100/80 dark:bg-slate-800/80 border border-border/50 group-hover:border-primary/30 group-hover:bg-primary/5 transition-all">
                                      <IconReportAnalytics className="h-4.5 w-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <div className="text-left">
                                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 group-hover:text-primary/70 transition-colors">
                                        Lesson Details
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                          Full Debrief
                                        </span>
                                        {!isPerformanceNotesExpanded && (
                                          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-muted/60 border-none font-bold uppercase tracking-tight">Optional</Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-medium text-muted-foreground/60 group-hover:text-primary/70 transition-colors hidden sm:inline">
                                      {isPerformanceNotesExpanded ? "Hide details" : "Show more details"}
                                    </span>
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border/40 group-hover:border-primary/30 group-hover:bg-primary/5 transition-all">
                                      <IconChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-transform duration-200", isPerformanceNotesExpanded && "rotate-180")} />
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleTrigger>

                              <CollapsibleContent>
                                <div className="pt-6 space-y-10">
                                  {/* Training Details Section */}
                                  <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                      <div className="h-5 w-1 rounded-full bg-primary/30" />
                                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary/80">
                                        Training Details
                                      </h4>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6">
                                      <Field className="gap-2">
                                        <FieldLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Lesson Highlights</FieldLabel>
                                        <Textarea 
                                          {...register("lesson_highlights")}
                                          placeholder="What went particularly well?"
                                          className="min-h-[100px] bg-background/50 border-border/60 focus:ring-2 focus:ring-primary/20 transition-all text-sm rounded-xl resize-none"
                                        />
                                      </Field>

                                      <Field className="gap-2">
                                        <FieldLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Areas for Improvement</FieldLabel>
                                        <Textarea 
                                          {...register("areas_for_improvement")}
                                          placeholder="What needs more practice?"
                                          className="min-h-[100px] bg-background/50 border-border/60 focus:ring-2 focus:ring-primary/20 transition-all text-sm rounded-xl resize-none"
                                        />
                                      </Field>

                                      <Field className="gap-2">
                                        <FieldLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Airmanship & Decision Making</FieldLabel>
                                        <Textarea 
                                          {...register("airmanship")}
                                          placeholder="Comments on situational awareness, safety mindset, etc."
                                          className="min-h-[100px] bg-background/50 border-border/60 focus:ring-2 focus:ring-primary/20 transition-all text-sm rounded-xl resize-none"
                                        />
                                      </Field>
                                    </div>
                                  </div>

                                  <Separator className="bg-border/30" />

                                  {/* Environment & Safety Section */}
                                  <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                      <div className="h-5 w-1 rounded-full bg-destructive/30" />
                                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-destructive/80">
                                        Environment & Safety
                                      </h4>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                      <Field className="gap-2">
                                        <FieldLabel className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                          <IconCloudStorm className="h-3 w-3" />
                                          Weather Conditions
                                        </FieldLabel>
                                        <Input 
                                          {...register("weather_conditions")}
                                          placeholder="e.g. Calm, Gusty 15kts"
                                          className="h-11 bg-background/50 border-border/60 focus:ring-2 focus:ring-primary/20 transition-all text-sm rounded-xl"
                                        />
                                      </Field>

                                      <Field className="gap-2">
                                        <FieldLabel className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-destructive/80">
                                          <IconAlertCircle className="h-3 w-3" />
                                          Safety Concerns
                                        </FieldLabel>
                                        <Input 
                                          {...register("safety_concerns")}
                                          placeholder="Any safety events?"
                                          className="h-11 bg-background border-destructive/20 focus:ring-2 focus:ring-destructive/20 transition-all text-sm rounded-xl"
                                        />
                                      </Field>
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>

                            {/* Flight Experience - Collapsible Extension */}
                            <Collapsible
                              open={isExperienceExpanded}
                              onOpenChange={setIsExperienceExpanded}
                              className="border-t border-border/40 pt-2 mt-2"
                            >
                              <CollapsibleTrigger asChild>
                                <div 
                                  role="button"
                                  tabIndex={0}
                                  className="w-full h-14 px-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-900/30 group transition-all rounded-xl relative overflow-hidden cursor-pointer outline-none"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setIsExperienceExpanded(!isExperienceExpanded);
                                    }
                                  }}
                                >
                                  {/* Interaction Hint: Vertical bar */}
                                  <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary/80 scale-y-0 group-hover:scale-y-100 transition-transform origin-center rounded-r-full" />

                                  <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100/80 dark:bg-slate-800/80 border border-border/50 group-hover:border-primary/30 group-hover:bg-primary/5 transition-all">
                                      <IconTrophy className="h-4.5 w-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <div className="text-left">
                                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 group-hover:text-primary/70 transition-colors">
                                        Hours & Landings
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                          Flight Experience
                                        </span>
                                        {!isExperienceExpanded && experienceEntries.length > 0 && (
                                          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-muted/60 border-none font-bold uppercase tracking-tight">
                                            {experienceEntries.length} {experienceEntries.length === 1 ? "entry" : "entries"}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-medium text-muted-foreground/60 group-hover:text-primary/70 transition-colors hidden sm:inline">
                                      {isExperienceExpanded ? "Hide log" : "Record time & landings"}
                                    </span>
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border/40 group-hover:border-primary/30 group-hover:bg-primary/5 transition-all">
                                      <IconChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-transform duration-200", isExperienceExpanded && "rotate-180")} />
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleTrigger>

                              <CollapsibleContent>
                                <div className="pt-6">
                                  <div className="rounded-xl border border-border/80 bg-white/60 dark:bg-slate-900/30 p-4 sm:p-5 space-y-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
                                      <div className="space-y-1">
                                        <div className="text-sm font-bold text-foreground flex items-center gap-2">
                                          Log flight experience
                                          {experienceDirty && (
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] font-bold uppercase tracking-wider bg-amber-50/60 dark:bg-amber-900/10 border-amber-200/60 dark:border-amber-900/20 text-amber-700/80 dark:text-amber-400/80 rounded-full h-5 px-2"
                                            >
                                              Unsaved
                                            </Badge>
                                          )}
                                        </div>
                                      </div>

                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addExperienceEntry}
                                        className="h-9 rounded-xl font-bold text-xs"
                                      >
                                        <IconPlus className="h-4 w-4 mr-2" />
                                        Add experience
                                      </Button>
                                    </div>

                                    {(experienceTypesQuery.isLoading || bookingExperienceQuery.isLoading) && (
                                      <div className="py-8 flex items-center justify-center gap-3 text-sm text-muted-foreground">
                                        <IconLoader2 className="h-4 w-4 animate-spin" />
                                        Loading experience…
                                      </div>
                                    )}

                                    {(experienceTypesQuery.isError || bookingExperienceQuery.isError) && (
                                      <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-sm text-destructive flex items-center gap-3">
                                        <IconAlertCircle className="h-4 w-4" />
                                        Failed to load experience.
                                      </div>
                                    )}

                                    {!(experienceTypesQuery.isLoading || bookingExperienceQuery.isLoading) && (
                                      <div className="space-y-4 max-w-2xl">
                                        {experienceEntries.length > 0 ? (
                                          <div className="space-y-4">
                                            <div className="hidden sm:grid sm:grid-cols-[1fr_100px_120px_40px] gap-4 px-1">
                                              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 ml-1">Type</div>
                                              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Value</div>
                                              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Unit</div>
                                              <div />
                                            </div>

                                            <div className="space-y-2">
                                              {experienceEntries.map((entry, idx) => {
                                                const unit = entry.unit ?? "hours"
                                                const valuePlaceholder = unit === "hours" ? "1.0" : "3"
                                                const step = unit === "hours" ? "0.1" : "1"

                                                return (
                                                  <div
                                                    key={idx}
                                                    className="group relative rounded-xl border border-border/40 bg-background/30 hover:bg-background/50 transition-all p-3"
                                                  >
                                                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_120px_40px] gap-4 items-center">
                                                      <div className="space-y-1.5 sm:space-y-0">
                                                        <div className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Type</div>
                                                        <Select
                                                          value={entry.experience_type_id}
                                                          onValueChange={(value) => {
                                                            setExperienceEntries((prev) => {
                                                              const next = [...prev]
                                                              next[idx] = { ...next[idx], experience_type_id: value }
                                                              return next
                                                            })
                                                            setExperienceDirty(true)
                                                          }}
                                                        >
                                                          <SelectTrigger className="h-10 w-full rounded-lg bg-background/50 border-border/60 hover:bg-background transition-colors">
                                                            <SelectValue placeholder="Select type" />
                                                          </SelectTrigger>
                                                          <SelectContent>
                                                            {(experienceTypesQuery.data || [])
                                                              .filter((t) => t.is_active && !t.voided_at)
                                                              .map((t) => (
                                                                <SelectItem key={t.id} value={t.id}>
                                                                  {t.name}
                                                                </SelectItem>
                                                              ))}
                                                          </SelectContent>
                                                        </Select>
                                                      </div>

                                                      <div className="space-y-1.5 sm:space-y-0">
                                                        <div className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Value</div>
                                                        <Input
                                                          value={entry.value}
                                                          onChange={(e) => {
                                                            const v = e.target.value
                                                            setExperienceEntries((prev) => {
                                                              const next = [...prev]
                                                              next[idx] = { ...next[idx], value: v }
                                                              return next
                                                            })
                                                            setExperienceDirty(true)
                                                          }}
                                                          inputMode={unit === "hours" ? "decimal" : "numeric"}
                                                          placeholder={valuePlaceholder}
                                                          type="number"
                                                          step={step}
                                                          min="0"
                                                          className="h-10 w-full rounded-lg tabular-nums bg-background/50 border-border/60 hover:bg-background transition-colors"
                                                        />
                                                      </div>

                                                      <div className="space-y-1.5 sm:space-y-0">
                                                        <div className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Unit</div>
                                                        <Select
                                                          value={unit}
                                                          onValueChange={(value) => {
                                                            setExperienceEntries((prev) => {
                                                              const next = [...prev]
                                                              const nextUnit = value as ExperienceUnit
                                                              const currentValue = next[idx]?.value ?? ""
                                                              const coerced =
                                                                (nextUnit === "count" || nextUnit === "landings") && currentValue
                                                                  ? String(Math.trunc(Number(currentValue)))
                                                                  : currentValue
                                                              next[idx] = { ...next[idx], unit: nextUnit, value: coerced }
                                                              return next
                                                            })
                                                            setExperienceDirty(true)
                                                          }}
                                                        >
                                                          <SelectTrigger className="h-10 w-full rounded-lg bg-background/50 border-border/60 hover:bg-background transition-colors">
                                                            <SelectValue />
                                                          </SelectTrigger>
                                                          <SelectContent>
                                                            <SelectItem value="hours">Hours</SelectItem>
                                                            <SelectItem value="count">Count</SelectItem>
                                                            <SelectItem value="landings">Landings</SelectItem>
                                                          </SelectContent>
                                                        </Select>
                                                      </div>

                                                      <div className="flex items-center justify-end sm:pt-0 pt-2">
                                                        <Button
                                                          type="button"
                                                          variant="ghost"
                                                          onClick={() => {
                                                            setExperienceEntries((prev) => prev.filter((_, i) => i !== idx))
                                                            setExperienceDirty(true)
                                                          }}
                                                          className="h-10 w-10 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                          aria-label="Remove experience entry"
                                                        >
                                                          <IconTrash className="h-4 w-4" />
                                                        </Button>
                                                      </div>

                                                      {(unit === "count" || unit === "landings") && (
                                                        <div className="sm:col-start-2 sm:col-span-2 text-[10px] text-muted-foreground/70 italic px-1">
                                                          Note: Entries must be whole numbers.
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                )
                                              })}
                                            </div>

                                            <Button
                                              type="button"
                                              variant="ghost"
                                              onClick={addExperienceEntry}
                                              className="w-full h-10 border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all rounded-xl text-xs font-bold gap-2"
                                            >
                                              <IconPlus className="h-4 w-4" />
                                              Add another experience entry
                                            </Button>
                                          </div>
                                        ) : (
                                          <div className="py-4 text-center">
                                            <p className="text-xs text-muted-foreground italic">No experience logged for this flight.</p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </FieldSet>

                          {/* Save Debrief Button */}
                          <div className="pt-6 border-t border-border/40 flex flex-col sm:flex-row items-stretch sm:items-center w-full gap-3 sm:justify-end">
                            {lessonProgressExists && (
                              <Button
                                type="button"
                                variant="outline"
                                asChild
                                className="w-full sm:w-auto px-8 min-w-[160px] h-12 rounded-xl font-bold transition-all shadow-sm"
                              >
                                <Link href={`/bookings/${bookingId}/debrief`}>View Debrief</Link>
                              </Button>
                            )}
                            <Button
                              type="button"
                              onClick={async () => {
                                const hadExperienceDirty = experienceDirty
                                const data = {
                                  instructor_comments: watch("instructor_comments"),
                                  focus_next_lesson: watch("focus_next_lesson"),
                                  lesson_highlights: watch("lesson_highlights"),
                                  areas_for_improvement: watch("areas_for_improvement"),
                                  airmanship: watch("airmanship"),
                                  weather_conditions: watch("weather_conditions"),
                                  safety_concerns: watch("safety_concerns"),
                                  lesson_status: watch("lesson_status"),
                                }
                                try {
                                  await saveProgressMutation.mutateAsync(data)
                                  if (hadExperienceDirty) {
                                    await saveExperienceMutation.mutateAsync()
                                  }
                                  toast.success(hadExperienceDirty ? "Debrief & experience saved" : "Debrief saved")
                                } catch (err) {
                                  toast.error(getErrorMessage(err))
                                }
                              }}
                              disabled={saveProgressMutation.isPending || saveExperienceMutation.isPending}
                              className="w-full sm:w-auto px-8 min-w-[160px] h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-md"
                            >
                              {saveProgressMutation.isPending || saveExperienceMutation.isPending ? (
                                <>
                                  <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <IconCheck className="h-4 w-4 mr-2" />
                                  Save Debrief
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                    </Card>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>

    {/* Flight Correction Dialog */}
    {booking && isApproved && (role === 'owner' || role === 'admin') && (
      <FlightCorrectionDialog
        booking={booking}
        open={isCorrectionDialogOpen}
        onOpenChange={closeCorrectionDialog}
        onCorrect={correctFlight}
        isSubmitting={isCorrecting}
      />
    )}
    </>
  )
}
