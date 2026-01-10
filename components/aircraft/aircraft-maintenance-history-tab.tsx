"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { 
  IconDotsVertical, 
  IconEdit, 
  IconTool, 
  IconAlertTriangle, 
  IconClock, 
  IconChevronRight,
  IconCoin,
  IconSearch
} from "@tabler/icons-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import type { MaintenanceVisit } from "@/lib/types/maintenance_visits"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import EditMaintenanceHistoryModal from "./EditMaintenanceHistoryModal"

interface MaintenanceHistoryTabProps {
  aircraftId: string
}

interface MaintenanceVisitWithUser extends MaintenanceVisit {
  performed_by_user?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
  component?: {
    id: string
    name: string
  } | null
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—"
  try {
    return format(new Date(dateString), "dd MMM yyyy")
  } catch {
    return "—"
  }
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "—"
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) {
    return "—"
  }
  return `${hours.toFixed(1)}h`
}

function getUserName(visit: MaintenanceVisitWithUser): string {
  if (visit.performed_by_user) {
    const name = [
      visit.performed_by_user.first_name,
      visit.performed_by_user.last_name,
    ]
      .filter(Boolean)
      .join(" ")
    return name || visit.performed_by_user.email || "—"
  }
  return "—"
}

function getVisitTypeBadge(type: string): { label: string; className: string } {
  const typeLower = type?.toLowerCase() || ""
  switch (typeLower) {
    case "scheduled":
      return { label: "SCHEDULED", className: "bg-emerald-50 text-emerald-600 border-emerald-100" }
    case "unscheduled":
      return { label: "UNSCHEDULED", className: "bg-amber-50 text-amber-700 border-amber-100" }
    case "inspection":
      return { label: "INSPECTION", className: "bg-indigo-50 text-indigo-700 border-indigo-100" }
    case "repair":
      return { label: "REPAIR", className: "bg-red-50 text-red-700 border-red-100" }
    case "modification":
      return { label: "MODIFICATION", className: "bg-violet-50 text-violet-700 border-violet-100" }
    default:
      return { label: type?.toUpperCase() || "MAINTENANCE", className: "bg-slate-100 text-slate-600 border-slate-200" }
  }
}

export function AircraftMaintenanceHistoryTab({ aircraftId }: MaintenanceHistoryTabProps) {
  const [editModalOpen, setEditModalOpen] = React.useState(false)
  const [selectedVisitId, setSelectedVisitId] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])

  const {
    data: visits,
    isLoading,
    isError,
    refetch,
  } = useQuery<MaintenanceVisitWithUser[]>({
    queryKey: ["maintenance-visits", aircraftId],
    queryFn: async () => {
      const res = await fetch(`/api/maintenance-visits?aircraft_id=${aircraftId}`)
      if (!res.ok) throw new Error("Failed to fetch maintenance visits")
      return res.json()
    },
  })

  const handleEdit = (visitId: string) => {
    setSelectedVisitId(visitId)
    setEditModalOpen(true)
  }

  const handleEditClose = () => {
    setEditModalOpen(false)
    setSelectedVisitId(null)
    refetch()
  }

  // Filter by search
  const filteredVisits = React.useMemo(() => {
    if (!visits) return []
    if (!search) return visits

    const searchLower = search.toLowerCase()
    return visits.filter((visit) => {
      const description = visit.description?.toLowerCase() || ""
      const type = visit.visit_type?.toLowerCase() || ""
      const componentName = visit.component?.name?.toLowerCase() || ""
      const techName = getUserName(visit).toLowerCase()

      return (
        description.includes(searchLower) ||
        type.includes(searchLower) ||
        componentName.includes(searchLower) ||
        techName.includes(searchLower)
      )
    })
  }, [visits, search])

  const columns = React.useMemo<ColumnDef<MaintenanceVisitWithUser>[]>(() => [
    {
      accessorKey: "visit_date",
      header: "Visit Date",
      cell: ({ row }) => {
        const visit = row.original
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900">{formatDate(visit.visit_date)}</span>
            {visit.date_out_of_maintenance && (
              <span className="text-xs text-slate-600">
                Out: {formatDate(visit.date_out_of_maintenance)}
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "visit_type",
      header: "Type",
      cell: ({ row }) => {
        const { label, className } = getVisitTypeBadge(row.original.visit_type)
        return (
          <Badge variant="outline" className={cn("text-xs font-medium px-2 py-0.5", className)}>
            {label}
          </Badge>
        )
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <div className="max-w-xs xl:max-w-md">
          <p className="font-medium text-slate-700 line-clamp-2 leading-relaxed">
            {row.original.description || "—"}
          </p>
          {row.original.component && (
            <span className="text-xs font-medium text-indigo-600 mt-1 inline-block">
              {row.original.component.name}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "performed_by",
      header: "Technician",
      cell: ({ row }) => (
        <span className="font-medium text-slate-600">{getUserName(row.original)}</span>
      ),
    },
    {
      accessorKey: "hours_at_visit",
      header: "Tach Hours",
      cell: ({ row }) => (
        <span className="font-semibold text-slate-900">{formatHours(row.original.hours_at_visit)}</span>
      ),
    },
    {
      accessorKey: "total_cost",
      header: () => <div className="text-right">Cost</div>,
      cell: ({ row }) => (
        <div className="text-right font-semibold text-slate-900">
          {formatCurrency(row.original.total_cost)}
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end items-center gap-2 pr-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50" onClick={(e) => e.stopPropagation()}>
                <IconDotsVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl border-slate-200 shadow-xl p-1">
              <DropdownMenuItem onClick={() => handleEdit(row.original.id)} className="rounded-lg py-2 text-xs font-medium cursor-pointer">
                <IconEdit className="w-4 h-4 mr-2 text-slate-400" /> Edit Details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <IconChevronRight className="w-4 h-4 text-slate-300 ml-1" />
        </div>
      ),
    },
  ], [])

  const table = useReactTable({
    data: filteredVisits,
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
        <Skeleton className="w-full h-12 rounded-xl" />
        <Skeleton className="w-full h-32 rounded-[20px]" />
        <Skeleton className="w-full h-32 rounded-[20px]" />
      </div>
    )
  }

  if (isError) {
    return (
      <Card className="p-12 border-red-100 bg-red-50/30">
        <div className="flex flex-col items-center justify-center gap-3 text-red-600">
          <IconAlertTriangle className="h-10 w-10 opacity-50" />
          <p className="text-sm font-bold">Failed to load maintenance history.</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Maintenance History</h2>
          <p className="text-slate-500 mt-1">
            Track and manage all maintenance visits for this aircraft.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative w-full sm:w-auto">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-64 h-10 border-slate-200 bg-white focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:border-slate-300"
            />
          </div>
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
                        header.id === "total_cost" ? "text-right" : "text-left"
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
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="group transition-colors hover:bg-slate-50/50 cursor-pointer"
                  onClick={() => handleEdit(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td 
                      key={cell.id} 
                      className={cn(
                        "px-4 py-3.5 align-middle",
                        cell.column.id === "actions" ? "pr-6" : ""
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center text-slate-500 font-medium">
                  No maintenance visits recorded.
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
            const visit = row.original
            const { label: typeLabel, className: typeClass } = getVisitTypeBadge(visit.visit_type)
            
            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50 transition-colors"
                onClick={() => handleEdit(visit.id)}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-900 rounded-l-lg" />
                
                <div className="flex justify-between items-start mb-3 pl-2">
                  <div className="flex flex-col">
                    <h3 className="font-semibold text-slate-900">
                      {visit.visit_type || "Maintenance Visit"}
                    </h3>
                    <span className="text-xs text-slate-600">{formatDate(visit.visit_date)}</span>
                  </div>
                  <Badge variant="outline" className={cn("text-xs font-medium px-2 py-0.5", typeClass)}>
                    {typeLabel}
                  </Badge>
                </div>

                {visit.description && (
                  <div className="pl-2 mb-3">
                    <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                      {visit.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <IconClock className="w-3 h-3" /> Hours
                    </div>
                    <div className="font-semibold text-sm text-slate-700">
                      {formatHours(visit.hours_at_visit)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <IconCoin className="w-3 h-3" /> Cost
                    </div>
                    <div className="font-semibold text-sm text-slate-700">
                      {formatCurrency(visit.total_cost)}
                    </div>
                  </div>
                  {visit.component && (
                    <div className="space-y-1 col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                        <IconTool className="w-3 h-3" /> Component
                      </div>
                      <div className="font-semibold text-sm text-slate-700">
                        {visit.component.name}
                      </div>
                    </div>
                  )}
                </div>

                <div className="absolute right-4 bottom-4">
                  <IconChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-200 text-slate-500 font-medium">
            No maintenance visits found.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to <span className="font-semibold text-slate-900">{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredVisits.length)}</span> of <span className="font-semibold text-slate-900">{filteredVisits.length}</span> visits
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-9 border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-9 border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Edit Modal */}
      <EditMaintenanceHistoryModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        maintenanceVisitId={selectedVisitId}
        onSuccess={handleEditClose}
      />
    </div>
  )
}

