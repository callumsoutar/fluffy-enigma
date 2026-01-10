"use client"

import * as React from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { Loader2, MessageSquare, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import DebriefPreviewSheet from "../debrief/debrief-preview-sheet"

interface FlightTrainingComment {
  id: string
  date: string
  instructor_comments: string | null
  booking_id: string
  booking: {
    aircraft: {
      registration: string
    } | null
  } | null
  instructor: {
    user: {
      first_name: string | null
      last_name: string | null
    } | null
  } | null
}

interface MemberFlightTrainingTableProps {
  memberId: string
}

const PAGE_SIZE = 5

async function fetchComments(memberId: string, { pageParam = 0 }): Promise<FlightTrainingComment[]> {
  const response = await fetch(`/api/members/${memberId}/training/comments?offset=${pageParam}&limit=${PAGE_SIZE}`)
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }
  
  const data = await response.json()
  return data.comments
}

export function MemberFlightTrainingTable({ memberId }: MemberFlightTrainingTableProps) {
  const loadMoreRef = React.useRef<HTMLDivElement>(null)
  const [previewBookingId, setPreviewBookingId] = React.useState<string | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false)

  const handleOpenPreview = (bookingId: string) => {
    setPreviewBookingId(bookingId)
    setIsPreviewOpen(true)
  }

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["member-flight-training-comments", memberId],
    queryFn: (params) => fetchComments(memberId, params),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined
      return allPages.length * PAGE_SIZE
    },
    enabled: !!memberId,
    retry: 1,
  })

  // Infinite scroll observer
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 }
    )

    const currentRef = loadMoreRef.current
    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
      observer.disconnect()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return "-"
    try {
      return format(new Date(value), "MMM d, yyyy")
    } catch {
      return "-"
    }
  }

  // Sanitize HTML to allow only safe tags (p, br, strong, em, ul, ol, li, etc.)
  const sanitizeHTML = (html: string | null): string => {
    if (!html) return "-"
    // Remove script tags and their content
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove iframe tags
    sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    // Remove object and embed tags
    sanitized = sanitized.replace(/<(object|embed)\b[^<]*(?:(?!<\/(object|embed)>)<[^<]*)*<\/(object|embed)>/gi, "")
    // Remove on* event handlers from remaining tags
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "")
    return sanitized
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50/30 rounded-lg border border-dashed border-slate-200">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400 mb-4" />
        <p className="text-sm text-slate-500">Loading instructor comments...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-5 w-5 text-slate-400" />
        </div>
        <h4 className="text-sm font-semibold text-slate-900 mb-1">Unable to load comments</h4>
        <p className="text-xs text-slate-500 max-w-[300px] mx-auto mb-6">
          {error instanceof Error ? error.message : "A connection error occurred while fetching training data."}
        </p>
        <button 
          onClick={() => refetch()}
          className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold py-2 px-4 rounded-md border border-slate-200 transition-colors shadow-sm"
        >
          Try Again
        </button>
      </div>
    )
  }

  const allComments = data?.pages.flat() ?? []

  if (allComments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-16 text-center bg-slate-50/30">
        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-6 h-6 text-slate-300" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">No instructor comments found</h3>
        <p className="text-xs text-slate-500 mt-2 max-w-[280px] mx-auto leading-relaxed">
          Instructor comments recorded during flight lessons will appear here automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-1 mb-2">
        <h3 className="text-sm font-semibold text-slate-900">Instructor Feedback</h3>
        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          {allComments.length} Records
        </span>
      </div>

      <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-6 py-3 text-left font-semibold text-xs text-slate-500 w-[160px]">Date</th>
              <th className="px-6 py-3 text-left font-semibold text-xs text-slate-500 w-[140px]">Aircraft</th>
              <th className="px-6 py-3 text-left font-semibold text-xs text-slate-500 w-[200px]">Instructor</th>
              <th className="px-6 py-3 text-left font-semibold text-xs text-slate-500">Comments</th>
              <th className="px-6 py-3 text-right font-semibold text-xs text-slate-500 w-[100px]">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allComments.map((comment) => (
              <tr key={comment.id} className="transition-colors hover:bg-slate-50/50">
                <td className="px-6 py-4 align-middle whitespace-nowrap text-slate-700">
                  {formatDateTime(comment.date)}
                </td>
                <td className="px-6 py-4 align-middle text-slate-900 font-medium">
                  {comment.booking?.aircraft?.registration || "-"}
                </td>
                <td className="px-6 py-4 align-middle text-slate-700">
                  {comment.instructor?.user?.first_name} {comment.instructor?.user?.last_name}
                </td>
                <td className="px-6 py-4 align-middle">
                  <div 
                    className="text-slate-600 leading-normal line-clamp-2"
                    dangerouslySetInnerHTML={{ 
                      __html: sanitizeHTML(comment.instructor_comments) 
                    }}
                  />
                </td>
                <td className="px-6 py-4 align-middle text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => handleOpenPreview(comment.booking_id)}
                  >
                    View Report
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        {allComments.map((comment) => (
          <div key={comment.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="font-semibold text-xs text-slate-900">{formatDateTime(comment.date)}</span>
              <span className="text-[10px] font-semibold text-slate-600">
                {comment.booking?.aircraft?.registration || "-"}
              </span>
            </div>
            
            <div className="mb-2">
              <div className="text-[10px] text-slate-500 mb-0.5">Instructor</div>
              <div className="text-xs text-slate-900 font-medium">
                {comment.instructor?.user?.first_name} {comment.instructor?.user?.last_name}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-slate-500 mb-1">Comments</div>
              <div 
                className="text-sm text-slate-600 leading-normal line-clamp-3"
                dangerouslySetInnerHTML={{ 
                  __html: sanitizeHTML(comment.instructor_comments) 
                }}
              />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs font-semibold"
                onClick={() => handleOpenPreview(comment.booking_id)}
              >
                View Full Debrief Report
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Load More Trigger */}
      <div ref={loadMoreRef} className="h-12 w-full flex items-center justify-center pt-4">
        {isFetchingNextPage ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[10px] font-medium uppercase tracking-widest">Loading more...</span>
          </div>
        ) : hasNextPage ? (
          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-slate-200 animate-pulse w-full" />
          </div>
        ) : allComments.length > 0 ? (
          <p className="text-[10px] font-medium text-slate-300 uppercase tracking-widest">End of records</p>
        ) : null}
      </div>

      <DebriefPreviewSheet
        bookingId={previewBookingId}
        isOpen={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />
    </div>
  )
}
