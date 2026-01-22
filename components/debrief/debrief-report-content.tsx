"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Plane } from "lucide-react"
import { format, parseISO } from "date-fns"
import type { BookingWithRelations } from "@/lib/types/bookings"
import type { LessonProgressWithInstructor } from "@/lib/types/lesson_progress"
import type { FlightExperienceEntryWithType } from "@/lib/types/flight-experience"
import type { ExperienceType } from "@/lib/types/experience-types"
import LessonProgressComments from "./LessonProgressComments"
import FlightExperienceDisplay from "./FlightExperienceDisplay"

interface DebriefReportContentProps {
  booking: BookingWithRelations
  lessonProgress: LessonProgressWithInstructor | null
  flightExperiences: FlightExperienceEntryWithType[]
  experienceTypes: ExperienceType[]
  hideHeader?: boolean
}

export default function DebriefReportContent({
  booking,
  lessonProgress,
  flightExperiences,
  experienceTypes,
  hideHeader = false,
}: DebriefReportContentProps) {
  const studentName = booking.student 
    ? `${booking.student.first_name || ''} ${booking.student.last_name || ''}`.trim() || booking.student.email
    : 'Unknown Student'

  const instructorName = lessonProgress?.instructor?.user
    ? `${lessonProgress.instructor.user.first_name || ''} ${lessonProgress.instructor.user.last_name || ''}`.trim() || lessonProgress.instructor.user.email
    : booking.instructor
      ? (() => {
          // Use user names as the source of truth (fallback to instructor table for backward compatibility)
          const firstName = booking.instructor.user?.first_name ?? booking.instructor.first_name
          const lastName = booking.instructor.user?.last_name ?? booking.instructor.last_name
          return `${firstName} ${lastName || ''}`.trim() || booking.instructor.user?.email || 'Not assigned'
        })()
      : 'Not assigned'

  return (
    <div className="flex flex-col h-full bg-white dark:bg-card">
      {!hideHeader && (
        <div className="py-8 md:py-12 px-6 md:px-10 border-b border-border/40">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 md:gap-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary font-bold tracking-widest mb-2">
                <Plane className="h-4 w-4" />
                <span className="text-[10px] uppercase">Official Flight Debrief</span>
              </div>
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground">
                {booking.lesson?.name || 'Training Flight'}
              </h1>
              <div className="flex flex-col gap-1">
                <p className="text-muted-foreground text-base md:text-lg font-medium">
                  {booking.start_time ? format(parseISO(booking.start_time), "EEEE, d MMMM yyyy") : 'Date not set'}
                </p>
                {booking.lesson?.syllabus?.name && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/50 px-2 py-0.5 rounded border border-border/40">
                      Syllabus: {booking.lesson.syllabus.name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1">
        {/* Outcome & Attempt - Always visible even if full page header is hidden */}
        {(lessonProgress?.status || lessonProgress?.attempt != null) && (
          <div className="px-6 md:px-8 py-5 bg-muted/30 flex items-center justify-between border-b border-border/40">
            <div className="flex items-center gap-4">
              {lessonProgress?.status && (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Outcome</span>
                  <Badge
                    className={`text-[11px] px-3 py-0.5 font-black uppercase tracking-widest ${
                      lessonProgress.status === 'pass'
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-none'
                        : 'bg-rose-500/10 text-rose-600 border-rose-500/20 shadow-none'
                    }`}
                    variant="outline"
                  >
                    {lessonProgress.status === 'pass' ? 'Pass' : 'Not Yet Competent'}
                  </Badge>
                </div>
              )}
              {lessonProgress?.attempt != null && (
                <div className="flex flex-col gap-1 border-l border-border/60 pl-4">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Attempt</span>
                  <span className="text-[13px] font-bold text-foreground tabular-nums">
                    #{lessonProgress.attempt}
                  </span>
                </div>
              )}
            </div>
            {hideHeader && (
              <div className="flex flex-col items-end gap-1">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.1em]">Session Date</span>
                <div className="text-[12px] font-bold text-foreground">
                  {booking.start_time ? format(parseISO(booking.start_time), "d MMM yyyy") : ''}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Simple Info Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border/40 py-6 px-6 md:px-8 bg-muted/5 gap-y-6">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Student</p>
            <p className="text-[14px] font-semibold text-foreground">{studentName}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Instructor</p>
            <p className="text-[14px] font-semibold text-foreground">{instructorName}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Aircraft</p>
            <p className="text-[14px] font-semibold text-foreground">
              {booking.checked_out_aircraft?.registration || booking.aircraft?.registration || '—'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Flight Time</p>
            <p className="text-[14px] font-semibold text-foreground">
              {booking.flight_time != null ? `${booking.flight_time.toFixed(1)}h` : '—'}
            </p>
          </div>
        </div>

        {/* Comments Section */}
        <div className="p-6 md:p-10 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-primary" />
            <h2 className="text-[12px] font-bold text-foreground uppercase tracking-widest">
              Instructor Feedback
            </h2>
          </div>
          <div className="prose prose-slate dark:prose-invert max-w-none leading-relaxed text-slate-700 px-1">
            <LessonProgressComments comments={lessonProgress?.instructor_comments} />
          </div>
        </div>

        <Separator className="mx-6 md:mx-10" />

        {/* Assessment Grid */}
        <div className="p-6 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
          <section className="space-y-8">
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <span className="w-4 h-[1px] bg-border" />
                Lesson Highlights
              </h3>
              <p className="text-[14px] text-slate-600 leading-relaxed px-1">
                {lessonProgress?.lesson_highlights || <span className="text-muted-foreground italic opacity-60">No highlights recorded.</span>}
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <span className="w-4 h-[1px] bg-border" />
                General Airmanship
              </h3>
              <p className="text-[14px] text-slate-600 leading-relaxed px-1">
                {lessonProgress?.airmanship || <span className="text-muted-foreground italic opacity-60">No airmanship notes recorded.</span>}
              </p>
            </div>
          </section>

          <section className="space-y-8">
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <span className="w-4 h-[1px] bg-border" />
                Areas for Improvement
              </h3>
              <p className="text-[14px] text-slate-600 leading-relaxed px-1">
                {lessonProgress?.areas_for_improvement || <span className="text-muted-foreground italic opacity-60">No areas for improvement recorded.</span>}
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <span className="w-4 h-[1px] bg-border" />
                Focus for Next Lesson
              </h3>
              <p className="text-[14px] text-foreground font-semibold leading-relaxed px-1">
                {lessonProgress?.focus_next_lesson || "Standard progress to next lesson."}
              </p>
            </div>
          </section>
        </div>

        {/* Environment Info */}
        {(lessonProgress?.weather_conditions || lessonProgress?.safety_concerns) && (
          <>
            <Separator className="mx-6 md:mx-10" />
            <div className="p-6 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
              {lessonProgress?.weather_conditions && (
                <div>
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Weather</h3>
                  <p className="text-sm text-foreground leading-relaxed">{lessonProgress.weather_conditions}</p>
                </div>
              )}
              {lessonProgress?.safety_concerns && (
                <div>
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Safety Observations</h3>
                  <p className="text-sm text-foreground leading-relaxed">{lessonProgress.safety_concerns}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Flight Experience */}
        {flightExperiences && flightExperiences.length > 0 && (
          <>
            <Separator className="mx-6 md:mx-10" />
            <div className="p-6 md:p-10 space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-primary" />
                <h2 className="text-[12px] font-bold text-foreground uppercase tracking-widest">
                  Flight Experience Logged
                </h2>
              </div>
              <FlightExperienceDisplay
                flightExperiences={flightExperiences}
                experienceTypes={experienceTypes}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
