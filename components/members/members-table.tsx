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
import { IconUserPlus, IconSearch, IconChevronRight, IconShield, IconCircleCheck, IconCircleX } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { MemberWithRelations, PersonType } from "@/lib/types/members"
import { AddMemberModal } from "@/components/members/AddMemberModal"

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

function getStatusBadge(isActive: boolean): { label: string; className: string } {
  if (isActive) {
    return { label: "Active", className: "bg-emerald-50 text-emerald-600 border-emerald-100" }
  }
  return { label: "Inactive", className: "bg-red-50 text-red-600 border-red-100" }
}

export function MembersTable({ 
  members, 
  activeTab, 
  onTabChange
}: MembersTableProps) {
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [addOpen, setAddOpen] = React.useState(false)
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

  const columns = React.useMemo<ColumnDef<MemberWithRelations>[]>(() => [
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
            <Avatar className="h-9 w-9 rounded-full border border-slate-100">
              <AvatarFallback className="bg-slate-100 text-slate-500 text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900">{name}</span>
              <span className="text-[11px] text-slate-500 font-medium">{member.email}</span>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const member = row.original
        const roleLabel = getPersonTypeLabel(member)
        
        return (
          <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-none border border-slate-200 text-slate-600 uppercase tracking-wider">
            {roleLabel}
          </Badge>
        )
      },
    },
    {
      accessorKey: "status",
      header: () => <div className="text-center">Status</div>,
      cell: ({ row }) => {
        const isActive = row.original.is_active
        const { label, className } = getStatusBadge(isActive)
        
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
    <div className="flex flex-col gap-6">
      <AddMemberModal
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Members</h2>
          <p className="text-slate-500 mt-1">Manage your organization&apos;s members and their roles.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative w-full sm:w-auto">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full sm:w-64 h-11 rounded-xl border-slate-200 bg-white shadow-sm focus:ring-slate-100"
            />
          </div>
          {canAddMember && (
            <Button
              className="bg-slate-900 text-white font-bold rounded-xl h-11 px-6 shadow-lg shadow-slate-900/10 hover:bg-slate-800 w-full sm:w-auto"
              onClick={() => setAddOpen(true)}
            >
              <IconUserPlus className="h-4 w-4 mr-2" />
              New Member
            </Button>
          )}
        </div>
      </div>

      {/* Custom Tabs */}
      <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl w-fit">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                isActive 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
              )}
            >
              {tab.label}
            </button>
          )
        })}
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
                  onClick={() => router.push(`/members/${row.original.id}`)}
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
                  No members found.
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
            const member = row.original
            const firstName = member.first_name || ""
            const lastName = member.last_name || ""
            const name = [firstName, lastName].filter(Boolean).join(" ") || member.email
            const initials = getUserInitials(firstName, lastName, member.email)
            const { label: statusLabel, className: statusClass } = getStatusBadge(member.is_active)
            const roleLabel = getPersonTypeLabel(member)
            
            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-[20px] border border-slate-100 bg-white p-4 shadow-sm active:bg-slate-50 transition-colors"
                onClick={() => router.push(`/members/${member.id}`)}
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
                      <span className="text-[11px] text-slate-500 font-medium">{member.email}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-none border uppercase tracking-wider", statusClass)}>
                    {statusLabel}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <IconShield className="w-3 h-3" /> Role
                    </div>
                    <div className="font-bold text-sm text-slate-700 uppercase tracking-tight">
                      {roleLabel}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      {member.is_active ? <IconCircleCheck className="w-3 h-3 text-emerald-500" /> : <IconCircleX className="w-3 h-3 text-red-500" />} Status
                    </div>
                    <div className={cn("font-bold text-sm", member.is_active ? "text-emerald-600" : "text-red-600")}>
                      {member.is_active ? "Active" : "Inactive"}
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
            No members found.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="text-slate-900">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to <span className="text-slate-900">{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredMembers.length)}</span> of <span className="text-slate-900">{filteredMembers.length}</span> members
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
