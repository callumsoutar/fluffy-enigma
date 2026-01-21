"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { useQueryClient } from "@tanstack/react-query"
import { IconSearch, IconChevronRight, IconClock, IconTag, IconPlus } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { AircraftWithType } from "@/lib/types/aircraft"
import { AddAircraftModal } from "@/components/aircraft/AddAircraftModal"
import { ReorderAircraftModal } from "@/components/aircraft/ReorderAircraftModal"
import { cn } from "@/lib/utils"

interface AircraftTableProps {
  aircraft: AircraftWithType[]
}

function getStatusBadge(status: string | null): { label: string; className: string } {
  if (!status) {
    return { label: "Unknown", className: "bg-slate-50 text-slate-700 border-slate-200" }
  }
  
  const statusLower = status.toLowerCase()
  if (statusLower === "active") {
    return { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
  }
  if (statusLower === "maintenance" || statusLower === "down") {
    return { label: status.toUpperCase(), className: "bg-amber-50 text-amber-700 border-amber-200" }
  }
  
  return { label: status.charAt(0).toUpperCase() + status.slice(1), className: "bg-slate-50 text-slate-700 border-slate-200" }
}

function formatTotalHours(hours: number | null): string {
  if (hours === null || hours === undefined) {
    return "0h"
  }
  return `${hours.toFixed(1)}h`
}

export function AircraftTable({ aircraft }: AircraftTableProps) {
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [addOpen, setAddOpen] = React.useState(false)
  const [reorderOpen, setReorderOpen] = React.useState(false)
  const router = useRouter()
  const { role } = useAuth()
  const queryClient = useQueryClient()

  // Filter by search
  const filteredAircraft = React.useMemo(() => {
    if (!search) return aircraft

    const searchLower = search.toLowerCase()
    return aircraft.filter((aircraft) => {
      const registration = aircraft.registration?.toLowerCase() || ""
      const model = aircraft.model?.toLowerCase() || ""
      const type = aircraft.type?.toLowerCase() || ""
      const aircraftTypeName = aircraft.aircraft_type?.name?.toLowerCase() || ""

      return (
        registration.includes(searchLower) ||
        model.includes(searchLower) ||
        type.includes(searchLower) ||
        aircraftTypeName.includes(searchLower)
      )
    })
  }, [aircraft, search])

  const columns = React.useMemo<ColumnDef<AircraftWithType>[]>(() => [
    {
      accessorKey: "registration",
      header: "Aircraft",
      cell: ({ row }) => {
        const aircraft = row.original
        const registration = aircraft.registration || ""
        const model = aircraft.model || ""
        const imageUrl = aircraft.aircraft_image_url
        
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 rounded-md">
              {imageUrl ? (
                <AvatarImage src={imageUrl} alt={registration} />
              ) : null}
              <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-semibold">
                {registration ? registration.substring(0, 2).toUpperCase() : "??"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold text-slate-900">{registration}</span>
              {model && (
                <span className="text-xs text-slate-600">{model}</span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.original.type || row.original.aircraft_type?.name || ""
        return <span className="text-slate-700">{type}</span>
      },
    },
    {
      accessorKey: "status",
      header: () => <div className="text-center">Status</div>,
      cell: ({ row }) => {
        const status = row.original.status
        const { label, className } = getStatusBadge(status)
        
        return (
          <div className="flex justify-center">
            <Badge variant="outline" className={cn("text-xs font-medium px-2 py-0.5", className)}>
              {label}
            </Badge>
          </div>
        )
      },
    },
    {
      accessorKey: "total_time_in_service",
      header: () => <div className="text-right">Total Hours</div>,
      cell: ({ row }) => {
        const hours = row.original.total_time_in_service
        return (
          <div className="text-right font-semibold text-slate-900">
            {formatTotalHours(hours)}
          </div>
        )
      },
    },
    {
      id: "actions",
      cell: () => (
        <div className="flex justify-end">
          <IconChevronRight className="w-4 h-4 text-slate-300" />
        </div>
      ),
    },
  ], [])

  const table = useReactTable<AircraftWithType>({
    data: filteredAircraft,
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

  const canAddAircraft = role && !['member', 'student'].includes(role.toLowerCase())

  return (
    <div className="flex flex-col gap-6">
      <AddAircraftModal open={addOpen} onOpenChange={setAddOpen} />
      <ReorderAircraftModal
        open={reorderOpen}
        onOpenChange={setReorderOpen}
        aircraft={aircraft}
        onSaved={async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["aircraft"] }),
            queryClient.invalidateQueries({ queryKey: ["scheduler", "aircraft"] }),
          ])
        }}
      />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Aircraft</h2>
          <p className="text-slate-600 mt-1">Manage your fleet and maintenance schedules.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative w-full sm:w-auto">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search aircraft..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-64 h-10 border-slate-200 bg-white focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:border-slate-300"
            />
          </div>
          {canAddAircraft && (
            <Button
              variant="outline"
              className="h-10 px-5 w-full sm:w-auto border-slate-200 text-slate-700 hover:bg-slate-50"
              onClick={() => setReorderOpen(true)}
            >
              Reorder
            </Button>
          )}
          {canAddAircraft && (
            <Button
              className="bg-slate-900 text-white font-semibold h-10 px-5 hover:bg-slate-800 w-full sm:w-auto"
              onClick={() => setAddOpen(true)}
            >
              <IconPlus className="h-4 w-4 mr-2" />
              Add Aircraft
            </Button>
          )}
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
                        header.id === "total_time_in_service" ? "text-right" : 
                        header.id === "status" ? "text-center" : "text-left"
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
                  onClick={() => router.push(`/aircraft/${row.original.id}`)}
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
                  No aircraft found.
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
            const aircraft = row.original
            const { label, className } = getStatusBadge(aircraft.status)
            
            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50 transition-colors"
                onClick={() => router.push(`/aircraft/${aircraft.id}`)}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-900 rounded-l-lg" />
                
                <div className="flex justify-between items-start mb-3 pl-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-md">
                      {aircraft.aircraft_image_url ? (
                        <AvatarImage src={aircraft.aircraft_image_url} alt={aircraft.registration} />
                      ) : null}
                      <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-semibold">
                        {aircraft.registration?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <h3 className="font-semibold text-slate-900">{aircraft.registration}</h3>
                      <span className="text-xs text-slate-600">{aircraft.model || "Unknown Model"}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("text-xs font-medium px-2 py-0.5", className)}>
                    {label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <IconTag className="w-3 h-3" /> Type
                    </div>
                    <div className="font-semibold text-sm text-slate-700">
                      {aircraft.type || aircraft.aircraft_type?.name || "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <IconClock className="w-3 h-3" /> Total Hours
                    </div>
                    <div className="font-semibold text-sm text-slate-900">
                      {formatTotalHours(aircraft.total_time_in_service)}
                    </div>
                  </div>
                </div>

                <div className="absolute right-4 bottom-4">
                  <IconChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-200 text-slate-500 font-medium">
            No aircraft found.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to <span className="font-semibold text-slate-900">{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredAircraft.length)}</span> of <span className="font-semibold text-slate-900">{filteredAircraft.length}</span> aircraft
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
    </div>
  )
}
