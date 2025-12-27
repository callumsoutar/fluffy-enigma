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
  IconCalendar, 
  IconClock, 
  IconUser, 
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
            <span className="font-bold text-slate-900">{formatDate(visit.visit_date)}</span>
            {visit.date_out_of_maintenance && (
              <span className="text-[10px] text-slate-500 font-medium">
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
          <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-none border uppercase tracking-wider", className)}>
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
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight mt-1 inline-block">
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
        <span className="font-bold text-slate-900">{formatHours(row.original.hours_at_visit)}</span>
      ),
    },
    {
      accessorKey: "total_cost",
      header: () => <div className="text-right">Cost</div>,
      cell: ({ row }) => (
        <div className="text-right font-bold text-slate-900">
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
              className="pl-9 w-full sm:w-64 h-11 rounded-xl border-slate-200 bg-white shadow-sm focus:ring-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              {table.getHeaderGroups().map(headerGroup => (
                <React.Fragment key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id}
                      className={cn(
                        "px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-slate-500",
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
          <tbody className="divide-y divide-slate-50">
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
                        "px-4 py-4 align-middle",
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
                <td colSpan={columns.length} className="h-24 text-center text-slate-400 font-medium py-12">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <IconTool className="h-8 w-8 opacity-20" />
                    <p>No maintenance visits recorded.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => {
            const visit = row.original
            const { label: typeLabel, className: typeClass } = getVisitTypeBadge(visit.visit_type)
            
            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-[20px] border border-slate-100 bg-white p-4 shadow-sm active:bg-slate-50 transition-colors"
                onClick={() => handleEdit(visit.id)}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-100" />
                
                <div className="flex justify-between items-start mb-4 pl-2">
                  <div className="flex flex-col pr-8">
                    <h3 className="font-bold text-slate-900 leading-tight">
                      {visit.visit_type || "Maintenance Visit"}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline" className={cn("text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-none border uppercase tracking-wider", typeClass)}>
                        {typeLabel}
                      </Badge>
                      {visit.component && (
                        <Badge variant="outline" className="text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-none border border-slate-200 text-slate-500 uppercase tracking-wider">
                          {visit.component.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <IconChevronRight className="absolute right-4 top-4 w-4 h-4 text-slate-300" />
                </div>

                <div className="pl-2 mb-4">
                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed italic">
                    &quot;{visit.description || "No description provided."}&quot;
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2 border-t border-slate-50 pt-4">
                  <div className="space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <IconCalendar className="w-3 h-3" /> Date
                    </div>
                    <div className="font-bold text-[13px] text-slate-700 tracking-tight">
                      {formatDate(visit.visit_date)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <IconClock className="w-3 h-3" /> Hours
                    </div>
                    <div className="font-bold text-[13px] text-slate-900">
                      {formatHours(visit.hours_at_visit)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <IconUser className="w-3 h-3" /> Tech
                    </div>
                    <div className="font-bold text-[13px] text-slate-900 truncate">
                      {getUserName(visit)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <IconCoin className="w-3 h-3" /> Cost
                    </div>
                    <div className="font-bold text-[13px] text-emerald-600">
                      {formatCurrency(visit.total_cost)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-12 bg-white rounded-[20px] border border-dashed border-slate-200 text-slate-400 font-medium">
            <div className="flex flex-col items-center justify-center gap-2">
              <IconTool className="h-8 w-8 opacity-20" />
              <p>No maintenance visits found.</p>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="text-slate-900">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to <span className="text-slate-900">{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredVisits.length)}</span> of <span className="text-slate-900">{filteredVisits.length}</span> visits
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-lg h-8 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-lg h-8 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Edit Modal - Placeholder for now */}
      {editModalOpen && selectedVisitId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[20px] shadow-2xl p-6 sm:p-8 max-w-2xl w-full mx-4 border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <IconTool className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Edit Maintenance Visit</h3>
                <p className="text-sm text-slate-500 italic leading-relaxed">
                  Update the details of this recorded maintenance event.
                </p>
              </div>
            </div>
            
            <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-xl mb-6">
              <IconAlertTriangle className="h-8 w-8 text-amber-500 mb-2 opacity-50" />
              <p className="text-sm font-bold text-slate-400">Edit functionality pending implementation</p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleEditClose} className="rounded-xl h-11 px-6 font-bold border-slate-200">
                Cancel
              </Button>
              <Button onClick={handleEditClose} className="bg-slate-900 text-white font-bold rounded-xl h-11 px-8 hover:bg-slate-800">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
