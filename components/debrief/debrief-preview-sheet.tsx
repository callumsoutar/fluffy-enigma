"use client"

import React from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useQuery } from "@tanstack/react-query"
import { Loader2, FileText, Printer, Download, ArrowLeft, Mail } from "lucide-react"
import type { BookingWithRelations } from "@/lib/types/bookings"
import type { LessonProgressWithInstructor } from "@/lib/types/lesson_progress"
import type { FlightExperienceEntryWithType } from "@/lib/types/flight-experience"
import type { ExperienceType } from "@/lib/types/experience-types"
import DebriefReportContent from "./debrief-report-content"
import { Button } from "@/components/ui/button"
import { pdf } from "@react-pdf/renderer"
import DebriefReportPDF from "./debrief-report-pdf"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import { useIsMobile } from "@/hooks/use-mobile"

interface DebriefPreviewSheetProps {
  bookingId: string | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

async function fetchDebriefData(bookingId: string) {
  const res = await fetch(`/api/bookings/${bookingId}`)
  if (!res.ok) throw new Error("Failed to fetch booking")
  const { booking } = await res.json()

  // Fetch experience data
  const expRes = await fetch(`/api/bookings/${bookingId}/experience`)
  const experiences = expRes.ok ? await expRes.json() : { experiences: [] }

  // Fetch experience types
  const typeRes = await fetch("/api/experience-types")
  const types = typeRes.ok ? await typeRes.json() : { experience_types: [] }

  return {
    booking: booking as BookingWithRelations,
    lessonProgress: (Array.isArray(booking.lesson_progress) ? booking.lesson_progress[0] : booking.lesson_progress) as LessonProgressWithInstructor,
    flightExperiences: (experiences?.experiences || []) as FlightExperienceEntryWithType[],
    experienceTypes: (types?.experience_types || []) as ExperienceType[]
  }
}

export default function DebriefPreviewSheet({
  bookingId,
  isOpen,
  onOpenChange,
}: DebriefPreviewSheetProps) {
  const isMobile = useIsMobile()
  const { data, isLoading, isError } = useQuery({
    queryKey: ["debrief-preview", bookingId],
    queryFn: () => fetchDebriefData(bookingId!),
    enabled: !!bookingId && isOpen,
  })

  const [isDownloading, setIsDownloading] = React.useState(false)
  const [isPrinting, setIsPrinting] = React.useState(false)

  const handlePrint = async () => {
    if (!data) return
    setIsPrinting(true)
    try {
      const doc = (
        <DebriefReportPDF 
          booking={data.booking} 
          lessonProgress={data.lessonProgress} 
          flightExperiences={data.flightExperiences} 
        />
      )
      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      const printWindow = window.open(url, '_blank')
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }
      }
    } catch {
      toast.error("Failed to generate print report")
    } finally {
      setIsPrinting(false)
    }
  }

  const handleEmail = () => {
    if (!data) return
    const studentEmail = data.booking.student?.email
    if (!studentEmail) {
      toast.error('Student email not found')
      return
    }

    const instructorName = data.lessonProgress?.instructor?.user
      ? `${data.lessonProgress.instructor.user.first_name || ''} ${data.lessonProgress.instructor.user.last_name || ''}`.trim() || data.lessonProgress.instructor.user.email
      : data.booking.instructor?.first_name 
        ? `${data.booking.instructor.first_name} ${data.booking.instructor.last_name || ''}`.trim()
        : 'Instructor'

    const subject = `Flight Debrief - ${data.booking.lesson?.name || 'Training Flight'}`
    const body = `Hi ${data.booking.student?.first_name || 'there'},\n\nPlease find your flight debrief report here: ${window.location.origin}/bookings/${data.booking.id}/debrief\n\nRegards,\n${instructorName}`
    
    window.location.href = `mailto:${studentEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const handleDownloadPDF = async () => {
    if (!data) return
    setIsDownloading(true)
    try {
      const doc = (
        <DebriefReportPDF 
          booking={data.booking} 
          lessonProgress={data.lessonProgress} 
          flightExperiences={data.flightExperiences} 
        />
      )
      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const date = data.booking.start_time ? format(parseISO(data.booking.start_time), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
      const studentName = data.booking.student 
        ? `${data.booking.student.first_name || ''} ${data.booking.student.last_name || ''}`.trim() || data.booking.student.email
        : 'Student'
      link.download = `Debrief-${studentName.replace(/\s+/g, '-')}-${date}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("PDF Downloaded")
    } catch {
      toast.error("Failed to download PDF")
    } finally {
      setIsDownloading(false)
    }
  }

  const reportContent = (
    <div className="flex-1 overflow-y-auto">
      {isLoading ? (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary/40" />
          <p className="text-sm font-medium">Loading report details...</p>
        </div>
      ) : isError ? (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center">
          <p className="text-sm text-destructive font-medium mb-2">Failed to load report</p>
          <p className="text-xs text-muted-foreground">Please try again later or view the full page report.</p>
        </div>
      ) : data ? (
        <div className="pb-20">
          <DebriefReportContent
            booking={data.booking}
            lessonProgress={data.lessonProgress}
            flightExperiences={data.flightExperiences}
            experienceTypes={data.experienceTypes}
            hideHeader={isMobile}
          />
        </div>
      ) : null}
    </div>
  )

  if (isMobile) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent 
          className="max-w-none w-screen h-[100dvh] p-0 flex flex-col border-none rounded-none gap-0 outline-none overflow-hidden"
          showCloseButton={false}
        >
          <DialogHeader className="px-4 h-16 border-b flex flex-row items-center justify-between shrink-0 space-y-0 sticky top-0 bg-background/80 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 -ml-2 rounded-full hover:bg-muted" 
                onClick={() => onOpenChange(false)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex flex-col">
                <DialogTitle className="text-[15px] font-bold tracking-tight leading-none mb-1 truncate max-w-[200px]">
                  {data?.booking.lesson?.name || 'Flight Debrief'}
                </DialogTitle>
                {data?.booking.start_time && (
                  <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                    {format(parseISO(data.booking.start_time), "d MMM yyyy")}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={handleDownloadPDF} disabled={!data || isDownloading}>
                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={handlePrint} disabled={!data || isPrinting}>
                {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={handleEmail} disabled={!data}>
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          {reportContent}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 py-4 border-b border-border/40 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <SheetTitle className="text-base font-bold">Debrief Preview</SheetTitle>
          </div>
          
          <div className="flex items-center gap-2 pr-8">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownloadPDF} disabled={!data || isDownloading}>
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrint} disabled={!data || isPrinting}>
              {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleEmail} disabled={!data}>
              <Mail className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>
        {reportContent}
      </SheetContent>
    </Sheet>
  )
}

