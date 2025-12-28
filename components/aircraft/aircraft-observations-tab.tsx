"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { IconPlus, IconAlertTriangle, IconUser, IconCalendar, IconCheck, IconChevronRight } from "@tabler/icons-react"
import { format } from "date-fns"
import type { ObservationWithUser } from "@/lib/types/observations"
import { cn } from "@/lib/utils"
import { AddObservationModal } from "./AddObservationModal"
import { ViewObservationModal } from "./ViewObservationModal"
import { ResolveObservationModal } from "./ResolveObservationModal"
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table"

interface ObservationsTabProps {
  aircraftId: string
}

const priorityBadge: Record<string, { label: string; className: string }> = {
  low: { label: "LOW", className: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  medium: { label: "MEDIUM", className: "bg-amber-50 text-amber-700 border-amber-100" },
  high: { label: "HIGH", className: "bg-red-50 text-red-700 border-red-100" },
}

const stageBadge: Record<string, { label: string; className: string }> = {
  open: { label: "OPEN", className: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  investigation: { label: "INVESTIGATING", className: "bg-orange-50 text-orange-700 border-orange-100" },
  resolution: { label: "RESOLVING", className: "bg-violet-50 text-violet-700 border-violet-100" },
  closed: { label: "CLOSED", className: "bg-slate-100 text-slate-600 border-slate-200" },
}

export function AircraftObservationsTab({ aircraftId }: ObservationsTabProps) {
  const [view, setView] = React.useState<"open" | "all">("open")
  const [modalOpen, setModalOpen] = React.useState(false)
  const [selectedObservationId, setSelectedObservationId] = React.useState<string | null>(null)
  const [resolveObservationId, setResolveObservationId] = React.useState<string | null>(null)
  const [sorting, setSorting] = React.useState<SortingState>([])

  const {
    data: observations,
    isLoading,
    isError,
    refetch,
  } = useQuery<ObservationWithUser[]>({
    queryKey: ["observations", aircraftId],
    queryFn: async () => {
      const res = await fetch(`/api/observations?aircraft_id=${aircraftId}`)
      if (!res.ok) throw new Error("Failed to fetch observations")
      return res.json()
    },
  })

  const getUserName = (observation: ObservationWithUser) => {
    if (observation.reported_by_user) {
      const name = [
        observation.reported_by_user.first_name,
        observation.reported_by_user.last_name,
      ]
        .filter(Boolean)
        .join(" ")
      return name || observation.reported_by_user.email || "Unknown"
    }
    return "Unknown"
  }

  // Filter observations based on view
  const filteredObservations = React.useMemo(() => {
    if (!observations) return []
    return view === "open"
      ? observations.filter((o) => o.stage !== "closed")
      : observations
  }, [observations, view])

  const columns = React.useMemo<ColumnDef<ObservationWithUser>[]>(() => [
    {
      accessorKey: "name",
      header: "Observation",
      cell: ({ row }) => {
        const obs = row.original
        return (
          <div className="relative">
            <div className="flex flex-col pl-2">
              <span className="font-semibold text-slate-900">{obs.name}</span>
              <span className="text-xs text-slate-600 mt-0.5">
                {format(new Date(obs.created_at), "dd MMM yyyy · HH:mm")}
              </span>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "stage",
      header: "Stage",
      cell: ({ row }) => {
        const stage = row.original.stage
        const { label, className } = stageBadge[stage] || stageBadge.open
        return (
          <Badge variant="outline" className={cn("text-xs font-medium px-2 py-0.5 uppercase", className)}>
            {label}
          </Badge>
        )
      },
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => {
        const priority = row.original.priority || "medium"
        const { label, className } = priorityBadge[priority] || priorityBadge.medium
        return (
          <Badge variant="outline" className={cn("text-xs font-medium px-2 py-0.5 uppercase", className)}>
            {label}
          </Badge>
        )
      },
    },
    {
      accessorKey: "reported_by",
      header: "Reported By",
      cell: ({ row }) => {
        const name = getUserName(row.original)
        return <span className="font-medium text-slate-600">{name}</span>
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const obs = row.original
        return (
          <div className="flex items-center justify-end gap-2">
            {obs.stage !== "closed" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-medium border-slate-200 text-slate-600 hover:bg-slate-50"
                onClick={(e) => {
                  e.stopPropagation()
                  setResolveObservationId(obs.id)
                }}
              >
                <IconCheck className="h-3.5 w-3.5 mr-1.5" />
                Resolve
              </Button>
            )}
            <IconChevronRight className="w-4 h-4 text-slate-400 ml-2" />
          </div>
        )
      },
    },
  ], [])

  const table = useReactTable({
    data: filteredObservations,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { sorting },
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="w-full h-12 rounded-lg" />
        <Skeleton className="w-full h-32 rounded-lg" />
        <Skeleton className="w-full h-32 rounded-lg" />
      </div>
    )
  }

  if (isError) {
    return (
      <Card className="p-12 border-red-100 bg-red-50/30">
        <div className="flex flex-col items-center justify-center gap-3 text-red-600">
          <IconAlertTriangle className="h-10 w-10 opacity-50" />
          <p className="text-sm font-medium">Failed to load observations.</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6 mt-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Observations</h2>
          <p className="text-slate-600 mt-1">Manage and track maintenance observations and issues.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-lg w-full sm:w-auto">
            <button
              onClick={() => setView("open")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-medium transition-all flex-1 sm:flex-none",
                view === "open"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              )}
            >
              Open
            </button>
            <button
              onClick={() => setView("all")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-medium transition-all flex-1 sm:flex-none",
                view === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              )}
            >
              All
            </button>
          </div>
          <Button
            className="bg-slate-900 text-white font-semibold h-10 px-5 hover:bg-slate-800 w-full sm:w-auto"
            onClick={() => setModalOpen(true)}
          >
            <IconPlus className="h-4 w-4 mr-2" />
            Add Observation
          </Button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              {table.getHeaderGroups().map(headerGroup => (
                <React.Fragment key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id}
                      className={cn(
                        "px-4 py-3 font-semibold text-xs uppercase tracking-wide text-slate-600",
                        header.id === "actions" ? "text-right" : "text-left"
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const obs = row.original
                const priority = obs.priority || "medium"
                
                const borderClass = cn(
                  "w-1 absolute left-0 top-0 bottom-0",
                  priority === "high" ? "bg-red-500" :
                  priority === "medium" ? "bg-amber-400" :
                  "bg-emerald-400"
                )
                
                return (
                  <tr
                    key={row.id}
                    className="group transition-colors hover:bg-slate-50/50 cursor-pointer"
                    onClick={() => setSelectedObservationId(row.original.id)}
                  >
                    {row.getVisibleCells().map((cell, index) => (
                      <td 
                        key={cell.id} 
                        className={cn(
                          "py-3.5 align-middle",
                          index === 0 ? "relative px-4" : "px-4",
                          cell.column.id === "actions" ? "pr-6" : ""
                        )}
                      >
                        {index === 0 && <div className={borderClass} />}
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center text-slate-500 font-medium py-12">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <IconAlertTriangle className="h-8 w-8 opacity-20" />
                    <p>No observations found.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => {
            const obs = row.original
            const { label: statusLabel, className: statusClass } = stageBadge[obs.stage] || stageBadge.open
            const { label: priorityLabel, className: priorityClass } = priorityBadge[obs.priority || "medium"] || priorityBadge.medium
            const priority = obs.priority || "medium"
            
            const borderClass = cn(
              "absolute left-0 top-0 bottom-0 w-1",
              priority === "high" ? "bg-red-500" :
              priority === "medium" ? "bg-amber-400" :
              "bg-emerald-400"
            )
            
            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50 transition-colors"
                onClick={() => setSelectedObservationId(obs.id)}
              >
                <div className={borderClass} />
                
                <div className="flex justify-between items-start mb-3 pl-2">
                  <div className="pr-2 flex-1">
                    <h3 className="font-semibold text-slate-900">{obs.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline" className={cn("text-xs font-medium px-2 py-0.5", statusClass)}>
                        {statusLabel}
                      </Badge>
                      <Badge variant="outline" className={cn("text-xs font-medium px-2 py-0.5", priorityClass)}>
                        {priorityLabel}
                      </Badge>
                    </div>
                  </div>
                  <IconChevronRight className="w-4 h-4 text-slate-400" />
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <IconCalendar className="w-3 h-3" /> Reported
                    </div>
                    <div className="font-semibold text-sm text-slate-700">
                      {format(new Date(obs.created_at), "dd MMM yyyy")}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <IconUser className="w-3 h-3" /> By
                    </div>
                    <div className="font-semibold text-sm text-slate-900 truncate">
                      {getUserName(obs)}
                    </div>
                  </div>
                </div>

                {obs.stage !== "closed" && (
                  <div className="mt-4 pt-4 border-t border-slate-100 pl-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-10 font-medium border-slate-200 text-slate-600 active:bg-slate-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        setResolveObservationId(obs.id)
                      }}
                    >
                      <IconCheck className="h-4 w-4 mr-2" />
                      Resolve Observation
                    </Button>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-200 text-slate-500 font-medium">
            <div className="flex flex-col items-center justify-center gap-2">
              <IconAlertTriangle className="h-8 w-8 opacity-20" />
              <p>No observations found.</p>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredObservations.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-slate-500 font-medium">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredObservations.length)} of {filteredObservations.length} observations
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddObservationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        aircraftId={aircraftId}
        refresh={refetch}
      />
      {selectedObservationId && (
        <ViewObservationModal
          open={!!selectedObservationId}
          onClose={() => setSelectedObservationId(null)}
          observationId={selectedObservationId}
          refresh={refetch}
        />
      )}
      {resolveObservationId && (
        <ResolveObservationModal
          open={!!resolveObservationId}
          onClose={() => setResolveObservationId(null)}
          observationId={resolveObservationId}
          refresh={refetch}
        />
      )}
    </div>
  )
}
