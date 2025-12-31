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
import { IconSearch, IconPlus, IconPackage, IconClock, IconEdit, IconAlertCircle, IconSelector, IconSortAscending, IconSortDescending, IconFilter, IconX, IconUserCheck } from "@tabler/icons-react"
import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EQUIPMENT_TYPE_OPTIONS, type EquipmentWithIssuance, type EquipmentType } from "@/lib/types/equipment"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { MoreVertical } from "lucide-react"

interface EquipmentTableProps {
  equipment: EquipmentWithIssuance[]
  onIssue?: (equipment: EquipmentWithIssuance) => void
  onReturn?: (equipment: EquipmentWithIssuance) => void
  onLogUpdate?: (equipment: EquipmentWithIssuance) => void
  onAdd?: () => void
}

function getStatusBadge(status: string | null, isIssued: boolean): { label: string; className: string } {
  // If issued, show "Issued" status regardless of equipment status
  if (isIssued) {
    return { label: "Issued", className: "bg-blue-50 text-blue-700 border-blue-200" }
  }

  if (!status) {
    return { label: "Unknown", className: "bg-slate-50 text-slate-700 border-slate-200" }
  }
  
  const statusLower = status.toLowerCase()
  if (statusLower === "active") {
    return { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
  }
  if (statusLower === "maintenance") {
    return { label: "Maintenance", className: "bg-amber-50 text-amber-700 border-amber-200" }
  }
  if (statusLower === "lost") {
    return { label: "Lost", className: "bg-red-50 text-red-700 border-red-200" }
  }
  if (statusLower === "retired") {
    return { label: "Retired", className: "bg-slate-50 text-slate-700 border-slate-200" }
  }
  
  return { label: status.charAt(0).toUpperCase() + status.slice(1), className: "bg-slate-50 text-slate-700 border-slate-200" }
}

function formatIssuedTo(equipment: EquipmentWithIssuance): string {
  if (!equipment.current_issuance || !equipment.issued_to_user) {
    return "—"
  }

  const user = equipment.issued_to_user
  if (user.first_name || user.last_name) {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim()
  }

  return user.email
}

function formatOverdueableDate(date: Date | string | null): React.ReactNode {
  if (!date) return <span className="text-slate-500">—</span>;
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = d < today;
  
  const diffTime = Math.abs(today.getTime() - d.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        {isOverdue && <IconAlertCircle className="h-3.5 w-3.5 text-red-600" />}
        <span className={cn(
          "text-sm font-medium",
          isOverdue ? "text-red-600" : "text-slate-700"
        )}>
          {d.toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
          })}
        </span>
      </div>
      {isOverdue && (
        <span className="text-[10px] text-red-500 uppercase tracking-tight font-medium">
          Due {diffDays} {diffDays === 1 ? 'day' : 'days'} ago
        </span>
      )}
    </div>
  );
}

function formatExpectedReturn(equipment: EquipmentWithIssuance): React.ReactNode {
  return formatOverdueableDate(equipment.current_issuance?.expected_return || null);
}

function formatNextDue(equipment: EquipmentWithIssuance): React.ReactNode {
  const issuanceDueDate = equipment.most_recent_issuance?.expected_return 
    ? new Date(equipment.most_recent_issuance.expected_return) 
    : null;
  const updateDueDate = equipment.latest_update?.next_due_at 
    ? new Date(equipment.latest_update.next_due_at) 
    : null;

  // Use the earliest date as the "Next Due" date, or whichever exists
  let nextDueDate: Date | null = null;
  if (issuanceDueDate && updateDueDate) {
    nextDueDate = issuanceDueDate < updateDueDate ? issuanceDueDate : updateDueDate;
  } else {
    nextDueDate = issuanceDueDate || updateDueDate;
  }

  return formatOverdueableDate(nextDueDate);
}

export function EquipmentTable({ 
  equipment, 
  onIssue, 
  onReturn, 
  onLogUpdate, 
  onAdd 
}: EquipmentTableProps) {
  const router = useRouter()
  const [search, setSearch] = React.useState("")
  const [selectedType, setSelectedType] = React.useState<EquipmentType | "all">("all")
  const [showIssuedOnly, setShowIssuedOnly] = React.useState(false)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const { role } = useAuth()

  // Filter by search and type
  const filteredEquipment = React.useMemo(() => {
    return equipment.filter((item) => {
      // Filter by search
      const searchLower = search.toLowerCase()
      const matchesSearch = !search || (
        (item.name?.toLowerCase() || "").includes(searchLower) ||
        (item.serial_number?.toLowerCase() || "").includes(searchLower) ||
        (item.type?.toLowerCase() || "").includes(searchLower)
      )

      // Filter by type
      const matchesType = selectedType === "all" || item.type === selectedType

      // Filter by issuance status
      const matchesIssuance = !showIssuedOnly || !!item.current_issuance

      return matchesSearch && matchesType && matchesIssuance
    })
  }, [equipment, search, selectedType, showIssuedOnly])

  const columns = React.useMemo<ColumnDef<EquipmentWithIssuance>[]>(() => [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => {
        const equipment = row.original
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 border border-slate-200">
              <IconPackage className="h-4 w-4 text-slate-600" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-slate-900">{equipment.name}</span>
              {equipment.serial_number && (
                <span className="text-xs text-slate-600">{equipment.serial_number}</span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "label",
      header: "Label",
      cell: ({ row }) => {
        const label = row.original.label
        return <span className="text-slate-700">{label || "—"}</span>
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.original.type
        return <span className="text-slate-700 capitalize">{type || "—"}</span>
      },
    },
    {
      accessorKey: "status",
      header: () => <div className="text-center">Status</div>,
      cell: ({ row }) => {
        const equipment = row.original
        const isIssued = !!equipment.current_issuance
        const { label, className } = getStatusBadge(equipment.status, isIssued)
        
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
      accessorKey: "issued_to",
      header: "Issued To",
      cell: ({ row }) => {
        const equipment = row.original
        return <span className="text-slate-700">{formatIssuedTo(equipment)}</span>
      },
    },
    {
      accessorKey: "expected_return",
      header: "Expected Return",
      cell: ({ row }) => {
        const equipment = row.original
        return <div>{formatExpectedReturn(equipment)}</div>
      },
    },
    {
      id: "next_due",
      header: "Next Update Due",
      cell: ({ row }) => {
        const equipment = row.original
        return <div>{formatNextDue(equipment)}</div>
      },
      sortingFn: (rowA, rowB) => {
        const getNextDue = (item: EquipmentWithIssuance) => {
          const d1 = item.most_recent_issuance?.expected_return ? new Date(item.most_recent_issuance.expected_return).getTime() : Infinity;
          const d2 = item.latest_update?.next_due_at ? new Date(item.latest_update.next_due_at).getTime() : Infinity;
          return Math.min(d1, d2);
        };
        const dateA = getNextDue(rowA.original);
        const dateB = getNextDue(rowB.original);
        if (dateA === Infinity && dateB === Infinity) return 0;
        return dateA - dateB;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const equipment = row.original
        const isIssued = !!equipment.current_issuance

        return (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" className="hover:bg-slate-100">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isIssued ? (
                  <DropdownMenuItem onClick={() => onReturn?.(equipment)}>
                    <IconAlertCircle className="w-4 h-4 mr-2" /> Return
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onIssue?.(equipment)}>
                    <IconClock className="w-4 h-4 mr-2" /> Issue
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onLogUpdate?.(equipment)}>
                  <IconPackage className="w-4 h-4 mr-2" /> Log Update
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push(`/equipment/${equipment.id}`)}>
                  <IconEdit className="w-4 h-4 mr-2" /> View Details
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ], [onIssue, onReturn, onLogUpdate, router])

  const table = useReactTable<EquipmentWithIssuance>({
    data: filteredEquipment,
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

  const canAddEquipment = role && !['member', 'student'].includes(role.toLowerCase())
  
  // Count issued equipment
  const issuedCount = React.useMemo(() => {
    return equipment.filter(item => !!item.current_issuance).length
  }, [equipment])

  return (
    <div className="flex flex-col gap-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Equipment</h2>
            <p className="text-slate-600 mt-1 text-sm">Manage inventory, maintenance, and issuance tracking.</p>
          </div>
          
          {canAddEquipment && (
            <Button
              className="bg-slate-900 text-white font-semibold h-10 px-5 hover:bg-slate-800"
              onClick={onAdd}
            >
              <IconPlus className="h-4 w-4 mr-2" />
              Add Equipment
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-2 border border-slate-200 rounded-lg shadow-sm">
          <div className="relative flex-1 w-full">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, serial, or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 w-full h-10 border-slate-200 bg-white focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:border-slate-300"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            
            <Select
              value={selectedType}
              onValueChange={(value) => setSelectedType(value as EquipmentType | "all")}
            >
              <SelectTrigger className="w-full sm:w-[180px] h-10 border-slate-200">
                <div className="flex items-center gap-2">
                  <IconFilter className="h-4 w-4 text-slate-400" />
                  <SelectValue placeholder="All Types" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={showIssuedOnly ? "default" : "outline"}
              onClick={() => setShowIssuedOnly(!showIssuedOnly)}
              className={cn(
                "h-10 gap-2 whitespace-nowrap",
                showIssuedOnly 
                  ? "bg-blue-600 text-white hover:bg-blue-700 border-blue-600" 
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
            >
              <IconUserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Issued Only</span>
              <Badge 
                variant="secondary" 
                className={cn(
                  "ml-1 h-5 min-w-5 px-1.5 text-xs font-semibold",
                  showIssuedOnly 
                    ? "bg-blue-500 text-white border-blue-400" 
                    : "bg-slate-100 text-slate-700 border-slate-200"
                )}
              >
                {issuedCount}
              </Badge>
            </Button>

            {(search || selectedType !== "all" || showIssuedOnly) && (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => {
                  setSearch("")
                  setSelectedType("all")
                  setShowIssuedOnly(false)
                }}
                className="h-10 w-10 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              >
                <IconX className="h-4 w-4" />
              </Button>
            )}
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
                        header.column.getCanSort() && "cursor-pointer select-none hover:text-slate-900",
                        header.id === "status" ? "text-center" : "text-left"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className={cn(
                        "flex items-center gap-1",
                        header.id === "status" && "justify-center"
                      )}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <div className="w-3">
                            {{
                              asc: <IconSortAscending className="h-3 w-3" />,
                              desc: <IconSortDescending className="h-3 w-3" />,
                            }[header.column.getIsSorted() as string] ?? (
                              <IconSelector className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </div>
                        )}
                      </div>
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
                  onClick={() => router.push(`/equipment/${row.original.id}`)}
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
                  No equipment found.
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
            const equipment = row.original
            const isIssued = !!equipment.current_issuance
            const { label, className } = getStatusBadge(equipment.status, isIssued)
            
            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm cursor-pointer hover:border-slate-300 hover:shadow-md transition-all"
                onClick={() => router.push(`/equipment/${equipment.id}`)}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-900 rounded-l-lg" />
                
                <div className="flex justify-between items-start mb-3 pl-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 border border-slate-200">
                      <IconPackage className="h-5 w-5 text-slate-600" />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="font-semibold text-slate-900">{equipment.name}</h3>
                      <span className="text-xs text-slate-600">{equipment.serial_number || equipment.type}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("text-xs font-medium px-2 py-0.5", className)}>
                    {label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Label</div>
                    <div className="font-semibold text-sm text-slate-700">
                      {equipment.label || "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issued To</div>
                    <div className="font-semibold text-sm text-slate-900">
                      {formatIssuedTo(equipment)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 pl-2 border-t border-slate-50 pt-3">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expected Return</div>
                    <div className="text-sm font-medium">
                      {formatExpectedReturn(equipment)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next Update Due</div>
                    <div className="text-sm font-medium">
                      {formatNextDue(equipment)}
                    </div>
                  </div>
                </div>

                <div className="absolute right-4 bottom-4" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="outline" className="h-8 w-8 hover:bg-slate-100">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isIssued ? (
                        <DropdownMenuItem onClick={() => onReturn?.(equipment)}>
                          <IconAlertCircle className="w-4 h-4 mr-2" /> Return
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => onIssue?.(equipment)}>
                          <IconClock className="w-4 h-4 mr-2" /> Issue
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onLogUpdate?.(equipment)}>
                        <IconPackage className="w-4 h-4 mr-2" /> Log Update
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push(`/equipment/${equipment.id}`)}>
                        <IconEdit className="w-4 h-4 mr-2" /> View Details
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-200 text-slate-500 font-medium">
            No equipment found.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to <span className="font-semibold text-slate-900">{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredEquipment.length)}</span> of <span className="font-semibold text-slate-900">{filteredEquipment.length}</span> items
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

