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
import type { MemberWithRelations, PersonType } from "@/lib/types/members"

interface MembersTableProps {
  members: MemberWithRelations[]
  activeTab: PersonType
  onTabChange: (tab: PersonType) => void
  tabCounts: {
    all: number
    member: number
    instructor: number
    staff: number
    contact: number
  }
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

function getPersonTypeLabel(member: MemberWithRelations): string {
  const hasActiveMembership = member.membership?.is_active
  const hasInstructorRecord = !!member.instructor
  const roleName = member.role?.role

  if (roleName === 'owner' || roleName === 'admin') {
    return 'Staff'
  }
  if (hasInstructorRecord) {
    return 'Instructor'
  }
  if (hasActiveMembership) {
    return 'Member'
  }
  return 'Contact'
}

function getTabTitle(activeTab: PersonType): string {
  switch (activeTab) {
    case "member":
      return "Member Directory"
    case "instructor":
      return "Instructor Directory"
    case "staff":
      return "Staff Directory"
    case "all":
      return "Contact Directory"
    default:
      return "Contact Directory"
  }
}

const columns: ColumnDef<MemberWithRelations>[] = [
  {
    accessorKey: "member",
    header: "Member",
    cell: ({ row }) => {
      const member = row.original
      const firstName = member.first_name || ""
      const lastName = member.last_name || ""
      const name = [firstName, lastName].filter(Boolean).join(" ") || member.email
      const initials = getUserInitials(firstName, lastName, member.email)
      
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
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => {
      return <span className="text-muted-foreground">{row.original.email}</span>
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const member = row.original
      const roleLabel = getPersonTypeLabel(member)
      
      return (
        <Badge variant="outline" className="font-normal">
          {roleLabel}
        </Badge>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const member = row.original
      const isActive = member.is_active
      
      if (!isActive) {
        return (
          <Badge variant="destructive" className="bg-black text-white font-normal">
            Inactive
          </Badge>
        )
      }

      return (
        <Badge variant="default" className="bg-black text-white font-normal">
          Active
        </Badge>
      )
    },
  },
]

export function MembersTable({ 
  members, 
  activeTab, 
  onTabChange
}: MembersTableProps) {
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const router = useRouter()
  const { role } = useAuth()

  // Filter by search
  const filteredMembers = React.useMemo(() => {
    if (!search) return members

    const searchLower = search.toLowerCase()
    return members.filter((member) => {
      const firstName = member.first_name?.toLowerCase() || ""
      const lastName = member.last_name?.toLowerCase() || ""
      const email = member.email?.toLowerCase() || ""
      const fullName = `${firstName} ${lastName}`.toLowerCase()

      return (
        firstName.includes(searchLower) ||
        lastName.includes(searchLower) ||
        email.includes(searchLower) ||
        fullName.includes(searchLower)
      )
    })
  }, [members, search])

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<MemberWithRelations>({
    data: filteredMembers,
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

  const canAddMember = role && !['member', 'student'].includes(role.toLowerCase())

  const tabs = [
    { id: "member" as PersonType, label: "Members" },
    { id: "instructor" as PersonType, label: "Instructors" },
    { id: "staff" as PersonType, label: "Staff" },
    { id: "all" as PersonType, label: "All Contacts" },
  ]

  return (
    <div className="bg-white rounded-lg shadow p-6 flex flex-col gap-6">
      {/* Header with title, search, and New Member button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
        <h2 className="text-xl font-bold">{getTabTitle(activeTab)}</h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:items-center justify-end">
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-56"
          />
          {canAddMember && (
            <Button
              className="bg-[#6564db] hover:bg-[#232ed1] text-white font-semibold px-4 py-2 rounded-md shadow text-base flex items-center gap-2"
              onClick={() => {
                // TODO: Open Add Member modal
                console.log('Add member clicked')
              }}
            >
              <IconUserPlus className="h-4 w-4" />
              New Member
            </Button>
          )}
        </div>
      </div>

      {/* Custom Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                  isActive
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
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
                        router.push(`/members/${id}`)
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
