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
import { IconUserPlus } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"

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

const columns: ColumnDef<InstructorWithUser>[] = [
  {
    accessorKey: "user",
    header: "Instructor",
    cell: ({ row }) => {
      const instructor = row.original
      const user = instructor.user
      const firstName = user.first_name || ""
      const lastName = user.last_name || ""
      const name = [firstName, lastName].filter(Boolean).join(" ") || user.email
      const initials = getUserInitials(firstName, lastName, user.email)

      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 rounded-full bg-gray-100">
            <AvatarFallback className="bg-gray-100 text-gray-600 text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{name}</span>
        </div>
      )
    },
  },
  {
    accessorFn: (row) => row.user.email,
    id: "email",
    header: "Email",
    cell: ({ row }) => {
      return (
        <span className="text-muted-foreground">{row.original.user.email}</span>
      )
    },
  },
  {
    accessorKey: "employment_type",
    header: "Employment",
    cell: ({ row }) => {
      const { employment_type } = row.original
      return (
        <span>{employment_type || "Not assigned"}</span>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Instructor status",
    cell: ({ row }) => {
      const status = row.original.status || "Unknown"

      return (
        <Badge variant="outline" className="font-normal text-sm">
          {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "user",
    id: "active",
    header: "Active",
    cell: ({ row }) => {
      const isActive = row.original.user?.is_active

      return isActive ? (
        <Badge variant="default" className="bg-black text-white font-normal">
          Active
        </Badge>
      ) : (
        <Badge variant="destructive" className="bg-black text-white font-normal">
          Inactive
        </Badge>
      )
    },
  },
]

export function InstructorsTable({ instructors }: InstructorsTableProps) {
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const router = useRouter()
  const { role } = useAuth()

  const filteredInstructors = React.useMemo(() => {
    if (!search) return instructors

    const query = search.toLowerCase()
    return instructors.filter((instructor) => {
      const firstName = instructor.user.first_name?.toLowerCase() || ""
      const lastName = instructor.user.last_name?.toLowerCase() || ""
      const email = instructor.user.email?.toLowerCase() || ""
      const employment = instructor.employment_type?.toLowerCase() || ""
      const status = instructor.status?.toLowerCase() || ""

      return (
        firstName.includes(query) ||
        lastName.includes(query) ||
        email.includes(query) ||
        employment.includes(query) ||
        status.includes(query)
      )
    })
  }, [search, instructors])

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

  const canAddStaff = role && ["owner", "admin"].includes(role.toLowerCase())

  return (
    <div className="bg-white rounded-lg shadow p-6 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
        <h2 className="text-xl font-bold">Staff Directory</h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:items-center justify-end">
          <Input
            placeholder="Search staff..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full sm:w-56"
          />
          {canAddStaff && (
            <Button
              className="bg-[#6564db] hover:bg-[#232ed1] text-white font-semibold px-4 py-2 rounded-md shadow text-base flex items-center gap-2"
              onClick={() => {
                console.log("Add staff clicked")
              }}
            >
              <IconUserPlus className="h-4 w-4" />
              Add staff +
            </Button>
          )}
        </div>
      </div>

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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const instructor = row.original
                const userId = instructor.user_id

                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      "transition",
                      userId ? "cursor-pointer hover:bg-indigo-50" : undefined
                    )}
                    onClick={() => {
                      if (instructor.id) {
                        router.push(`/staff/instructors/${encodeURIComponent(instructor.id)}`)
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
                  No staff to display.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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

