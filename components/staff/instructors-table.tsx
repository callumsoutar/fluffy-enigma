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
import { useRouter } from "next/navigation"
import { IconSearch, IconChevronRight, IconBriefcase, IconUserShare } from "@tabler/icons-react"
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { InstructorWithUser } from "@/lib/types/instructors"

interface InstructorsTableProps {
  instructors: InstructorWithUser[]
}

function getUserInitials(firstName: string | null, lastName: string | null, email: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase()
  }
  if (firstName) {
    return firstName.substring(0, 2).toUpperCase()
  }
  if (lastName) {
    return lastName.substring(0, 2).toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  casual: "Casual",
  contractor: "Contractor",
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  deactivated: "Deactivated",
  suspended: "Suspended",
}

function getStatusBadge(status: string | null): { label: string; className: string } {
  if (!status) {
    return { label: "Unknown", className: "bg-slate-100 text-slate-600 border-slate-200" }
  }
  
  const statusLower = status.toLowerCase()
  if (statusLower === "active") {
    return { label: "Active", className: "bg-emerald-50 text-emerald-600 border-emerald-100" }
  }
  if (statusLower === "inactive" || statusLower === "deactivated" || statusLower === "suspended") {
    return { label: STATUS_LABELS[statusLower] || status.toUpperCase(), className: "bg-red-50 text-red-600 border-red-100" }
  }
  
  return { label: status.charAt(0).toUpperCase() + status.slice(1), className: "bg-slate-100 text-slate-600 border-slate-200" }
}

export function InstructorsTable({ instructors }: InstructorsTableProps) {
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const router = useRouter()

  const filteredInstructors = React.useMemo(() => {
    if (!search) return instructors

    const query = search.toLowerCase()
    return instructors.filter((instructor) => {
      const firstName = instructor.user.first_name?.toLowerCase() || ""
      const lastName = instructor.user.last_name?.toLowerCase() || ""
      const email = instructor.user.email?.toLowerCase() || ""
      
      const employmentType = instructor.employment_type || ""
      const employmentLabel = employmentType ? (EMPLOYMENT_TYPE_LABELS[employmentType] || employmentType).toLowerCase() : "not assigned"
      
      const statusValue = instructor.status || ""
      const statusLabel = statusValue ? (STATUS_LABELS[statusValue] || statusValue).toLowerCase() : "unknown"

      const categoryName = instructor.rating_category?.name?.toLowerCase() || ""

      return (
        firstName.includes(query) ||
        lastName.includes(query) ||
        email.includes(query) ||
        employmentLabel.includes(query) ||
        statusLabel.includes(query) ||
        categoryName.includes(query)
      )
    })
  }, [search, instructors])

  const columns = React.useMemo<ColumnDef<InstructorWithUser>[]>(() => [
    {
      accessorKey: "user",
      header: "Staff Member",
      cell: ({ row }) => {
        const instructor = row.original
        const user = instructor.user
        const firstName = user.first_name || ""
        const lastName = user.last_name || ""
        const name = [firstName, lastName].filter(Boolean).join(" ") || user.email
        const initials = getUserInitials(firstName, lastName, user.email)

        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 rounded-full border border-slate-100">
              <AvatarFallback className="bg-slate-100 text-slate-500 text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900">{name}</span>
              <span className="text-[11px] text-slate-500 font-medium">{user.email}</span>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "employment_type",
      header: "Employment",
      cell: ({ row }) => {
        const { employment_type } = row.original
        const label = employment_type ? EMPLOYMENT_TYPE_LABELS[employment_type] || employment_type : "Not assigned"
        return <span className="font-medium text-slate-600">{label}</span>
      },
    },
    {
      accessorKey: "rating_category",
      header: "Category",
      cell: ({ row }) => {
        const category = row.original.rating_category?.name || "Not set"
        return <span className="font-medium text-slate-600">{category}</span>
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
            <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-none border uppercase tracking-wider", className)}>
              {label}
            </Badge>
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

  const table = useReactTable({
    data: filteredInstructors,
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

  return (
    <div className="flex flex-col gap-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Staff</h2>
          <p className="text-slate-500 mt-1">Manage your organization&apos;s instructors and staff members.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative w-full sm:w-auto">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search staff..."
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
          <tbody className="divide-y divide-slate-50">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="group transition-colors hover:bg-slate-50/50 cursor-pointer"
                  onClick={() => router.push(`/staff/instructors/${encodeURIComponent(row.original.id)}`)}
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
                <td colSpan={columns.length} className="h-24 text-center text-slate-400 font-medium">
                  No staff members found.
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
            const instructor = row.original
            const user = instructor.user
            const firstName = user.first_name || ""
            const lastName = user.last_name || ""
            const name = [firstName, lastName].filter(Boolean).join(" ") || user.email
            const initials = getUserInitials(firstName, lastName, user.email)
            const { label: statusLabel, className: statusClass } = getStatusBadge(instructor.status)
            const employmentLabel = instructor.employment_type ? EMPLOYMENT_TYPE_LABELS[instructor.employment_type] || instructor.employment_type : "Not assigned"
            
            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-[20px] border border-slate-100 bg-white p-4 shadow-sm active:bg-slate-50 transition-colors"
                onClick={() => router.push(`/staff/instructors/${encodeURIComponent(instructor.id)}`)}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-100" />
                
                <div className="flex justify-between items-start mb-4 pl-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-full border border-slate-50">
                      <AvatarFallback className="bg-slate-50 text-slate-400 text-xs font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <h3 className="font-bold text-slate-900">{name}</h3>
                      <span className="text-[11px] text-slate-500 font-medium">{user.email}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-none border uppercase tracking-wider", statusClass)}>
                    {statusLabel}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <IconBriefcase className="w-3 h-3" /> Employment
                    </div>
                    <div className="font-bold text-sm text-slate-700 uppercase tracking-tight">
                      {employmentLabel}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <IconUserShare className="w-3 h-3" /> Category
                    </div>
                    <div className="font-bold text-sm text-slate-700">
                      {instructor.rating_category?.name || "Not set"}
                    </div>
                  </div>
                </div>

                <div className="absolute right-4 bottom-4">
                  <IconChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-12 bg-white rounded-[20px] border border-dashed border-slate-200 text-slate-400 font-medium">
            No staff members found.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="text-slate-900">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to <span className="text-slate-900">{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredInstructors.length)}</span> of <span className="text-slate-900">{filteredInstructors.length}</span> staff members
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
    </div>
  )
}

