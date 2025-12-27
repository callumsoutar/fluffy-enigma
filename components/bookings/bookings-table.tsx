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
  IconPlane,
  IconCalendar,
  IconClock,
  IconUser,
  IconSchool,
  IconCircleCheck,
  IconAlertCircle
} from "@tabler/icons-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

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
import type { BookingWithRelations, BookingStatus, BookingType } from "@/lib/types/bookings"

interface BookingsTableProps {
  bookings: BookingWithRelations[]
  onFiltersChange?: (filters: {
    search?: string
    status?: BookingStatus[]
    booking_type?: BookingType[]
  }) => void
}

function getStatusBadgeVariant(status: BookingStatus) {
  switch (status) {
    case "confirmed":
      return "default"
    case "flying":
      return "default"
    case "briefing":
      return "secondary"
    case "unconfirmed":
      return "secondary"
    case "complete":
      return "outline"
    case "cancelled":
      return "destructive"
    default:
      return "outline"
  }
}

function getStatusLabel(status: BookingStatus) {
  switch (status) {
    case "confirmed":
      return "Confirmed"
    case "flying":
      return "Flying"
    case "briefing":
      return "Briefing"
    case "unconfirmed":
      return "Unconfirmed"
    case "complete":
      return "Complete"
    case "cancelled":
      return "Cancelled"
    default:
      return status
  }
}

function getBookingTypeLabel(type: BookingType) {
  switch (type) {
    case "flight":
      return "Flight"
    case "groundwork":
      return "Ground Work"
    case "maintenance":
      return "Maintenance"
    case "other":
      return "Other"
    default:
      return type
  }
}

const columns: ColumnDef<BookingWithRelations>[] = [
  {
    accessorKey: "aircraft",
    header: () => (
      <div className="flex items-center gap-2">
        <IconPlane className="h-4 w-4 text-muted-foreground" />
        <span>Aircraft</span>
      </div>
    ),
    cell: ({ row }) => {
      const aircraft = row.original.aircraft
      if (!aircraft) return <span className="text-muted-foreground">—</span>
      return (
        <div className="font-medium">
          <div className="flex items-center gap-1.5">
            {aircraft.manufacturer && `${aircraft.manufacturer} `}
            {aircraft.type} {aircraft.model && `- ${aircraft.model}`}
          </div>
          <div className="text-xs text-muted-foreground mt-1 font-mono">
            {aircraft.registration}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "start_time",
    header: () => (
      <div className="flex items-center gap-2">
        <IconCalendar className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline">Date</span>
      </div>
    ),
    cell: ({ row }) => {
      const date = new Date(row.original.start_time)
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
    accessorKey: "time",
    header: () => (
      <div className="flex items-center gap-2">
        <IconClock className="h-4 w-4 text-muted-foreground" />
        <span>Time</span>
      </div>
    ),
    cell: ({ row }) => {
      const start = new Date(row.original.start_time)
      const end = new Date(row.original.end_time)
      return (
        <div className="font-medium">
          {start.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
          <span className="text-muted-foreground mx-1">-</span>
          {end.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </div>
      )
    },
  },
  {
    accessorKey: "booking_type",
    header: () => <span className="hidden lg:inline">Type</span>,
    cell: ({ row }) => (
      <Badge variant="outline" className="font-medium hidden lg:inline-flex">
        {getBookingTypeLabel(row.original.booking_type)}
      </Badge>
    ),
  },
  {
    accessorKey: "student",
    header: () => (
      <div className="flex items-center gap-2">
        <IconUser className="h-4 w-4 text-muted-foreground" />
        <span className="hidden md:inline">Student</span>
      </div>
    ),
    cell: ({ row }) => {
      const student = row.original.student
      if (!student) return <span className="text-muted-foreground">—</span>
      const name = [student.first_name, student.last_name]
        .filter(Boolean)
        .join(" ")
      return (
        <div className="font-medium">
          {name || student.email}
        </div>
      )
    },
  },
  {
    accessorKey: "instructor",
    header: () => (
      <div className="flex items-center gap-2">
        <IconSchool className="h-4 w-4 text-muted-foreground" />
        <span className="hidden md:inline">Instructor</span>
      </div>
    ),
    cell: ({ row }) => {
      const instructor = row.original.instructor
      if (!instructor) return <span className="text-muted-foreground">—</span>
      const name = [instructor.first_name, instructor.last_name]
        .filter(Boolean)
        .join(" ")
      return (
        <div className="font-medium">
          {name || instructor.user?.email || "—"}
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
      const isFlying = status === "flying"
      const isUnconfirmed = status === "unconfirmed"
      const isConfirmed = status === "confirmed"
      const isComplete = status === "complete"
      
      return (
        <Badge 
          variant={variant} 
          className={`font-medium ${
            isFlying ? "bg-orange-500 text-white border-orange-600 shadow-sm" :
            isUnconfirmed ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" :
            isConfirmed ? "bg-blue-600 text-white border-blue-700 shadow-sm" :
            isComplete ? "bg-green-600 text-white border-green-700 shadow-sm" :
            ""
          }`}
        >
          {isFlying && <IconPlane className="h-3 w-3 mr-1" />}
          {isUnconfirmed && <IconAlertCircle className="h-3 w-3 mr-1" />}
          {isConfirmed && <IconCircleCheck className="h-3 w-3 mr-1" />}
          {label}
        </Badge>
      )
    },
  },
]

// Mobile Booking Card Component (matching screenshot design)
function BookingCard({ booking }: { booking: BookingWithRelations }) {
  const router = useRouter()
  const start = new Date(booking.start_time)
  const end = new Date(booking.end_time)
  const status = booking.status
  const variant = getStatusBadgeVariant(status)
  const label = getStatusLabel(status)
  const isFlying = status === "flying"
  const isUnconfirmed = status === "unconfirmed"
  const isConfirmed = status === "confirmed"
  const isComplete = status === "complete"

  // Format names
  const studentName = booking.student 
    ? `${booking.student.first_name} ${booking.student.last_name}`.trim() 
    : null
  const instructorName = booking.instructor
    ? `${booking.instructor.first_name} ${booking.instructor.last_name}`.trim()
    : null

  return (
    <div 
      className="group relative transition-all cursor-pointer bg-background border-b last:border-b-0 hover:bg-accent/5"
      onClick={() => router.push(`/bookings/${booking.id}`)}
    >
      <div className="px-4 py-3">
        <div className="flex items-start gap-4">
          {/* Left: Time */}
          <div className="flex flex-col text-sm font-semibold text-foreground min-w-[50px]">
            <span>
              {start.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: false
              })}
            </span>
            <span className="text-muted-foreground">
              {end.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: false
              })}
            </span>
          </div>

          {/* Middle: Details */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Aircraft info */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-base truncate">
                  {booking.aircraft?.registration || getBookingTypeLabel(booking.booking_type)}
                </span>
                <span className="text-sm text-muted-foreground truncate">
                  {booking.aircraft ? (
                    `${booking.aircraft.manufacturer} ${booking.aircraft.type}`
                  ) : (
                    "No Aircraft"
                  )}
                </span>
              </div>
              
              {/* Status badge */}
              <Badge 
                variant={variant} 
                className={cn(
                  "shrink-0 font-medium px-3 py-0.5 rounded-full text-xs border",
                  isFlying && "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-300/50",
                  isUnconfirmed && "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300/50",
                  isConfirmed && "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-300/50",
                  isComplete && "bg-green-500/10 text-green-700 dark:text-green-400 border-green-300/50",
                  !isFlying && !isUnconfirmed && !isConfirmed && !isComplete && "border-muted"
                )}
              >
                {label}
              </Badge>
            </div>

            {/* People info with icons */}
            {(studentName || instructorName) && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <IconUser className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {[studentName, instructorName].filter(Boolean).join(", ")}
                </span>
              </div>
            )}

            {/* Training/Type indicator */}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <IconSchool className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {getBookingTypeLabel(booking.booking_type)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Date header component
function DateHeader({ date }: { date: string }) {
  const dateObj = new Date(date)
  return (
    <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm px-4 py-2.5 text-sm font-medium text-muted-foreground border-b">
      {dateObj.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      })}
    </div>
  )
}

// Group bookings by date
function groupBookingsByDate(bookings: BookingWithRelations[]) {
  const groups = new Map<string, BookingWithRelations[]>()
  
  bookings.forEach((booking) => {
    const date = new Date(booking.start_time)
    // Get date string in YYYY-MM-DD format for grouping
    const dateKey = date.toISOString().split('T')[0]
    
    if (!groups.has(dateKey)) {
      groups.set(dateKey, [])
    }
    groups.get(dateKey)!.push(booking)
  })
  
  // Sort groups by date (ascending - soonest first)
  return Array.from(groups.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, bookings]) => ({
      date,
      bookings: bookings.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )
    }))
}

export function BookingsTable({ bookings, onFiltersChange }: BookingsTableProps) {
  const isMobile = useIsMobile()
  const [mounted, setMounted] = React.useState(false)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [typeFilter, setTypeFilter] = React.useState<string>("all")

  // Prevent hydration mismatch by only rendering mobile/desktop view after mount
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Debounce search input to avoid too many API calls
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(globalFilter)
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [globalFilter])

  // Apply status and type filters client-side (for quick filtering on already-loaded data)
  // Note: Search filter is handled server-side via onFiltersChange callback
  const filteredBookings = React.useMemo(() => {
    let filtered = bookings

    if (statusFilter !== "all") {
      filtered = filtered.filter((b) => b.status === statusFilter)
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((b) => b.booking_type === typeFilter)
    }

    return filtered
  }, [bookings, statusFilter, typeFilter])

  const table = useReactTable({
    data: filteredBookings,
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

  // Notify parent of filter changes (using debounced search)
  React.useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange({
        search: debouncedSearch || undefined,
        status: statusFilter !== "all" ? [statusFilter as BookingStatus] : undefined,
        booking_type: typeFilter !== "all" ? [typeFilter as BookingType] : undefined,
      })
    }
  }, [debouncedSearch, statusFilter, typeFilter, onFiltersChange])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search aircraft, student, instructor..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 h-10 bg-background"
            />
            {globalFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0 hover:bg-muted"
                onClick={() => setGlobalFilter("")}
              >
                <IconX className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-10 bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unconfirmed">Unconfirmed</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="briefing">Briefing</SelectItem>
              <SelectItem value="flying">Flying</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] h-10 bg-background">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="flight">Flight</SelectItem>
              <SelectItem value="groundwork">Ground Work</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mobile Card View - Only render after mount to prevent hydration mismatch */}
      {mounted && isMobile ? (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {filteredBookings.length > 0 ? (
            (() => {
              // Get paginated bookings
              const paginatedBookings = filteredBookings.slice(
                table.getState().pagination.pageIndex * table.getState().pagination.pageSize,
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize
              )
              
              // Group by date
              const groupedBookings = groupBookingsByDate(paginatedBookings)
              
              return (
                <div>
                  {groupedBookings.map(({ date, bookings }) => (
                    <div key={date}>
                      <DateHeader date={date} />
                      <div>
                        {bookings.map((booking) => (
                          <BookingCard key={booking.id} booking={booking} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()
          ) : (
            <div className="p-12">
              <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <IconPlane className="h-10 w-10 opacity-50" />
                <p className="text-sm font-medium">No bookings found</p>
                <p className="text-xs text-center">Try adjusting your filters</p>
              </div>
            </div>
          )}
        </div>
      ) : mounted ? (
        /* Desktop Table View - Only render after mount */
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-1 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-1 sm:px-0">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow 
                      key={headerGroup.id}
                      className="bg-muted/50 hover:bg-muted/50 border-b"
                    >
                      {headerGroup.headers.map((header) => (
                        <TableHead 
                          key={header.id}
                          className="font-semibold text-foreground h-12 px-4 whitespace-nowrap"
                        >
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
                      className="hover:bg-muted/50 transition-colors border-b last:border-0 cursor-pointer group"
                      onClick={(e) => {
                        // Don't navigate if clicking on interactive elements
                        const target = e.target as HTMLElement
                        if (!target.closest('button, a, [role="button"], input, select')) {
                          window.location.href = `/bookings/${row.original.id}`
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell 
                          key={cell.id}
                          className="py-4 px-4"
                        >
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
                        className="h-32 text-center"
                      >
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <IconPlane className="h-8 w-8 opacity-50" />
                          <p className="text-sm font-medium">No bookings found</p>
                          <p className="text-xs">Try adjusting your filters</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      ) : (
        /* Loading state during SSR/hydration */
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="p-8 text-center text-muted-foreground">
            Loading...
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
          </span> to{" "}
          <span className="font-medium text-foreground">
            {Math.min(
              (table.getState().pagination.pageIndex + 1) *
                table.getState().pagination.pageSize,
              filteredBookings.length
            )}
          </span>{" "}
          of <span className="font-medium text-foreground">{filteredBookings.length}</span> bookings
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-9"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-9"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
