"use client"

import * as React from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { Loader2, Plane, User, MessageSquare, Calendar, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface FlightTrainingComment {
  id: string
  date: string
  instructor_comments: string | null
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50/30 rounded-xl border border-dashed border-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-4" />
        <p className="text-sm text-slate-500 font-semibold tracking-tight">Loading instructor comments...</p>
        <p className="text-xs text-slate-400 mt-1">Fetching latest training records</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center">
        <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-6 w-6 text-rose-600" />
        </div>
        <h4 className="text-sm font-bold text-rose-900 mb-1">Unable to load comments</h4>
        <p className="text-xs text-rose-600 max-w-[300px] mx-auto mb-6">
          {error instanceof Error ? error.message : "A connection error occurred while fetching training data."}
        </p>
        <button 
          onClick={() => refetch()}
          className="bg-white hover:bg-rose-100 text-rose-700 text-xs font-bold py-2 px-4 rounded-lg border border-rose-200 transition-colors shadow-sm"
        >
          Try Again
        </button>
      </div>
    )
  }

  const allComments = data?.pages.flat() ?? []

  if (allComments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-16 text-center bg-slate-50/30">
        <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-sm font-bold text-slate-700">No instructor comments found</h3>
        <p className="text-xs text-slate-500 mt-2 max-w-[280px] mx-auto leading-relaxed">
          Instructor comments recorded during flight lessons will appear here automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Instructor Feedback</h3>
        </div>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {allComments.length} Records
        </span>
      </div>

      <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-6 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-slate-500 w-[160px]">Date</th>
              <th className="px-6 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-slate-500 w-[140px]">Aircraft</th>
              <th className="px-6 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-slate-500 w-[200px]">Instructor</th>
              <th className="px-6 py-3 text-left font-bold text-[11px] uppercase tracking-wider text-slate-500">Comments</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allComments.map((comment) => (
              <tr key={comment.id} className="group transition-colors hover:bg-slate-50/50">
                <td className="px-6 py-4 align-middle">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-300" />
                    <span className="text-slate-700 font-bold">{formatDateTime(comment.date)}</span>
                  </div>
                </td>
                <td className="px-6 py-4 align-middle">
                  <div className="flex items-center gap-2">
                    <Plane className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-slate-900">{comment.booking?.aircraft?.registration || "-"}</span>
                  </div>
                </td>
                <td className="px-6 py-4 align-middle">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium text-slate-700">
                      {comment.instructor?.user?.first_name} {comment.instructor?.user?.last_name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 align-middle">
                  <p className="text-slate-600 leading-relaxed italic text-[13px] border-l-2 border-indigo-100 pl-3 py-1 bg-indigo-50/20 rounded-r-md">
                    {comment.instructor_comments || "No comments recorded"}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {allComments.map((comment) => (
          <div key={comment.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
            <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-bold text-xs text-slate-900">{formatDateTime(comment.date)}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded text-[10px] font-bold text-slate-600 border border-slate-100">
                <Plane className="w-2.5 h-2.5" />
                {comment.booking?.aircraft?.registration || "-"}
              </div>
            </div>
            
            <div className="mb-4">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Instructor</div>
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                <User className="w-3 h-3 text-slate-400" />
                {comment.instructor?.user?.first_name} {comment.instructor?.user?.last_name}
              </div>
            </div>

            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Comments</div>
              <p className="text-[13px] text-slate-600 leading-relaxed italic border-l-2 border-indigo-100 pl-3 py-1 bg-indigo-50/20 rounded-r-md">
                {comment.instructor_comments || "No comments recorded"}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Load More Trigger */}
      <div ref={loadMoreRef} className="h-12 w-full flex items-center justify-center pt-4">
        {isFetchingNextPage ? (
          <div className="flex items-center gap-2 text-indigo-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Loading more...</span>
          </div>
        ) : hasNextPage ? (
          <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-100 animate-pulse w-full" />
          </div>
        ) : allComments.length > 0 ? (
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">End of comments</p>
        ) : null}
      </div>
    </div>
  )
}
