"use client"

import * as React from "react"
import Link from "next/link"
import { IconArrowLeft, IconPlane, IconUser, IconSchool, IconCalendar, IconExternalLink } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import type { BookingWithRelations, BookingStatus } from "@/lib/types/bookings"
import { cn } from "@/lib/utils"

interface BookingHeaderProps {
  booking: BookingWithRelations
  title: string
  backHref: string
  backLabel?: string
  className?: string
  actions?: React.ReactNode
  extra?: React.ReactNode
}

function getStatusBadgeStyles(status: BookingStatus): string {
  switch (status) {
    case "flying":
      return "bg-orange-500 text-white border-orange-600 hover:bg-orange-600 shadow-sm"
    case "confirmed":
      return "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 shadow-sm"
    case "unconfirmed":
      return "bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-sm"
    case "briefing":
      return "bg-purple-600 text-white border-purple-700 hover:bg-purple-700 shadow-sm"
    case "complete":
      return "bg-green-600 text-white border-green-700 hover:bg-green-700 shadow-sm"
    case "cancelled":
      return "bg-red-600 text-white border-red-700 hover:bg-red-700 shadow-sm"
    default:
      return "bg-slate-500 text-white border-slate-600 shadow-sm"
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
    default: return "Unknown"
  }
}

export function BookingHeader({
  booking,
  title,
  backHref,
  backLabel = "Back to Bookings",
  className,
  actions,
  extra,
}: BookingHeaderProps) {
  const status = booking.status
  const badgeLabel = getStatusLabel(status)
  const badgeStyles = getStatusBadgeStyles(status)

  const studentName = booking.student
    ? [booking.student.first_name, booking.student.last_name].filter(Boolean).join(" ") || booking.student.email
    : null

  const instructorName = booking.instructor
    ? (() => {
        // Use user names as the source of truth (fallback to instructor table for backward compatibility)
        const firstName = booking.instructor.user?.first_name ?? booking.instructor.first_name
        const lastName = booking.instructor.user?.last_name ?? booking.instructor.last_name
        return [firstName, lastName].filter(Boolean).join(" ") || booking.instructor.user?.email
      })()
    : null

  const aircraftLabel = booking.aircraft?.registration || "TBD"

  const dateLabel = booking.start_time ? new Date(booking.start_time).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) : "TBD"

  return (
    <div className={cn(
      "border-b border-border/40 bg-background pt-4 pb-4 sm:pt-6 sm:pb-6",
      className
    )}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Row: Back Button & Status Badge */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
          >
            <IconArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            {backLabel}
          </Link>
          
          <div className="flex items-center gap-2">
            {extra}
            <Badge 
              className={cn(
                "text-xs sm:text-xs font-bold uppercase tracking-wider px-2.5 py-1 sm:px-3 sm:py-1 rounded-full border-none shadow-sm",
                badgeStyles,
                status === 'flying' && "animate-pulse"
              )}
            >
              {status === 'flying' && <IconPlane className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1.5 inline shadow-sm" />}
              {badgeLabel}
            </Badge>
          </div>
        </div>

        {/* Title and Info Grid */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex flex-col gap-3 sm:gap-4 flex-1">
            <h1 className="text-2xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
              {title}
            </h1>

            {/* Info Bar */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:text-sm text-muted-foreground">
              {/* Member */}
              {studentName && (
                <div className="flex items-center gap-1.5">
                  <IconUser className="h-4 w-4" />
                  <span className="font-medium text-foreground/70">Member:</span>
                  <Link 
                    href={`/members/${booking.user_id}`} 
                    target="_blank"
                    className="text-foreground font-semibold hover:text-primary transition-colors inline-flex items-center gap-1"
                  >
                    {studentName}
                    <IconExternalLink className="h-3 w-3 opacity-40" />
                  </Link>
                </div>
              )}

              {/* Instructor */}
              {instructorName && (
                <div className="flex items-center gap-1.5">
                  <IconSchool className="h-4 w-4" />
                  <span className="font-medium text-foreground/70">Instructor:</span>
                  <span className="text-foreground font-semibold">{instructorName}</span>
                </div>
              )}

              {/* Aircraft */}
              <div className="flex items-center gap-1.5">
                <IconPlane className="h-4 w-4" />
                <span className="font-medium text-foreground/70">Aircraft:</span>
                {booking.aircraft_id ? (
                  <Link 
                    href={`/aircraft/${booking.aircraft_id}`} 
                    target="_blank"
                    className="text-foreground font-semibold hover:text-primary transition-colors inline-flex items-center gap-1"
                  >
                    {aircraftLabel}
                    <IconExternalLink className="h-3 w-3 opacity-40" />
                  </Link>
                ) : (
                  <span className="text-foreground font-semibold">{aircraftLabel}</span>
                )}
              </div>

              {/* Date */}
              <div className="flex items-center gap-1.5">
                <IconCalendar className="h-4 w-4" />
                <span className="font-medium text-foreground/70">Date:</span>
                <span className="text-foreground font-semibold">{dateLabel}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {actions && (
            <div className="flex items-center justify-start sm:justify-end gap-2 sm:gap-3 flex-wrap w-full sm:w-auto mt-1 sm:mt-0">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
