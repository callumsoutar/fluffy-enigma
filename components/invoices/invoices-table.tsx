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
  IconPlus,
  IconChevronRight,
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { InvoiceWithRelations, InvoiceStatus } from "@/lib/types/invoices"

interface InvoicesTableProps {
  invoices: InvoiceWithRelations[]
  activeTab: string
  onTabChange: (tab: string) => void
  tabCounts: {
    all: number
    draft: number
    pending: number
    paid: number
    overdue: number
  }
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

export function InvoicesTable({ 
  invoices, 
  activeTab, 
  onTabChange, 
  tabCounts, 
  onFiltersChange 
}: InvoicesTableProps) {
  const [mounted, setMounted] = React.useState(false)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
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

  const table = useReactTable({
    data: invoices,
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
      })
    }
  }, [debouncedSearch, onFiltersChange])

  if (!mounted) {
    return <div className="p-4">Loading...</div>
  }

  const tabs = [
    { id: "all", label: "All" },
    { id: "draft", label: "Draft" },
    { id: "pending", label: "Pending" },
    { id: "paid", label: "Paid" },
    { id: "overdue", label: "Overdue" },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Invoices</h1>
          <p className="text-slate-600 mt-1">View and manage all invoices</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative w-full sm:w-auto">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search invoices..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 w-full sm:w-64 h-10 border-slate-200 bg-white focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:border-slate-300"
            />
            {globalFilter && (
              <button
                onClick={() => setGlobalFilter("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <IconX className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            className="bg-slate-900 text-white font-semibold h-10 px-5 hover:bg-slate-800 w-full sm:w-auto"
            onClick={() => router.push('/invoices/new')}
          >
            <IconPlus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Custom Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const count = tabCounts[tab.id as keyof typeof tabCounts]
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-semibold transition-all border-b-2 flex items-center gap-2",
                isActive 
                  ? "border-slate-900 text-slate-900" 
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              {tab.label}
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                isActive ? "bg-slate-100 text-slate-900" : "bg-slate-50 text-slate-400"
              )}>
                {count}
              </span>
            </button>
          )
        })}
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
                        "px-4 py-3 font-semibold text-xs uppercase tracking-wide text-slate-600 text-left",
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
                  onClick={() => router.push(`/invoices/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td 
                      key={cell.id} 
                      className={cn(
                        "px-4 py-3.5 align-middle",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  <td className="px-4 py-3.5 align-middle text-right pr-6">
                    <IconChevronRight className="w-4 h-4 text-slate-300 inline" />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + 1} className="h-24 text-center text-slate-500 font-medium">
                  No invoices found.
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
            const invoice = row.original
            const user = invoice.user
            const name = user ? ([user.first_name, user.last_name].filter(Boolean).join(" ") || user.email) : "Unknown"
            const date = new Date(invoice.issue_date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric"
            })
            
            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50 transition-colors"
                onClick={() => router.push(`/invoices/${invoice.id}`)}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-900 rounded-l-lg" />
                
                <div className="flex justify-between items-start mb-3 pl-2">
                  <div className="flex flex-col">
                    <h3 className="font-semibold text-slate-900">{invoice.invoice_number || `#${invoice.id.slice(0, 8)}`}</h3>
                    <span className="text-xs text-slate-600">{name}</span>
                  </div>
                  <Badge variant={getStatusBadgeVariant(invoice.status)} className="font-medium">
                    {getStatusLabel(invoice.status)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</div>
                    <div className="font-semibold text-sm text-slate-700">{date}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">Total</div>
                    <div className="font-bold text-sm text-slate-900 text-right">
                      ${(invoice.total_amount || 0).toFixed(2)}
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
            No invoices found.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to <span className="font-semibold text-slate-900">{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, invoices.length)}</span> of <span className="font-semibold text-slate-900">{invoices.length}</span> invoices
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
