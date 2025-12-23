"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import * as Tabs from "@radix-ui/react-tabs"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { toast } from "sonner"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import type { InstructorWithUser } from "@/lib/types/instructors"
import type { InstructorCategory } from "@/lib/types/instructor-categories"
import { CalendarIcon } from "lucide-react"
import {
  IconArrowLeft,
  IconUser,
  IconMail,
  IconBadge,
  IconClock,
  IconNotes,
  IconPhone,
  IconBriefcase,
  IconCertificate,
  IconShieldCheck,
  IconInfoCircle,
  IconRotateClockwise,
  IconDeviceFloppy,
} from "@tabler/icons-react"
import { useIsMobile } from "@/hooks/use-mobile"

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "deactivated", label: "Deactivated" },
  { value: "suspended", label: "Suspended" },
] as const

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "casual", label: "Casual" },
  { value: "contractor", label: "Contractor" },
] as const

const employmentTypeSchema = z.enum([
  "full_time",
  "part_time",
  "casual",
  "contractor",
])

const statusSchema = z.enum(["active", "inactive", "deactivated", "suspended"])

const detailsSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  rating: z.string().max(255).nullable().optional(),
  instructor_check_due_date: z.string().nullable().optional(),
  instrument_check_due_date: z.string().nullable().optional(),
  class_1_medical_due_date: z.string().nullable().optional(),
  employment_type: employmentTypeSchema.optional(),
  is_actively_instructing: z.boolean(),
  status: statusSchema,
  night_removal: z.boolean(),
  aerobatics_removal: z.boolean(),
  multi_removal: z.boolean(),
  tawa_removal: z.boolean(),
  ifr_removal: z.boolean(),
})

type DetailsFormValues = z.infer<typeof detailsSchema>

const notesSchema = z.object({
  notes: z.string().nullable().optional(),
})

type NotesFormValues = z.infer<typeof notesSchema>

const tabItems = [
  { id: "details", label: "Details", icon: IconUser },
  { id: "history", label: "History", icon: IconClock },
  { id: "notes", label: "Notes", icon: IconNotes },
]

type CertificationFieldName =
  | "instructor_check_due_date"
  | "instrument_check_due_date"
  | "class_1_medical_due_date"

const CERTIFICATION_FIELDS: Array<{ name: CertificationFieldName; label: string }> = [
  { name: "instructor_check_due_date", label: "Instructor check due" },
  { name: "instrument_check_due_date", label: "Instrument check due" },
  { name: "class_1_medical_due_date", label: "Class 1 medical due" },
]

type EndorsementFieldName =
  | "night_removal"
  | "aerobatics_removal"
  | "multi_removal"
  | "tawa_removal"
  | "ifr_removal"

const ENDORSEMENT_FIELDS: Array<{ name: EndorsementFieldName; label: string }> = [
  { name: "night_removal", label: "Night removal" },
  { name: "aerobatics_removal", label: "Aerobatics removal" },
  { name: "multi_removal", label: "Multi removal" },
  { name: "tawa_removal", label: "TAWA removal" },
  { name: "ifr_removal", label: "IFR removal" },
]

const statusBadgeClass = (status: string) => {
  if (status === "active") return "bg-green-100 text-green-700"
  if (status === "inactive") return "bg-yellow-100 text-amber-700"
  if (status === "deactivated" || status === "suspended") return "bg-red-100 text-red-700"
  return "bg-zinc-200 text-zinc-600"
}

async function fetchInstructor(id: string): Promise<InstructorWithUser> {
  const response = await fetch(`/api/instructors/${id}`)

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized")
    }
    if (response.status === 403) {
      throw new Error("Forbidden: Insufficient permissions")
    }
    if (response.status === 404) {
      throw new Error("Instructor not found")
    }
    throw new Error("Failed to fetch instructor")
  }

  const payload = await response.json()
  return payload.instructor as InstructorWithUser
}

async function fetchInstructorCategories(): Promise<InstructorCategory[]> {
  const response = await fetch("/api/instructor-categories")

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized")
    }
    if (response.status === 403) {
      throw new Error("Forbidden: Insufficient permissions")
    }
    throw new Error("Failed to load instructor ratings")
  }

  const payload = await response.json()
  return payload.categories ?? []
}

function getUserInitials(
  firstName: string | null,
  lastName: string | null,
  email: string
): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase()
  }
  if (firstName) {
    return firstName.substring(0, 2).toUpperCase()
  }
  if (lastName) {
    return lastName.substring(0, 2).toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
}

function buildDetailsFormValues(instructor: InstructorWithUser): DetailsFormValues {
  return {
    first_name: instructor.user.first_name ?? "",
    last_name: instructor.user.last_name ?? "",
    rating: instructor.rating ?? null,
    instructor_check_due_date: instructor.instructor_check_due_date ?? null,
    instrument_check_due_date: instructor.instrument_check_due_date ?? null,
    class_1_medical_due_date: instructor.class_1_medical_due_date ?? null,
    employment_type: instructor.employment_type ?? "full_time",
    is_actively_instructing: instructor.is_actively_instructing,
    status: instructor.status || "active",
    night_removal: Boolean(instructor.night_removal),
    aerobatics_removal: Boolean(instructor.aerobatics_removal),
    multi_removal: Boolean(instructor.multi_removal),
    tawa_removal: Boolean(instructor.tawa_removal),
    ifr_removal: Boolean(instructor.ifr_removal),
  }
}

function buildNotesFormValues(instructor: InstructorWithUser): NotesFormValues {
  return {
    notes: instructor.notes ?? "",
  }
}

interface StickyFormActionsProps {
  formId: string
  isDirty: boolean
  isSaving?: boolean
  onUndo: () => void
  message: string
  undoLabel?: string
  saveLabel?: string
}

function StickyFormActions({
  formId,
  isDirty,
  isSaving,
  onUndo,
  message,
  undoLabel = "Undo changes",
  saveLabel = "Save",
}: StickyFormActionsProps) {
  const isMobile = useIsMobile()
  const [sidebarLeft, setSidebarLeft] = React.useState(0)

  React.useEffect(() => {
    if (isMobile) {
      setSidebarLeft(0)
      return
    }

    const updateSidebarPosition = () => {
      const sidebarGap = document.querySelector('[data-slot="sidebar-gap"]')
      if (sidebarGap) {
        const computedWidth = window.getComputedStyle(sidebarGap).width
        const width = parseFloat(computedWidth) || 0
        setSidebarLeft(width)
        return
      }

      const sidebar = document.querySelector('[data-slot="sidebar"]')
      if (!sidebar) {
        setSidebarLeft(0)
        return
      }

      const state = sidebar.getAttribute("data-state")
      const collapsible = sidebar.getAttribute("data-collapsible")

      if (state === "collapsed") {
        if (collapsible === "icon") {
          setSidebarLeft(48)
        } else {
          setSidebarLeft(0)
        }
        return
      }

      const root = document.documentElement
      const sidebarWidth = root.style.getPropertyValue("--sidebar-width")
      if (sidebarWidth) {
        const match = sidebarWidth.match(/calc\(var\(--spacing\)\s*\*\s*(\d+)\)/)
        if (match) {
          const multiplier = parseInt(match[1], 10)
          setSidebarLeft(multiplier * 4)
        } else {
          setSidebarLeft(288)
        }
      } else {
        setSidebarLeft(288)
      }
    }

    updateSidebarPosition()

    window.addEventListener("resize", updateSidebarPosition)
    const observer = new MutationObserver(updateSidebarPosition)
    const sidebar = document.querySelector('[data-slot="sidebar"]')
    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ["data-state"] })
    }

    return () => {
      window.removeEventListener("resize", updateSidebarPosition)
      observer.disconnect()
    }
  }, [isMobile])

  if (!isDirty) {
    return null
  }

  const finalSaveLabel = isSaving ? "Saving…" : saveLabel

  return (
    <div
      className="fixed bottom-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl"
      style={{
        left: isMobile ? 0 : `${sidebarLeft}px`,
        right: 0,
        zIndex: 50,
      }}
    >
      <div
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{message}</p>
          <div className="flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onUndo}
              disabled={isSaving}
              className={`h-12 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium ${
                isMobile ? "flex-1 max-w-[200px]" : "px-8 min-w-[160px]"
              }`}
            >
              <IconRotateClockwise className="h-4 w-4 mr-2" />
              {undoLabel}
            </Button>
            <Button
              type="submit"
              form={formId}
              size="lg"
              disabled={isSaving}
              className={`h-12 bg-slate-700 hover:bg-slate-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all ${
                isMobile ? "flex-1 max-w-[200px]" : "px-8 min-w-[160px]"
              }`}
            >
              <IconDeviceFloppy className="h-4 w-4 mr-2" />
              {finalSaveLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InstructorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const rawInstructorId = params?.id
  const instructorId = Array.isArray(rawInstructorId) ? rawInstructorId[0] : rawInstructorId
  const [selectedTab, setSelectedTab] = React.useState("details")
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const [showScrollLeft, setShowScrollLeft] = React.useState(false)
  const [showScrollRight, setShowScrollRight] = React.useState(false)

  // Update underline position when tab changes
  React.useEffect(() => {
    const activeTabElement = tabRefs.current[selectedTab]
    const tabsList = tabsListRef.current
    
    if (activeTabElement && tabsList) {
      const tabsListRect = tabsList.getBoundingClientRect()
      const activeTabRect = activeTabElement.getBoundingClientRect()
      
      setUnderlineStyle({
        left: activeTabRect.left - tabsListRect.left,
        width: activeTabRect.width
      })

      // Scroll active tab into view on mobile/tablet
      if (window.innerWidth < 768) {
        const scrollLeft = tabsList.scrollLeft
        const tabLeft = activeTabRect.left - tabsListRect.left
        const tabWidth = activeTabRect.width
        const containerWidth = tabsListRect.width
        const targetScroll = scrollLeft + tabLeft - (containerWidth / 2) + (tabWidth / 2)
        
        tabsList.scrollTo({
          left: Math.max(0, targetScroll),
          behavior: 'smooth'
        })
      }
    }
  }, [selectedTab])

  // Check scroll position for fade indicators
  React.useEffect(() => {
    const tabsList = tabsListRef.current
    if (!tabsList) return

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = tabsList
      setShowScrollLeft(scrollLeft > 0)
      setShowScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
    }

    checkScroll()
    tabsList.addEventListener('scroll', checkScroll)
    window.addEventListener('resize', checkScroll)

    return () => {
      tabsList.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [selectedTab])

  const queryClient = useQueryClient()
  const detailsFormId = "instructor-details-form"
  const notesFormId = "instructor-notes-form"
  const [isSavingDetails, setIsSavingDetails] = React.useState(false)
  const [isSavingNotes, setIsSavingNotes] = React.useState(false)

  const {
    data: instructor,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["instructor", instructorId],
    queryFn: () => {
      if (!instructorId) {
        throw new Error("Instructor ID is missing")
      }
      return fetchInstructor(instructorId)
    },
    enabled: Boolean(instructorId),
  })

  const {
    data: instructorCategories = [],
    isLoading: isLoadingInstructorCategories,
    isError: hasInstructorCategoriesError,
  } = useQuery({
    queryKey: ["instructorCategories"],
    queryFn: fetchInstructorCategories,
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { isDirty, errors },
  } = useForm<DetailsFormValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: instructor ? buildDetailsFormValues(instructor) : undefined,
    mode: "onBlur",
  })

  const {
    register: registerNotes,
    handleSubmit: handleSubmitNotes,
    reset: resetNotes,
    formState: { isDirty: notesDirty },
  } = useForm<NotesFormValues>({
    resolver: zodResolver(notesSchema),
    defaultValues: instructor ? buildNotesFormValues(instructor) : undefined,
  })

  React.useEffect(() => {
    if (instructor) {
      reset(buildDetailsFormValues(instructor))
      resetNotes(buildNotesFormValues(instructor))
    }
  }, [instructor, reset, resetNotes])

  const handleResetDetails = React.useCallback(() => {
    if (instructor) {
      reset(buildDetailsFormValues(instructor))
    }
  }, [instructor, reset])

  const handleResetNotes = React.useCallback(() => {
    if (instructor) {
      resetNotes(buildNotesFormValues(instructor))
    }
  }, [instructor, resetNotes])

  const onSave = React.useCallback(
    async (data: DetailsFormValues) => {
      if (!instructor) return
      setIsSavingDetails(true)
      try {
        const res = await fetch(`/api/instructors/${instructor.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: data.first_name,
            last_name: data.last_name,
            rating: data.rating,
            instructor_check_due_date: data.instructor_check_due_date,
            instrument_check_due_date: data.instrument_check_due_date,
            class_1_medical_due_date: data.class_1_medical_due_date,
            employment_type: data.employment_type,
            is_actively_instructing: data.is_actively_instructing,
            status: data.status,
            night_removal: data.night_removal,
            aerobatics_removal: data.aerobatics_removal,
            multi_removal: data.multi_removal,
            tawa_removal: data.tawa_removal,
            ifr_removal: data.ifr_removal,
          }),
        })

        const payload = await res.json().catch(() => null)
        if (!res.ok) {
          const message = payload?.error || "Failed to save instructor"
          throw new Error(message)
        }

        const updatedInstructor = payload?.instructor as InstructorWithUser
        if (!updatedInstructor) {
          throw new Error("Instructor update response was empty")
        }
        toast.success("Instructor updated")
        reset(buildDetailsFormValues(updatedInstructor))
        resetNotes(buildNotesFormValues(updatedInstructor))
        queryClient.setQueryData(["instructor", instructorId], updatedInstructor)
        queryClient.invalidateQueries({ queryKey: ["instructors"] })
        } catch (err) {
          let message = "Failed to save instructor"
          if (err instanceof Error) message = err.message
          toast.error(message)
        } finally {
          setIsSavingDetails(false)
        }
    },
    [instructor, queryClient, instructorId, reset, resetNotes]
  )

  const onSaveNotes = React.useCallback(
    async (data: NotesFormValues) => {
      if (!instructor) return
      setIsSavingNotes(true)
      try {
        const res = await fetch(`/api/instructors/${instructor.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: data.notes || null,
          }),
        })

        const payload = await res.json().catch(() => null)
        if (!res.ok) {
          const message = payload?.error || "Failed to save notes"
          throw new Error(message)
        }

        const updatedInstructor = payload?.instructor as InstructorWithUser
        if (!updatedInstructor) {
          throw new Error("Instructor update response was empty")
        }
        toast.success("Notes saved")
        resetNotes(buildNotesFormValues(updatedInstructor))
        queryClient.setQueryData(["instructor", instructorId], updatedInstructor)
        } catch (err) {
          let message = "Failed to save notes"
          if (err instanceof Error) message = err.message
          toast.error(message)
        } finally {
          setIsSavingNotes(false)
        }
    },
    [instructor, queryClient, instructorId, resetNotes]
  )

  if (isLoading || !instructor) {
    return (
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading instructor...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (isError) {
    return (
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">
              {(error as Error)?.message || "Failed to load instructor"}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const initials = getUserInitials(
    instructor.user.first_name,
    instructor.user.last_name,
    instructor.user.email
  )

  const fullName = [instructor.user.first_name, instructor.user.last_name]
    .filter(Boolean)
    .join(" ")
  const isActive = instructor.user.is_active

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="flex-1 mx-auto max-w-6xl w-full px-4 sm:px-6 lg:px-8 py-8">
            <Link
              href="/staff"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <IconArrowLeft className="w-4 h-4" />
              Back to Staff
            </Link>

            <Card className="mb-6 shadow-sm border border-border/50 bg-card">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-20 w-20 rounded-full bg-gray-100 border-0">
                      <AvatarFallback className="bg-gray-100 text-gray-600 text-xl font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-bold text-gray-900">
                          {fullName || instructor.user.email}
                        </h1>
                        <Badge className={`rounded-md px-2 py-1 text-xs font-medium ${statusBadgeClass(instructor.status)}`}>
                          {instructor.status.charAt(0).toUpperCase() + instructor.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <IconMail className="w-3 h-3" />
                          {instructor.user.email}
                        </span>
                        {instructor.user.phone && (
                          <span className="flex items-center gap-1">
                            <IconPhone className="w-3 h-3" />
                            {instructor.user.phone}
                          </span>
                        )}
                        {instructor.hire_date && (
                          <span>Hired {format(new Date(instructor.hire_date), "dd MMM yyyy")}</span>
                        )}
                        {instructor.rating_category?.name && (
                          <span className="flex items-center gap-1">
                            <IconCertificate className="w-3 h-3" />
                            Instructor category:&nbsp;{instructor.rating_category.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Badge className={`rounded-md px-3 py-1 text-xs font-semibold ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {isActive ? "Account Active" : "Account Inactive"}
                    </Badge>
                    <Button
                      variant="outline"
                      onClick={() => router.push("/staff")}
                      className="w-full sm:w-auto"
                    >
                      Staff list
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border border-border/50 bg-card">
              <CardContent className="p-0">
                <Tabs.Root
                  value={selectedTab}
                  onValueChange={setSelectedTab}
                  className="w-full flex flex-col"
                >
                  <div className="w-full border-b border-gray-200 bg-white relative">
                    {/* Mobile: Simple Tab Switcher */}
                    <div className="md:hidden px-4 pt-3 pb-3">
                      <Select value={selectedTab} onValueChange={setSelectedTab}>
                        <SelectTrigger className="w-full h-11 border-2 border-gray-300 hover:border-indigo-400 focus:border-indigo-500">
                          <SelectValue>
                            {(() => {
                              const activeTabItem = tabItems.find(t => t.id === selectedTab)
                              const Icon = activeTabItem?.icon || IconUser
                              return (
                                <div className="flex items-center gap-2">
                                  <Icon className="w-4 h-4 text-indigo-600" />
                                  <span className="font-medium">{activeTabItem?.label || "Select tab"}</span>
                                </div>
                              )
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {tabItems.map((tab) => {
                            const Icon = tab.icon
                            const isActive = selectedTab === tab.id
                            return (
                              <SelectItem 
                                key={tab.id} 
                                value={tab.id}
                                className={isActive ? "bg-indigo-50" : ""}
                              >
                                <div className="flex items-center gap-2">
                                  <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-gray-500"}`} />
                                  <span className={isActive ? "font-semibold text-indigo-900" : ""}>
                                    {tab.label}
                                  </span>
                                </div>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Desktop: Horizontal scrollable tabs */}
                    <div className="hidden md:flex items-center px-6 pt-2 relative">
                      {/* Left fade gradient */}
                      {showScrollLeft && (
                        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
                      )}
                      {/* Right fade gradient */}
                      {showScrollRight && (
                        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                      )}
                      <div className="flex items-center w-full overflow-x-auto scrollbar-hide scroll-smooth">
                        <Tabs.List
                          ref={tabsListRef}
                          className="flex flex-row gap-1 min-h-[48px] relative min-w-max"
                          aria-label="Instructor tabs"
                        >
                          {/* Animated underline */}
                          <div
                            className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                            style={{
                              left: `${underlineStyle.left}px`,
                              width: `${underlineStyle.width}px`,
                            }}
                          />
                          {tabItems.map((tab) => {
                            const Icon = tab.icon
                            return (
                              <Tabs.Trigger
                                key={tab.id}
                                ref={(el) => { tabRefs.current[tab.id] = el }}
                                value={tab.id}
                                className="inline-flex items-center gap-2 px-4 py-3 pb-1 text-base font-medium border-b-2 border-transparent transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 cursor-pointer data-[state=active]:text-indigo-800 data-[state=inactive]:text-gray-500 hover:text-indigo-600 whitespace-nowrap flex-shrink-0 min-h-[48px] min-w-[44px] touch-manipulation active:bg-gray-50"
                                style={{ background: "none", boxShadow: "none", borderRadius: 0 }}
                                aria-label={`${tab.label} tab`}
                              >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                <span>{tab.label}</span>
                              </Tabs.Trigger>
                            )
                          })}
                        </Tabs.List>
                      </div>
                    </div>
                  </div>
                  <div className="w-full p-4 sm:p-6">
                    <Tabs.Content value="details">
                      <form
                        id={detailsFormId}
                        onSubmit={handleSubmit(onSave)}
                        className="space-y-8 pb-32"
                      >
                        {/* Profile & Employment Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Personal Profile */}
                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm">
                            <h3 className="flex items-center gap-2 text-base font-bold mb-5 text-gray-900 tracking-tight">
                              <IconUser className="w-5 h-5 text-indigo-600" />
                              Personal Profile
                            </h3>
                            <div className="grid grid-cols-1 gap-5">
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">First name</label>
                                <Input 
                                  {...register("first_name")} 
                                  placeholder="First name"
                                  className="bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
                                />
                                {errors.first_name && (
                                  <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.first_name.message}</p>
                                )}
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Last name</label>
                                <Input 
                                  {...register("last_name")} 
                                  placeholder="Last name"
                                  className="bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
                                />
                                {errors.last_name && (
                                  <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.last_name.message}</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Employment Details */}
                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm">
                            <h3 className="flex items-center gap-2 text-base font-bold mb-5 text-gray-900 tracking-tight">
                              <IconBriefcase className="w-5 h-5 text-indigo-600" />
                              Employment
                            </h3>
                            <div className="grid grid-cols-1 gap-5">
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Employment type</label>
                                <Select
                                  value={watch("employment_type")}
                                  onValueChange={(val) => setValue("employment_type", val as DetailsFormValues["employment_type"], { shouldDirty: true })}
                                >
                                  <SelectTrigger className="w-full bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EMPLOYMENT_TYPES.map((type) => (
                                      <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {errors.employment_type && (
                                  <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.employment_type.message}</p>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
                                  <Select
                                    value={watch("status")}
                                    onValueChange={(val) => setValue("status", val as DetailsFormValues["status"], { shouldDirty: true })}
                                  >
                                    <SelectTrigger className="w-full bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all">
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STATUS_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex flex-col justify-end pb-2">
                                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-3 cursor-pointer select-none">
                                    <Switch
                                      checked={watch("is_actively_instructing")}
                                      onCheckedChange={(val) => setValue("is_actively_instructing", val, { shouldDirty: true })}
                                    />
                                    Actively instructing
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Qualifications Section */}
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm">
                          <h3 className="flex items-center gap-2 text-base font-bold mb-5 text-gray-900 tracking-tight">
                            <IconCertificate className="w-5 h-5 text-indigo-600" />
                            Qualifications & Certification
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="lg:col-span-1">
                              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Instructor Rating</label>
                                <Controller
                                  name="rating"
                                  control={control}
                                  render={({ field }) => {
                                    const selectedValue = field.value ?? undefined
                                    return (
                                      <Select
                                        value={selectedValue}
                                        onValueChange={(value) =>
                                          field.onChange(value === "unassigned" ? null : value)
                                        }
                                        disabled={isLoadingInstructorCategories}
                                      >
                                        <SelectTrigger className="w-full bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all">
                                          <SelectValue
                                            placeholder={
                                              isLoadingInstructorCategories
                                                ? "Loading ratings…"
                                                : "Select rating"
                                            }
                                          />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="unassigned">
                                            Unassigned
                                          </SelectItem>
                                        {instructorCategories.map((category) => (
                                          <SelectItem key={category.id} value={category.id}>
                                            {category.name}
                                          </SelectItem>
                                        ))}
                                        </SelectContent>
                                      </Select>
                                    )
                                  }}
                                />
                              {errors.rating && (
                                <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.rating.message}</p>
                              )}
                              {hasInstructorCategoriesError && (
                                <p className="text-xs text-red-500 mt-1.5 font-medium">
                                  Unable to load instructor ratings
                                </p>
                              )}
                            </div>
                            {CERTIFICATION_FIELDS.map((field) => (
                              <div key={field.name}>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                  {field.label}
                                </label>
                                <Controller
                                  name={field.name}
                                  control={control}
                                  render={({ field: controllerField }) => {
                                    const selected = controllerField.value
                                      ? new Date(controllerField.value)
                                      : undefined
                                    return (
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant="outline"
                                            className={cn(
                                              "w-full justify-start text-left font-normal bg-white border-gray-200 hover:bg-gray-50 focus:border-indigo-500 focus:ring-indigo-500 transition-all",
                                              !selected && "text-muted-foreground"
                                            )}
                                            type="button"
                                          >
                                            <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                                            {selected
                                              ? format(selected, "dd MMM yyyy")
                                              : "Pick a date"}
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar
                                            mode="single"
                                            selected={selected}
                                            onSelect={(date) =>
                                              controllerField.onChange(date ? format(date, "yyyy-MM-dd") : null)
                                            }
                                            initialFocus
                                          />
                                        </PopoverContent>
                                      </Popover>
                                    )
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Endorsements Section */}
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm">
                          <h3 className="flex items-center gap-2 text-base font-bold mb-5 text-gray-900 tracking-tight">
                            <IconShieldCheck className="w-5 h-5 text-indigo-600" />
                            Instructor Endorsements
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {ENDORSEMENT_FIELDS.map((endorsement) => (
                              <div
                                key={endorsement.name}
                                className="flex items-center justify-between gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-indigo-200 transition-colors"
                              >
                                <span className="text-sm font-medium text-gray-700">{endorsement.label}</span>
                                <Switch
                                  checked={watch(endorsement.name)}
                                  onCheckedChange={(val) =>
                                    setValue(endorsement.name, val, { shouldDirty: true })
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* System Metadata Section */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-gray-50/50 border border-gray-100 rounded-lg text-[10px] uppercase tracking-wider font-bold text-gray-400">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                              <IconInfoCircle className="w-3.5 h-3.5" />
                              Created: {format(new Date(instructor.created_at), "dd MMM yyyy HH:mm")}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <IconClock className="w-3.5 h-3.5" />
                              Last Updated: {format(new Date(instructor.updated_at), "dd MMM yyyy HH:mm")}
                            </span>
                          </div>
                          <div>
                            Instructor ID: {instructor.id.slice(0, 8)}...
                          </div>
                        </div>
                      </form>
                    </Tabs.Content>
                    <Tabs.Content value="history">
                      <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm mb-4">
                          <IconClock className="h-6 w-6 text-gray-400" />
                        </div>
                        <h4 className="text-base font-semibold text-gray-900 mb-1">No Activity Yet</h4>
                        <p className="text-sm text-gray-500 max-w-xs mx-auto">
                          Activity history for this instructor will appear here as bookings and logs are created.
                        </p>
                      </div>
                    </Tabs.Content>
                    <Tabs.Content value="notes">
                      <form
                        id={notesFormId}
                        onSubmit={handleSubmitNotes(onSaveNotes)}
                        className="space-y-6 pb-32"
                      >
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm">
                          <h3 className="flex items-center gap-2 text-base font-bold mb-5 text-gray-900 tracking-tight">
                            <IconNotes className="w-5 h-5 text-indigo-600" />
                            Instructor Notes
                          </h3>
                          <Textarea
                            {...registerNotes("notes")}
                            className="min-h-[250px] bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all resize-y"
                            placeholder="Add internal notes about this instructor, performance reviews, or specific requirements..."
                          />
                          <p className="mt-3 text-xs text-muted-foreground italic">
                            These notes are only visible to staff and administrators.
                          </p>
                        </div>
                      </form>
                    </Tabs.Content>
                  </div>
                </Tabs.Root>
              </CardContent>
            </Card>
            {selectedTab === "details" && (
              <StickyFormActions
                formId={detailsFormId}
                isDirty={isDirty}
                isSaving={isSavingDetails}
                onUndo={handleResetDetails}
                message="You have unsaved instructor details."
                saveLabel="Save details"
              />
            )}
            {selectedTab === "notes" && (
              <StickyFormActions
                formId={notesFormId}
                isDirty={notesDirty}
                isSaving={isSavingNotes}
                onUndo={handleResetNotes}
                message="You have unsaved notes."
                saveLabel="Save notes"
              />
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

