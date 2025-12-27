"use client"

import * as React from "react"
import Link from "next/link"
import { IconArrowLeft, IconPlane } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import type { BookingStatus } from "@/lib/types/bookings"

interface BookingHeaderProps {
  status: BookingStatus
  title: string
  backHref: string
  backLabel?: string
  className?: string
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
      return ""
  }
}

export function BookingHeader({
  status,
  title,
  backHref,
  backLabel = "Back to Booking",
  className = "",
}: BookingHeaderProps) {
  const badgeVariant = getStatusBadgeVariant(status)
  const badgeLabel = getStatusLabel(status)
  const badgeStyles = getStatusBadgeStyles(status)

  return (
    <div className={`border-b border-border/40 bg-gradient-to-br from-slate-50 via-blue-50/30 to-background dark:from-slate-900 dark:via-slate-800/50 dark:to-background ${className}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Top Row: Back Button */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </div>

        {/* Title Row */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight text-foreground">
              {title}
            </h1>
            <Badge 
              variant={badgeVariant} 
              className={`text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 text-base font-semibold shadow-lg ${
                status === 'flying' ? 'animate-pulse' : ''
              } ${badgeStyles}`}
            >
              {status === 'flying' && <IconPlane className="h-5 w-5 mr-1" />}
              {badgeLabel}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}

