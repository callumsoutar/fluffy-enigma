"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table"
import { 
  IconSearch, 
  IconX, 
  IconCalendar,
  IconUser,
  IconFileText,
  IconCurrencyDollar,
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { InvoiceWithRelations, InvoiceStatus } from "@/lib/types/invoices"

interface InvoicesTableProps {
  invoices: InvoiceWithRelations[]
  onFiltersChange?: (filters: {
    search?: string
    status?: InvoiceStatus[]
  }) => void
}

function getStatusBadgeVariant(status: InvoiceStatus) {
  switch (status) {
    case "paid":
      return "default"
    case "pending":
      return "secondary"
    case "overdue":
      return "destructive"
    case "draft":
      return "outline"
    case "cancelled":
    case "refunded":
      return "outline"
    default:
      return "outline"
  }
}

function getStatusLabel(status: InvoiceStatus) {
  switch (status) {
    case "draft":
      return "Draft"
    case "pending":
      return "Pending"
    case "paid":
      return "Paid"
    case "overdue":
      return "Overdue"
    case "cancelled":
      return "Cancelled"
    case "refunded":
      return "Refunded"
    default:
      return status
  }
}

const columns: ColumnDef<InvoiceWithRelations>[] = [
  {
    accessorKey: "invoice_number",
    header: () => (
      <div className="flex items-center gap-2">
        <IconFileText className="h-4 w-4 text-muted-foreground" />
        <span>Invoice #</span>
      </div>
    ),
    cell: ({ row }) => {
      const invoiceNumber = row.original.invoice_number
      return (
        <div className="font-medium font-mono">
          {invoiceNumber || `#${row.original.id.slice(0, 8)}`}
        </div>
      )
    },
  },
  {
    accessorKey: "user",
    header: () => (
      <div className="flex items-center gap-2">
        <IconUser className="h-4 w-4 text-muted-foreground" />
        <span className="hidden md:inline">Bill To</span>
      </div>
    ),
    cell: ({ row }) => {
      const user = row.original.user
      if (!user) return <span className="text-muted-foreground">—</span>
      const name = [user.first_name, user.last_name]
        .filter(Boolean)
        .join(" ")
      return (
        <div className="font-medium">
          {name || user.email}
        </div>
      )
    },
  },
  {
    accessorKey: "issue_date",
    header: () => (
      <div className="flex items-center gap-2">
        <IconCalendar className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline">Issue Date</span>
      </div>
    ),
    cell: ({ row }) => {
      const date = new Date(row.original.issue_date)
      return (
        <div>
          <div className="font-medium">
            {date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </div>
          <div className="text-xs text-muted-foreground hidden sm:block">
            {date.toLocaleDateString("en-US", { year: "numeric" })}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "due_date",
    header: () => (
      <div className="flex items-center gap-2">
        <IconCalendar className="h-4 w-4 text-muted-foreground" />
        <span className="hidden lg:inline">Due Date</span>
      </div>
    ),
    cell: ({ row }) => {
      const dueDate = row.original.due_date
      if (!dueDate) return <span className="text-muted-foreground">—</span>
      const date = new Date(dueDate)
      const isOverdue = row.original.status === 'overdue' || 
        (row.original.status === 'pending' && new Date(dueDate) < new Date())
      return (
        <div>
          <div className={`font-medium ${isOverdue ? 'text-destructive' : ''}`}>
            {date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </div>
          <div className="text-xs text-muted-foreground hidden lg:block">
            {date.toLocaleDateString("en-US", { year: "numeric" })}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status
      const variant = getStatusBadgeVariant(status)
      const label = getStatusLabel(status)
      return (
        <Badge variant={variant} className="font-medium">
          {label}
        </Badge>
      )
    },
  },
  {
    accessorKey: "total_amount",
    header: () => (
      <div className="flex items-center gap-2">
        <IconCurrencyDollar className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline">Total</span>
      </div>
    ),
    cell: ({ row }) => {
      const total = row.original.total_amount || 0
      return (
        <div className="font-medium text-right">
          ${total.toFixed(2)}
        </div>
      )
    },
  },
]

export function InvoicesTable({ invoices, onFiltersChange }: InvoicesTableProps) {
  const [mounted, setMounted] = React.useState(false)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const router = useRouter()

  // Prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(globalFilter)
    }, 300)

    return () => clearTimeout(timer)
  }, [globalFilter])

  // Apply status filter client-side
  const filteredInvoices = React.useMemo(() => {
    let filtered = invoices

    if (statusFilter !== "all") {
      filtered = filtered.filter((inv) => inv.status === statusFilter)
    }

    return filtered
  }, [invoices, statusFilter])

  const table = useReactTable({
    data: filteredInvoices,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  // Notify parent of filter changes
  React.useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange({
        search: debouncedSearch || undefined,
        status: statusFilter !== "all" ? [statusFilter as InvoiceStatus] : undefined,
      })
    }
  }, [debouncedSearch, statusFilter, onFiltersChange])

  if (!mounted) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
          {globalFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setGlobalFilter("")}
            >
              <IconX className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
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
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => router.push(`/invoices/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No invoices found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            filteredInvoices.length
          )}{" "}
          of {filteredInvoices.length} invoices
        </div>
        <div className="flex gap-2">
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
    </div>
  )
}
