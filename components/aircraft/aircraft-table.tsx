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
import { IconPlane } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { AircraftWithType } from "@/lib/types/aircraft"

interface AircraftTableProps {
  aircraft: AircraftWithType[]
}

function getStatusBadge(status: string | null): { label: string; variant: "default" | "destructive" | "outline" | "secondary" } {
  if (!status) {
    return { label: "Unknown", variant: "outline" }
  }
  
  const statusLower = status.toLowerCase()
  if (statusLower === "active") {
    return { label: "Active", variant: "default" }
  }
  
  return { label: status.charAt(0).toUpperCase() + status.slice(1), variant: "outline" }
}

function formatTotalHours(hours: number | null): string {
  if (hours === null || hours === undefined) {
    return "0h"
  }
  return `${hours.toFixed(1)}h`
}

const columns: ColumnDef<AircraftWithType>[] = [
  {
    accessorKey: "aircraft",
    header: "Aircraft",
    cell: ({ row }) => {
      const aircraft = row.original
      const registration = aircraft.registration || ""
      const model = aircraft.model || ""
      const imageUrl = aircraft.aircraft_image_url
      
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 rounded-full">
            {imageUrl ? (
              <AvatarImage src={imageUrl} alt={registration} />
            ) : null}
            <AvatarFallback className="bg-gray-100 text-gray-600 text-xs font-medium">
              {registration.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{registration}</span>
            {model && (
              <span className="text-sm text-muted-foreground">{model}</span>
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
      const type = row.original.type || ""
      return <span>{type}</span>
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status
      const { label, variant } = getStatusBadge(status)
      
      return (
        <Badge variant={variant} className="bg-black text-white font-normal">
          {label}
        </Badge>
      )
    },
  },
  {
    accessorKey: "total_hours",
    header: () => <div className="text-right">Total Hours</div>,
    cell: ({ row }) => {
      const hours = row.original.total_hours
      return (
        <div className="text-right font-medium">
          {formatTotalHours(hours)}
        </div>
      )
    },
  },
]

export function AircraftTable({ aircraft }: AircraftTableProps) {
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const router = useRouter()
  const { role } = useAuth()

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
    <div className="bg-white rounded-lg shadow p-6 flex flex-col gap-6">
      {/* Header with title, search, and Add Aircraft button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
        <h2 className="text-xl font-bold">Aircraft Fleet</h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:items-center justify-end">
          <Input
            placeholder="Search aircraft..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-56"
          />
          {canAddAircraft && (
            <Button
              className="bg-[#6564db] hover:bg-[#232ed1] text-white font-semibold px-4 py-2 rounded-md shadow text-base flex items-center gap-2"
              onClick={() => {
                // TODO: Open Add Aircraft modal
                console.log('Add aircraft clicked')
              }}
            >
              <IconPlane className="h-4 w-4" />
              Add Aircraft
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const id = row.original?.id
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={id ? "cursor-pointer hover:bg-indigo-50 transition" : undefined}
                    onClick={() => {
                      if (id) {
                        router.push(`/aircraft/${id}`)
                      }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
