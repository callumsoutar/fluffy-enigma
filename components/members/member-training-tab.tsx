"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { format } from "date-fns"
import { GraduationCap, Target, Plus, BookOpen, Plane, FileText, CheckCircle2, User, ChevronDown, ChevronUp, MessageSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import * as Tabs from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

import type { Exam, ExamResult, StudentSyllabusEnrollment, Syllabus } from "@/lib/types/database"
import type { AircraftType } from "@/lib/types/aircraft"
import type { InstructorWithUser } from "@/lib/types/instructors"
import { createSyllabusEnrollmentSchema, logExamResultSchema } from "@/lib/validation/training"

type EnrollmentWithSyllabus = StudentSyllabusEnrollment & {
  syllabus?: Pick<Syllabus, "id" | "name" | "description" | "is_active" | "voided_at"> | null
  aircraft_types?: Pick<AircraftType, "id" | "name"> | null
}

type ExamResultWithExam = ExamResult & {
  exam?: {
    id: string
    name: string
    passing_score: number
    syllabus_id: string | null
    syllabus?: { id: string; name: string } | null
  } | null
}

type TrainingResponse = {
  training: {
    examResults: ExamResultWithExam[]
    enrollments: EnrollmentWithSyllabus[]
    syllabi: Syllabus[]
  }
}

async function fetchMemberTraining(memberId: string): Promise<TrainingResponse> {
  const res = await fetch(`/api/members/${memberId}/training`)
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(payload?.error || "Failed to load training data")
  }
  return (await res.json()) as TrainingResponse
}

async function fetchInstructors(): Promise<InstructorWithUser[]> {
  const res = await fetch("/api/instructors")
  if (!res.ok) return []
  const data = await res.json()
  return data.instructors || []
}

async function fetchAircraftTypes(): Promise<AircraftType[]> {
  const res = await fetch("/api/aircraft-types")
  if (!res.ok) return []
  const data = await res.json()
  return data.aircraft_types || []
}

async function fetchExams(syllabusId?: string): Promise<Exam[]> {
  const url = syllabusId ? `/api/exams?syllabus_id=${syllabusId}` : "/api/exams"
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return data.exams || []
}

type EnrollFormValues = z.infer<typeof createSyllabusEnrollmentSchema>
type LogExamFormValues = z.infer<typeof logExamResultSchema>

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  try {
    return format(new Date(value), "MMM d, yyyy")
  } catch {
    return "-"
  }
}

function enrollmentStatusLabel(enrollment: StudentSyllabusEnrollment) {
  const status = (enrollment.status || "").toLowerCase()
  if (status === "active") return "Active"
  if (status === "completed" || enrollment.completion_date) return "Completed"
  if (status === "withdrawn") return "Withdrawn"
  return enrollment.status || "Unknown"
}

function enrollmentStatusClasses(label: string) {
  const normalized = label.toLowerCase()
  if (normalized === "active") return "bg-emerald-100 text-emerald-700 border-0"
  if (normalized === "completed") return "bg-slate-100 text-slate-700 border-0"
  if (normalized === "withdrawn") return "bg-amber-100 text-amber-700 border-0"
  return "bg-gray-100 text-gray-700 border-0"
}

function resultBadgeClasses(result: "PASS" | "FAIL") {
  return result === "PASS"
    ? "bg-emerald-100 text-emerald-700 border-0"
    : "bg-rose-100 text-rose-700 border-0"
}

interface EnrollmentCardProps {
  enrollment: EnrollmentWithSyllabus
  instructors: InstructorWithUser[]
  aircraftTypes: AircraftType[]
  onUpdate: (enrollmentId: string, values: Partial<EnrollFormValues>) => Promise<void>
}

function EnrollmentCard({ enrollment, instructors, aircraftTypes, onUpdate }: EnrollmentCardProps) {
  const [primaryInstructorId, setPrimaryInstructorId] = React.useState<string>(enrollment.primary_instructor_id || "none")
  const [aircraftTypeId, setAircraftTypeId] = React.useState<string>(enrollment.aircraft_type || "none")
  const [enrolledAt, setEnrolledAt] = React.useState<string>(enrollment.enrolled_at ? format(new Date(enrollment.enrolled_at), "yyyy-MM-dd") : "")
  const [notes, setNotes] = React.useState<string>(enrollment.notes || "")
  const [showNotes, setShowNotes] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)

  // Sync state with props when data is refetched
  React.useEffect(() => {
    setPrimaryInstructorId(enrollment.primary_instructor_id || "none")
    setAircraftTypeId(enrollment.aircraft_type || "none")
    setEnrolledAt(enrollment.enrolled_at ? format(new Date(enrollment.enrolled_at), "yyyy-MM-dd") : "")
    setNotes(enrollment.notes || "")
  }, [enrollment.primary_instructor_id, enrollment.aircraft_type, enrollment.notes, enrollment.enrolled_at])

  const isDirty = 
    (primaryInstructorId === "none" ? null : primaryInstructorId) !== enrollment.primary_instructor_id ||
    (aircraftTypeId === "none" ? null : aircraftTypeId) !== enrollment.aircraft_type ||
    enrolledAt !== (enrollment.enrolled_at ? format(new Date(enrollment.enrolled_at), "yyyy-MM-dd") : "") ||
    notes !== (enrollment.notes || "")

  const handleSave = async () => {
    setIsUpdating(true)
    try {
      await onUpdate(enrollment.id, {
        primary_instructor_id: primaryInstructorId === "none" ? null : primaryInstructorId,
        aircraft_type: aircraftTypeId === "none" ? null : aircraftTypeId,
        enrolled_at: enrolledAt || null,
        notes: notes || null,
      })
      toast.success("Enrollment updated")
    } catch {
      toast.error("Failed to update enrollment")
    } finally {
      setIsUpdating(false)
    }
  }

  const label = enrollmentStatusLabel(enrollment)

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 shrink-0 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mt-0.5">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-1">
                <h4 className="text-base font-bold text-gray-900 tracking-tight leading-tight">
                  {enrollment.syllabus?.name || "Syllabus"}
                </h4>
                <Badge className={cn("rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide", enrollmentStatusClasses(label))}>
                  {label}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Enrolled {formatDateTime(enrollment.enrolled_at)}
                {enrollment.completion_date && (
                  <span className="ml-1.5 pl-1.5 border-l border-gray-200">
                    Completed {formatDateTime(enrollment.completion_date)}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto mt-1 sm:mt-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNotes(!showNotes)}
              className="h-9 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50/50 flex items-center gap-1.5 px-2 rounded-lg transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 opacity-70" />
              <span>{showNotes ? "Hide Notes" : notes ? "Edit Notes" : "Add Notes"}</span>
              {showNotes ? <ChevronUp className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
            </Button>

            {isDirty && (
              <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                <Button
                  size="sm"
                  onClick={() => {
                    setPrimaryInstructorId(enrollment.primary_instructor_id || "none")
                    setAircraftTypeId(enrollment.aircraft_type || "none")
                    setEnrolledAt(enrollment.enrolled_at ? format(new Date(enrollment.enrolled_at), "yyyy-MM-dd") : "")
                    setNotes(enrollment.notes || "")
                  }}
                  variant="ghost"
                  className="h-9 text-xs text-gray-400 hover:text-gray-700 px-2 font-medium"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isUpdating}
                  className="bg-[#6564db] hover:bg-[#232ed1] text-white shadow-sm h-9 px-4 rounded-xl text-xs font-bold whitespace-nowrap"
                >
                  {isUpdating ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 pt-4 border-t border-gray-200">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Primary Instructor
            </label>
            <Select value={primaryInstructorId} onValueChange={setPrimaryInstructorId}>
              <SelectTrigger className="w-full h-10 bg-white text-sm border-gray-200 focus:ring-0">
                <SelectValue placeholder="Assign Instructor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-sm italic text-gray-400">No instructor assigned</SelectItem>
                {instructors.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id} className="text-sm">
                    {inst.user.first_name} {inst.user.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Primary Aircraft Type
            </label>
            <Select value={aircraftTypeId} onValueChange={setAircraftTypeId}>
              <SelectTrigger className="w-full h-10 bg-white text-sm border-gray-200 focus:ring-0">
                <SelectValue placeholder="Assign Aircraft Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-sm italic text-gray-400">No aircraft type assigned</SelectItem>
                {aircraftTypes.map((at) => (
                  <SelectItem key={at.id} value={at.id} className="text-sm">
                    {at.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Enrollment Date
            </label>
            <Input
              type="date"
              value={enrolledAt}
              onChange={(e) => setEnrolledAt(e.target.value)}
              className="w-full h-10 bg-white text-sm border-gray-200 focus-visible:ring-0"
            />
          </div>
        </div>

        {showNotes && (
          <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <label className="block text-sm font-medium text-gray-700">
              Enrollment Notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add training context, syllabus goals, or student requirements..."
              className="min-h-[100px] bg-white text-sm border-gray-200 focus-visible:ring-0 resize-none rounded-md"
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function MemberTrainingTab({ memberId }: { memberId: string }) {
  const queryClient = useQueryClient()
  const [enrollOpen, setEnrollOpen] = React.useState(false)
  const [logExamOpen, setLogExamOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("syllabus")
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const [showScrollLeft, setShowScrollLeft] = React.useState(false)
  const [showScrollRight, setShowScrollRight] = React.useState(false)

  // ... rest of the effects ...

  // Update underline position when tab changes and scroll active tab into view
  React.useEffect(() => {
    const activeTabElement = tabRefs.current[activeTab]
    const tabsList = tabsListRef.current
    
    if (activeTabElement && tabsList) {
      const tabsListRect = tabsList.getBoundingClientRect()
      const activeTabRect = activeTabElement.getBoundingClientRect()
      
      setUnderlineStyle({
        left: activeTabElement.offsetLeft,
        width: activeTabRect.width
      })

      // Scroll active tab into view on mobile/tablet
      if (window.innerWidth < 768) {
        const tabLeft = activeTabElement.offsetLeft
        const tabWidth = activeTabRect.width
        const containerWidth = tabsListRect.width
        
        // Calculate scroll position to center the tab
        const targetScroll = tabLeft - (containerWidth / 2) + (tabWidth / 2)
        
        tabsList.scrollTo({
          left: Math.max(0, targetScroll),
          behavior: 'smooth'
        })
      }
    }
  }, [activeTab])

  // Initial positioning on mount
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const activeTabElement = tabRefs.current[activeTab]
      if (activeTabElement) {
        setUnderlineStyle({
          left: activeTabElement.offsetLeft,
          width: activeTabElement.getBoundingClientRect().width
        })
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [activeTab])

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
  }, [activeTab])

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["member-training", memberId],
    queryFn: () => fetchMemberTraining(memberId),
    enabled: Boolean(memberId),
    staleTime: 30_000,
  })

  const { data: instructors = [] } = useQuery({
    queryKey: ["instructors"],
    queryFn: fetchInstructors,
    staleTime: 5 * 60 * 1000,
  })

  const { data: aircraftTypes = [] } = useQuery({
    queryKey: ["aircraft-types"],
    queryFn: fetchAircraftTypes,
    staleTime: 5 * 60 * 1000,
  })

  const training = data?.training
  const enrollments = training?.enrollments ?? []
  const examResults = React.useMemo(() => training?.examResults ?? [], [training])
  const syllabi = training?.syllabi ?? []

  // Get IDs of exams the member has already passed
  const passedExamIds = React.useMemo(() => {
    return new Set(
      examResults
        .filter(r => r.result === "PASS")
        .map(r => r.exam_id)
    )
  }, [examResults])

  const activeEnrollments = enrollments.filter(
    (e) => (e.status || "").toLowerCase() === "active" && !e.completion_date
  )
  const historicalEnrollments = enrollments.filter(
    (e) => !((e.status || "").toLowerCase() === "active" && !e.completion_date)
  )

  const activeSyllabusIds = new Set(activeEnrollments.map((e) => e.syllabus_id))
  const availableSyllabi = syllabi.filter((s) => !activeSyllabusIds.has(s.id))

  const form = useForm<EnrollFormValues>({
    resolver: zodResolver(createSyllabusEnrollmentSchema),
    defaultValues: { 
      syllabus_id: "", 
      notes: null,
      primary_instructor_id: null,
      aircraft_type: null,
      enrolled_at: new Date().toISOString().split('T')[0]
    },
  })

  const logExamForm = useForm<LogExamFormValues>({
    resolver: zodResolver(logExamResultSchema),
    defaultValues: {
      exam_id: "",
      result: "PASS",
      score: null,
      exam_date: new Date().toISOString().split('T')[0],
      notes: null,
    },
  })

  const [selectedSyllabusId, setSelectedSyllabusId] = React.useState<string>("all")

  const { data: exams = [] } = useQuery({
    queryKey: ["exams", selectedSyllabusId],
    queryFn: () => fetchExams(selectedSyllabusId === "all" ? undefined : selectedSyllabusId),
    enabled: logExamOpen,
  })

  const availableExams = React.useMemo(() => {
    return exams.filter(e => !passedExamIds.has(e.id))
  }, [exams, passedExamIds])

  React.useEffect(() => {
    if (!enrollOpen) return
    form.reset({ 
      syllabus_id: "", 
      notes: null,
      primary_instructor_id: null,
      aircraft_type: null,
      enrolled_at: new Date().toISOString().split('T')[0]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollOpen])

  React.useEffect(() => {
    if (!logExamOpen) return
    logExamForm.reset({
      exam_id: "",
      result: "PASS",
      score: null,
      exam_date: new Date().toISOString().split('T')[0],
      notes: null,
    })
    setSelectedSyllabusId("all")
  }, [logExamOpen, logExamForm])

  const enrollMutation = useMutation({
    mutationFn: async (values: EnrollFormValues) => {
      const res = await fetch(`/api/members/${memberId}/training/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || "Failed to enroll member")
      }
      return (await res.json()) as { enrollment: EnrollmentWithSyllabus }
    },
    onSuccess: async () => {
      toast.success("Syllabus enrollment created")
      setEnrollOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["member-training", memberId] })
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to enroll member")
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<EnrollFormValues> }) => {
      const res = await fetch(`/api/members/${memberId}/training/enrollments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error("Failed to update enrollment")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-training", memberId] })
    }
  })

  const handleUpdateEnrollment = async (id: string, values: Partial<EnrollFormValues>) => {
    await updateMutation.mutateAsync({ id, values })
  }

  const logExamMutation = useMutation({
    mutationFn: async (values: LogExamFormValues) => {
      const res = await fetch(`/api/members/${memberId}/training/exam-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || "Failed to log exam result")
      }
      return (await res.json()) as { result: ExamResultWithExam }
    },
    onSuccess: async () => {
      toast.success("Exam result logged successfully")
      setLogExamOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["member-training", memberId] })
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Failed to log exam result")
    },
  })

  const submitting = enrollMutation.isPending || form.formState.isSubmitting
  const logSubmitting = logExamMutation.isPending || logExamForm.formState.isSubmitting

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading training data...</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error instanceof Error ? error.message : "Failed to load training data"}</p>
          <Button onClick={() => refetch()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b border-gray-200">
          <div className="relative">
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
                className="flex flex-row gap-4 min-h-[48px] relative min-w-max"
                aria-label="Training sub-tabs"
              >
                {/* Animated underline */}
                <div
                  className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                  style={{
                    left: `${underlineStyle.left}px`,
                    width: `${underlineStyle.width}px`,
                  }}
                />
                
                {[
                  { id: "syllabus", label: "Syllabus", icon: BookOpen },
                  { id: "exams", label: "Exams", icon: FileText },
                  { id: "flight", label: "Flight Training", icon: Plane },
                ].map((tab) => {
                  const Icon = tab.icon
                  return (
                    <Tabs.Trigger
                      key={tab.id}
                      ref={(el) => { tabRefs.current[tab.id] = el }}
                      value={tab.id}
                      className="inline-flex items-center gap-2 px-4 py-3 pb-1 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 cursor-pointer data-[state=active]:text-indigo-800 data-[state=inactive]:text-gray-500 hover:text-indigo-600 whitespace-nowrap flex-shrink-0 min-h-[48px] min-w-[44px] touch-manipulation active:bg-gray-50 border-none bg-transparent"
                      aria-label={`${tab.label} tab`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{tab.label}</span>
                    </Tabs.Trigger>
                  )
                })}
              </Tabs.List>
            </div>
          </div>
        </div>

        <div className="pt-6">
          <Tabs.Content value="syllabus" className="space-y-6 outline-none">
            {/* Syllabus Enrollments */}
            <Card className="shadow-sm border border-border/50 bg-card overflow-hidden rounded-lg">
              <CardHeader className="pb-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 rounded-full bg-indigo-50">
                      <Target className="w-5 h-5 text-indigo-600" />
                    </div>
                    Syllabus Enrollments
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setEnrollOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md h-9"
                    disabled={availableSyllabi.length === 0}
                    title={availableSyllabi.length === 0 ? "No additional active syllabi available" : "Enroll in a syllabus"}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Enroll
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Active */}
                <div className="p-4 sm:p-6 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 tracking-tight">Active Enrollments</h3>
                      <p className="text-xs text-muted-foreground mt-1">Manage student syllabus, assigned staff and aircraft</p>
                    </div>
                    <Badge variant="outline" className="rounded-full bg-slate-50 text-slate-600 font-medium self-start sm:self-auto px-3 py-1 text-[10px] uppercase tracking-wider">
                      {activeEnrollments.length} {activeEnrollments.length === 1 ? 'enrolled' : 'enrollments'}
                    </Badge>
                  </div>
                  {activeEnrollments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-12 text-center bg-slate-50/30">
                      <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-sm font-semibold text-slate-700">No active enrollments</p>
                      <p className="text-xs text-slate-500 mt-2 max-w-[280px] mx-auto">Enroll the member to start tracking training against a syllabus.</p>
                    </div>
                  ) : (
                    <div className="grid gap-6">
                      {activeEnrollments.map((e) => (
                        <EnrollmentCard 
                          key={e.id} 
                          enrollment={e} 
                          instructors={instructors}
                          aircraftTypes={aircraftTypes}
                          onUpdate={handleUpdateEnrollment}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* History */}
                <div className="p-4 sm:p-6 bg-white/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Historical Enrollments</h3>
                      <p className="text-xs text-muted-foreground mt-1">Completed or withdrawn training records</p>
                    </div>
                    <Badge variant="outline" className="rounded-full bg-slate-50 text-slate-600 font-medium self-start sm:self-auto px-3 py-1 text-[10px] uppercase tracking-wider">
                      {historicalEnrollments.length} {historicalEnrollments.length === 1 ? 'record' : 'records'}
                    </Badge>
                  </div>
                  {historicalEnrollments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center bg-white">
                      <p className="text-sm font-medium text-slate-700">No historical enrollments</p>
                      <p className="text-xs text-slate-500 mt-1">Completed or withdrawn enrollments will remain visible here.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {historicalEnrollments.map((e) => {
                        const label = enrollmentStatusLabel(e)
                        const inst = instructors.find(i => i.id === e.primary_instructor_id)
                        const at = aircraftTypes.find(a => a.id === e.aircraft_type)
                        
                        return (
                          <div key={e.id} className="rounded-lg border border-slate-200 bg-white/80 p-4 opacity-90 transition-all hover:opacity-100 hover:border-slate-300">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mt-0.5">
                                  <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-slate-900 text-sm">
                                      {e.syllabus?.name || "Syllabus"}
                                    </span>
                                    <Badge className={cn("rounded-md px-2 py-0.5 text-[9px] font-bold uppercase", enrollmentStatusClasses(label))}>
                                      {label}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-slate-500 mt-1.5 font-medium">
                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                      {formatDateTime(e.enrolled_at)} — {formatDateTime(e.completion_date)}
                                    </span>
                                    {inst && (
                                      <span className="flex items-center gap-1 bg-indigo-50/50 px-1.5 py-0.5 rounded text-indigo-600">
                                        <User className="w-2.5 h-2.5" /> {inst.user.first_name} {inst.user.last_name}
                                      </span>
                                    )}
                                    {at && (
                                      <span className="flex items-center gap-1 bg-blue-50/50 px-1.5 py-0.5 rounded text-blue-600">
                                        <Plane className="w-2.5 h-2.5" /> {at.name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="exams" className="space-y-6 outline-none">
            {/* Exam Results */}
            <Card className="shadow-sm border border-border/50 bg-card overflow-hidden rounded-lg">
              <CardHeader className="pb-4 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="p-2 rounded-full bg-indigo-50">
                      <GraduationCap className="w-5 h-5 text-indigo-600" />
                    </div>
                    Exam Results
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setLogExamOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md h-9"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Log Result
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {examResults.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                      <GraduationCap className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-700 font-semibold">No exam results yet</p>
                    <p className="text-slate-500 text-sm mt-1 max-w-[280px] mx-auto">Exam attempts and outcomes will appear here once recorded.</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full" aria-label="Exam results table">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/50">
                            <th className="text-left py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-400">Exam</th>
                            <th className="text-left py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-[160px]">Attempted</th>
                            <th className="text-left py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-[120px]">Result</th>
                            <th className="text-left py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-[160px]">Score</th>
                            <th className="text-left py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-400 min-w-[260px]">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {examResults.map((r) => {
                            const examName = r.exam?.name || "Exam"
                            const syllabusName = r.exam?.syllabus?.name
                            const passing = r.exam?.passing_score
                            const resultLabel = r.result
                            return (
                              <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="py-4 px-6">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-slate-900">{examName}</span>
                                    {syllabusName ? (
                                      <span className="text-[11px] text-slate-500 mt-0.5">{syllabusName}</span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="py-4 px-6">
                                  <span className="text-sm text-slate-700">{formatDateTime(r.exam_date)}</span>
                                </td>
                                <td className="py-4 px-6">
                                  <Badge className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase", resultBadgeClasses(resultLabel))}>
                                    {resultLabel}
                                  </Badge>
                                </td>
                                <td className="py-4 px-6">
                                  <div className="text-sm flex items-center gap-1.5">
                                    <span className="font-semibold text-slate-900">{r.score}%</span>
                                    {typeof passing === "number" ? (
                                      <span className="text-[10px] text-slate-400 font-medium">/ pass {passing}%</span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="py-4 px-6">
                                  {r.notes ? (
                                    <span className="text-xs text-slate-600 leading-relaxed italic block max-w-[300px] truncate" title={r.notes}>&ldquo;{r.notes}&rdquo;</span>
                                  ) : (
                                    <span className="text-xs text-slate-300">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {examResults.map((r) => {
                        const examName = r.exam?.name || "Exam"
                        const syllabusName = r.exam?.syllabus?.name
                        const passing = r.exam?.passing_score
                        const resultLabel = r.result
                        return (
                          <div key={r.id} className="p-4 space-y-3 bg-white">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <h4 className="font-semibold text-slate-900 text-sm truncate">{examName}</h4>
                                {syllabusName && <p className="text-[11px] text-slate-500 truncate">{syllabusName}</p>}
                              </div>
                              <Badge className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase shrink-0", resultBadgeClasses(resultLabel))}>
                                {resultLabel}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-[11px]">
                              <div>
                                <span className="text-slate-400 block uppercase font-bold tracking-tighter">Date</span>
                                <span className="text-slate-700 font-medium">{formatDateTime(r.exam_date)}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block uppercase font-bold tracking-tighter">Score</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-900 font-bold">{r.score}%</span>
                                  {typeof passing === "number" && <span className="text-slate-400">/ {passing}%</span>}
                                </div>
                              </div>
                            </div>

                            {r.notes && (
                              <div className="bg-slate-50 rounded-md p-2.5">
                                <span className="text-slate-400 block uppercase text-[9px] font-bold tracking-tighter mb-1">Notes</span>
                                <p className="text-xs text-slate-600 italic">&ldquo;{r.notes}&rdquo;</p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </Tabs.Content>

          <Tabs.Content value="flight" className="space-y-6 outline-none">
            <Card className="shadow-sm border border-border/50 bg-card overflow-hidden rounded-lg">
              <CardContent className="p-12 text-center">
                <div className="h-20 w-20 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-6">
                  <Plane className="w-10 h-10 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2 tracking-tight">Flight Training Progress</h3>
                <p className="text-slate-500 text-sm max-w-[420px] mx-auto leading-relaxed">
                  Detailed flight training logs, lesson progress, and skill assessments will be integrated here in a future update.
                </p>
                <div className="mt-8 flex justify-center gap-3">
                  <div className="px-4 py-2 rounded-full bg-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-500">Coming Soon</div>
                </div>
              </CardContent>
            </Card>
          </Tabs.Content>
        </div>
      </Tabs.Root>

      {/* Enroll Dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent
          className={cn(
            "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
            "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[520px]",
            "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
            "h-auto max-h-[calc(100dvh-4rem)]"
          )}
        >
          <div className="flex h-full min-h-0 flex-col bg-white">
            <DialogHeader className="px-6 pt-6 pb-4 text-left">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                    Enroll in Syllabus
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm text-slate-500">
                    Create a new syllabus enrollment for this member.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form
              onSubmit={form.handleSubmit((values) => enrollMutation.mutate(values))}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6"
            >
              <div className="space-y-6">
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Enrollment Details</span>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        <BookOpen className="w-2.5 h-2.5" />
                        SYLLABUS <span className="text-destructive font-bold ml-0.5">*</span>
                      </label>
                      <Select
                        value={form.watch("syllabus_id")}
                        onValueChange={(val) => form.setValue("syllabus_id", val, { shouldValidate: true })}
                        disabled={submitting}
                      >
                        <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-indigo-100 transition-all">
                          <SelectValue placeholder={availableSyllabi.length ? "Select syllabus to enroll in" : "No syllabi available"} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                          {availableSyllabi.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="text-xs font-medium rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600">
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.syllabus_id ? (
                        <p className="mt-1 text-[10px] text-destructive font-medium">{form.formState.errors.syllabus_id.message}</p>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <User className="w-2.5 h-2.5" />
                          PRIMARY INSTRUCTOR
                        </label>
                        <Select
                          value={form.watch("primary_instructor_id") || "none"}
                          onValueChange={(val) => form.setValue("primary_instructor_id", val === "none" ? null : val)}
                          disabled={submitting}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-indigo-100 transition-all">
                            <SelectValue placeholder="Optional" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            <SelectItem value="none" className="text-xs italic text-slate-400">Not assigned</SelectItem>
                            {instructors.map((inst) => (
                              <SelectItem key={inst.id} value={inst.id} className="text-xs font-medium rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600">
                                {inst.user.first_name} {inst.user.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <Plane className="w-2.5 h-2.5" />
                          PRIMARY AIRCRAFT TYPE
                        </label>
                        <Select
                          value={form.watch("aircraft_type") || "none"}
                          onValueChange={(val) => form.setValue("aircraft_type", val === "none" ? null : val)}
                          disabled={submitting}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-indigo-100 transition-all">
                            <SelectValue placeholder="Optional" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            <SelectItem value="none" className="text-xs italic text-slate-400">Not assigned</SelectItem>
                            {aircraftTypes.map((at) => (
                              <SelectItem key={at.id} value={at.id} className="text-xs font-medium rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600">
                                {at.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          ENROLLMENT DATE
                        </label>
                        <Input
                          type="date"
                          value={form.watch("enrolled_at") || ""}
                          onChange={(e) => form.setValue("enrolled_at", e.target.value)}
                          disabled={submitting}
                          className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus-visible:ring-1 focus-visible:ring-indigo-100 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        <MessageSquare className="w-2.5 h-2.5" />
                        NOTES (OPTIONAL)
                      </label>
                      <Textarea
                        value={form.watch("notes") || ""}
                        onChange={(e) => form.setValue("notes", e.target.value, { shouldValidate: true })}
                        placeholder="Add any relevant training context or student requirements..."
                        className="min-h-[100px] rounded-xl border-slate-200 bg-white px-3 py-2.5 text-xs font-medium shadow-none hover:bg-slate-50 focus-visible:ring-1 focus-visible:ring-indigo-100 transition-all resize-none"
                        disabled={submitting}
                      />
                      {form.formState.errors.notes ? (
                        <p className="mt-1 text-[10px] text-destructive font-medium">{form.formState.errors.notes.message}</p>
                      ) : null}
                    </div>
                  </div>
                </section>
              </div>
            </form>

            <div className="border-t bg-white px-6 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEnrollOpen(false)}
                  disabled={submitting}
                  className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !availableSyllabi.length}
                  onClick={form.handleSubmit((values) => enrollMutation.mutate(values))}
                  className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                >
                  {submitting ? "Enrolling..." : "Enroll Member"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log Exam Result Dialog */}
      <Dialog open={logExamOpen} onOpenChange={setLogExamOpen}>
        <DialogContent
          className={cn(
            "p-0 border-none shadow-2xl rounded-[24px] overflow-hidden",
            "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:w-full sm:max-w-[520px]",
            "top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[50%] translate-y-0 sm:translate-y-[-50%]",
            "h-auto max-h-[calc(100dvh-4rem)]"
          )}
        >
          <div className="flex h-full min-h-0 flex-col bg-white">
            <DialogHeader className="px-6 pt-6 pb-4 text-left">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                    Log Exam Result
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm text-slate-500">
                    Record a new theory exam result for this member.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form
              onSubmit={logExamForm.handleSubmit((values) => logExamMutation.mutate(values))}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6"
            >
              <div className="space-y-6">
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold tracking-tight text-slate-900">Exam Details</span>
                  </div>

                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <BookOpen className="w-2.5 h-2.5" />
                          SYLLABUS (FILTER)
                        </label>
                        <Select
                          value={selectedSyllabusId}
                          onValueChange={setSelectedSyllabusId}
                          disabled={logSubmitting}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-indigo-100 transition-all">
                            <SelectValue placeholder="All exams" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            <SelectItem value="all" className="text-xs font-medium rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600">
                              All Exams
                            </SelectItem>
                            {syllabi.map((s) => (
                              <SelectItem key={s.id} value={s.id} className="text-xs font-medium rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600">
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <GraduationCap className="w-2.5 h-2.5" />
                          EXAM <span className="text-destructive font-bold ml-0.5">*</span>
                        </label>
                        <Select
                          value={logExamForm.watch("exam_id")}
                          onValueChange={(val) => logExamForm.setValue("exam_id", val, { shouldValidate: true })}
                          disabled={logSubmitting}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-indigo-100 transition-all">
                            <SelectValue placeholder={availableExams.length ? "Select exam" : "No exams available"} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            {availableExams.map((e) => (
                              <SelectItem key={e.id} value={e.id} className="text-xs font-medium rounded-lg mx-1 focus:bg-indigo-50 focus:text-indigo-600">
                                {e.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {logExamForm.formState.errors.exam_id ? (
                          <p className="mt-1 text-[10px] text-destructive font-medium">{logExamForm.formState.errors.exam_id.message}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          RESULT <span className="text-destructive font-bold ml-0.5">*</span>
                        </label>
                        <Select
                          value={logExamForm.watch("result")}
                          onValueChange={(val) => logExamForm.setValue("result", val as "PASS" | "FAIL", { shouldValidate: true })}
                          disabled={logSubmitting}
                        >
                          <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus:ring-1 focus:ring-indigo-100 transition-all">
                            <SelectValue placeholder="Select result" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            <SelectItem value="PASS" className="text-xs font-medium rounded-lg mx-1 focus:bg-emerald-50 focus:text-emerald-600">Pass</SelectItem>
                            <SelectItem value="FAIL" className="text-xs font-medium rounded-lg mx-1 focus:bg-rose-50 focus:text-rose-600">Fail</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <Target className="w-2.5 h-2.5" />
                          SCORE (%)
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={logExamForm.watch("score") ?? ""}
                          onChange={(e) => logExamForm.setValue("score", e.target.value ? Number(e.target.value) : null)}
                          disabled={logSubmitting}
                          placeholder="e.g. 85"
                          className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus-visible:ring-1 focus-visible:ring-indigo-100 transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          EXAM DATE <span className="text-destructive font-bold ml-0.5">*</span>
                        </label>
                        <Input
                          type="date"
                          value={logExamForm.watch("exam_date") || ""}
                          onChange={(e) => logExamForm.setValue("exam_date", e.target.value)}
                          disabled={logSubmitting}
                          className="h-10 w-full rounded-xl border-slate-200 bg-white px-3 text-xs font-medium shadow-none hover:bg-slate-50 focus-visible:ring-1 focus-visible:ring-indigo-100 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        <MessageSquare className="w-2.5 h-2.5" />
                        NOTES (OPTIONAL)
                      </label>
                      <Textarea
                        value={logExamForm.watch("notes") || ""}
                        onChange={(e) => logExamForm.setValue("notes", e.target.value, { shouldValidate: true })}
                        placeholder="Add any additional context about this exam attempt..."
                        className="min-h-[100px] rounded-xl border-slate-200 bg-white px-3 py-2.5 text-xs font-medium shadow-none hover:bg-slate-50 focus-visible:ring-1 focus-visible:ring-indigo-100 transition-all resize-none"
                        disabled={logSubmitting}
                      />
                    </div>
                  </div>
                </section>
              </div>
            </form>

            <div className="border-t bg-white px-6 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLogExamOpen(false)}
                  disabled={logSubmitting}
                  className="h-10 flex-1 rounded-xl border-slate-200 text-xs font-bold shadow-none hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={logSubmitting}
                  onClick={logExamForm.handleSubmit((values) => logExamMutation.mutate(values))}
                  className="h-10 flex-[1.4] rounded-xl bg-slate-900 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                >
                  {logSubmitting ? "Logging..." : "Log Result"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


