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
import { format } from "date-fns"
import {
  IconAlertTriangle,
  IconChevronRight,
  IconSchool,
  IconSearch,
  IconClock,
  IconFlame,
  IconChecks,
  IconInfoCircle,
} from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { TrainingOverviewResponse, TrainingOverviewRow, TrainingOverviewView } from "@/lib/types/training-overview"

function getUserInitials(
  firstName: string | null,
  lastName: string | null,
  email: string
): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase()
  if (firstName) return firstName.substring(0, 2).toUpperCase()
  if (lastName) return lastName.substring(0, 2).toUpperCase()
  return email.substring(0, 2).toUpperCase()
}

function safeFormatDate(value: string | null | undefined) {
  if (!value) return "-"
  try {
    return format(new Date(value), "d MMM yyyy")
  } catch {
    return "-"
  }
}

function daysAgoLabel(days: number | null, fallback: string) {
  if (days === null) return fallback
  if (days === 0) return "today"
  if (days === 1) return "1 day ago"
  return `${days} days ago`
}

function matchesSearch(row: TrainingOverviewRow, search: string) {
  const s = search.toLowerCase()
  const fn = row.student.first_name?.toLowerCase() || ""
  const ln = row.student.last_name?.toLowerCase() || ""
  const email = row.student.email?.toLowerCase() || ""
  const full = `${fn} ${ln}`.trim()
  const syllabus = row.syllabus.name.toLowerCase()
  return fn.includes(s) || ln.includes(s) || email.includes(s) || full.includes(s) || syllabus.includes(s)
}

function viewIncludes(view: TrainingOverviewView, status: TrainingOverviewRow["activity_status"]) {
  if (view === "all") return true
  if (view === "active") return status === "active"
  if (view === "stale") return status === "stale"
  // at_risk view includes both at_risk and new (never flown, recently enrolled)
  return status === "at_risk" || status === "new"
}

function statusBadge(status: TrainingOverviewRow["activity_status"]) {
  if (status === "active") {
    return { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200/50" }
  }
  if (status === "stale") {
    return { label: "Stale", className: "bg-rose-50 text-rose-700 border-rose-200/50" }
  }
  if (status === "new") {
    return { label: "New", className: "bg-blue-50 text-blue-700 border-blue-200/50" }
  }
  return { label: "At risk", className: "bg-amber-50 text-amber-700 border-amber-200/50" }
}

function progressBar(percent: number | null) {
  const pct = percent ?? 0
  return (
    <div className="w-full">
      <div className="h-1.5 rounded-full bg-slate-100/80 overflow-hidden">
        <div
          className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  )
}

export function TrainingTable({ data }: { data: TrainingOverviewResponse }) {
  const router = useRouter()
  const [view, setView] = React.useState<TrainingOverviewView>("at_risk")
  const [syllabusId, setSyllabusId] = React.useState<string>("all")
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])

  const statsFromRows = React.useMemo(() => {
    const rows = data.rows
    const active = rows.filter((r) => r.activity_status === "active").length
    const stale = rows.filter((r) => r.activity_status === "stale").length
    const atRisk = rows.filter((r) => r.activity_status === "at_risk").length
    const newlyEnrolled = rows.filter((r) => r.activity_status === "new").length
    const neverFlown = rows.filter((r) => !r.last_flight_at).length
    return { active, stale, atRisk, newlyEnrolled, neverFlown, total: rows.length }
  }, [data.rows])

  const filteredRows = React.useMemo(() => {
    let rows = data.rows

    if (syllabusId !== "all") {
      rows = rows.filter((r) => r.syllabus_id === syllabusId)
    }

    if (search.trim()) {
      rows = rows.filter((r) => matchesSearch(r, search.trim()))
    }

    rows = rows.filter((r) => viewIncludes(view, r.activity_status))
    return rows
  }, [data.rows, search, syllabusId, view])

  const columns = React.useMemo<ColumnDef<TrainingOverviewRow>[]>(
    () => [
      {
        accessorKey: "student",
        header: "Student",
        cell: ({ row }) => {
          const r = row.original
          const first = r.student.first_name || ""
          const last = r.student.last_name || ""
          const name = [first, last].filter(Boolean).join(" ") || r.student.email
          const initials = getUserInitials(first || null, last || null, r.student.email)
          return (
            <div className="flex items-center gap-4">
              <Avatar className="h-10 w-10 rounded-full border border-slate-200/50 shadow-sm ring-2 ring-white">
                <AvatarFallback className="bg-slate-100 text-slate-500 text-[11px] font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0 gap-0.5">
                <span className="font-bold text-slate-900 truncate leading-none">{name}</span>
                <span className="text-[12px] text-slate-500 font-medium truncate leading-none">{r.student.email}</span>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "syllabus",
        header: "Syllabus",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className="text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-none border border-slate-200 bg-slate-50/50 text-slate-600 uppercase tracking-wider"
          >
            {row.original.syllabus.name}
          </Badge>
        ),
      },
      {
        accessorKey: "enrolled_at",
        header: "Enrolled",
        cell: ({ row }) => (
          <div className="text-[13px] text-slate-600 font-medium tracking-tight">
            {safeFormatDate(row.original.enrolled_at)}
          </div>
        ),
      },
      {
        accessorKey: "last_flight_at",
        header: "Last flew",
        cell: ({ row }) => {
          const r = row.original
          const label =
            r.last_flight_at === null
              ? "Never"
              : safeFormatDate(r.last_flight_at)
          const sub =
            r.last_flight_at === null
              ? daysAgoLabel(null, `${r.days_since_enrolled} days since enrolled`)
              : daysAgoLabel(r.days_since_last_flight, "")
          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-bold text-slate-900 tracking-tight">{label}</span>
              <span className="text-[11px] text-slate-400 font-medium">{sub}</span>
            </div>
          )
        },
      },
      {
        accessorKey: "progress",
        header: "Progress",
        cell: ({ row }) => {
          const p = row.original.progress
          return (
            <div className="min-w-[140px] flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-700">
                  {p.total > 0 ? `${p.completed} / ${p.total} lessons` : "—"}
                </span>
                {p.percent !== null ? (
                  <span className="text-[10px] font-bold text-slate-400">{p.percent}%</span>
                ) : null}
              </div>
              {progressBar(p.percent)}
            </div>
          )
        },
      },
      {
        accessorKey: "activity_status",
        header: () => <div className="text-center">Status</div>,
        cell: ({ row }) => {
          const { label, className } = statusBadge(row.original.activity_status)
          return (
            <div className="flex justify-center">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-none border uppercase tracking-wider",
                  className
                )}
              >
                {label}
              </Badge>
            </div>
          )
        },
      },
      {
        id: "actions",
        cell: () => (
          <div className="flex justify-end pr-2">
            <IconChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
          </div>
        ),
      },
    ],
    []
  )

  const table = useReactTable<TrainingOverviewRow>({
    data: filteredRows,
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

  const tabs: Array<{ id: TrainingOverviewView; label: string; icon: React.ComponentType<{ className?: string }> }> =
    [
      { id: "at_risk", label: "At-risk", icon: IconAlertTriangle },
      { id: "active", label: "Active", icon: IconChecks },
      { id: "stale", label: "Stale", icon: IconFlame },
      { id: "all", label: "All", icon: IconSchool },
    ]

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Training</h2>
        <p className="text-[14px] text-slate-500 max-w-3xl">
          A live view of student training across the club. Default focus: students who likely need proactive outreach.
        </p>
      </div>

      {/* Summary cards */}
      <TooltipProvider delayDuration={0}>
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[
            {
              label: "At-risk",
              value: statsFromRows.atRisk + statsFromRows.newlyEnrolled,
              sub: `Includes ${statsFromRows.newlyEnrolled} newly enrolled`,
              description: "No flight in 31–60 days, or new students (15–30d) yet to fly.",
              icon: IconAlertTriangle,
              iconColor: "text-amber-500",
              bgColor: "bg-amber-50",
            },
            {
              label: "Stale",
              value: statsFromRows.stale,
              sub: "Long time since last flight",
              description: "No flight in 60+ days, or students (30d+) yet to fly.",
              icon: IconFlame,
              iconColor: "text-rose-500",
              bgColor: "bg-rose-50",
            },
            {
              label: "Active",
              value: statsFromRows.active,
              sub: "Flew recently",
              description: "Student has completed a flight within the last 30 days.",
              icon: IconChecks,
              iconColor: "text-emerald-500",
              bgColor: "bg-emerald-50",
            },
            {
              label: "Never flown",
              value: statsFromRows.neverFlown,
              sub: "No completed flights",
              description: "Students who have never completed a recorded flight.",
              icon: IconClock,
              iconColor: "text-indigo-500",
              bgColor: "bg-indigo-50",
            },
            {
              label: "Enrolled",
              value: statsFromRows.total,
              sub: "Active enrollments",
              description: "Total number of students currently active in a syllabus.",
              icon: IconSchool,
              iconColor: "text-slate-500",
              bgColor: "bg-slate-50",
            },
          ].map((stat, i) => (
            <Card key={i} className="@container/card py-4">
              <CardHeader className="px-4 py-0">
                <div className="flex items-center gap-1.5">
                  <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {stat.label}
                  </CardDescription>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="outline-hidden">
                        <IconInfoCircle className="h-3 w-3 text-slate-300 hover:text-slate-400 transition-colors" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px] text-[11px] font-medium leading-tight bg-slate-900 text-white border-slate-800 shadow-xl rounded-lg px-3 py-2">
                      {stat.description}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardTitle className="text-2xl font-bold text-slate-900 tabular-nums">
                  {stat.value}
                </CardTitle>
                <CardAction>
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", stat.bgColor)}>
                    <stat.icon className={cn("h-4 w-4", stat.iconColor)} />
                  </div>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1 px-4 py-0 mt-3">
                <div className="text-[11px] font-bold text-slate-700">
                  {stat.sub}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      </TooltipProvider>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl w-fit border border-slate-200/40">
            {tabs.map((t) => {
              const Icon = t.icon
              const isActive = view === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setView(t.id)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all inline-flex items-center gap-2",
                    isActive
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", isActive ? "text-indigo-500" : "text-slate-400")} />
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 items-center">
            {/* Syllabus filter */}
            <div className="w-full sm:w-64">
              <Select value={syllabusId} onValueChange={setSyllabusId}>
                <SelectTrigger className="w-full h-9 rounded-xl border-slate-200/70 bg-white shadow-sm hover:border-slate-300 transition-colors text-[13px] font-medium px-3">
                  <div className="flex items-center gap-2.5">
                    <IconSchool className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <SelectValue placeholder="All syllabi" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 shadow-lg min-w-[var(--radix-select-trigger-width)]" position="popper" align="start">
                  <SelectItem value="all" className="text-[13px] py-2">All syllabi</SelectItem>
                  {data.syllabi.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-[13px] py-2">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-full h-9 rounded-xl border-slate-200/70 bg-white shadow-sm focus:ring-slate-100 hover:border-slate-300 transition-colors text-[13px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <React.Fragment key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        "px-6 py-4 font-bold text-[11px] uppercase tracking-wider text-slate-500",
                        header.id === "activity_status" ? "text-center" : "text-left"
                      )}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/50">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="group transition-all hover:bg-slate-50/50 cursor-pointer"
                  onClick={() => router.push(`/members/${row.original.user_id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn("px-6 py-4 align-middle", cell.column.id === "actions" ? "pr-8" : "")}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-32 text-center text-slate-400 font-medium">
                  <div className="flex flex-col items-center gap-1">
                    <span>No students match these filters.</span>
                    <span className="text-[11px]">Try adjusting your search or filters.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => {
            const r = row.original
            const first = r.student.first_name || ""
            const last = r.student.last_name || ""
            const name = [first, last].filter(Boolean).join(" ") || r.student.email
            const initials = getUserInitials(first || null, last || null, r.student.email)
            const { label, className } = statusBadge(r.activity_status)
            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] active:bg-slate-50 transition-colors"
                onClick={() => router.push(`/members/${r.user_id}`)}
              >
                <div className="flex justify-between items-start mb-4 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 rounded-full border border-slate-200/50">
                      <AvatarFallback className="bg-slate-50 text-slate-400 text-[10px] font-bold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 gap-0.5">
                      <h3 className="font-bold text-slate-900 truncate tracking-tight">{name}</h3>
                      <span className="text-[11px] text-slate-500 font-medium truncate">{r.student.email}</span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-none border uppercase tracking-wider", className)}
                  >
                    {label}
                  </Badge>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-none border border-slate-200 bg-slate-50/50 text-slate-600 uppercase tracking-wider"
                    >
                      {r.syllabus.name}
                    </Badge>
                    <span className="text-[11px] text-slate-400 font-medium">Enrolled {safeFormatDate(r.enrolled_at)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col gap-1">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Last flew</div>
                      <div className="text-slate-900 font-bold text-[13px]">
                        {r.last_flight_at ? safeFormatDate(r.last_flight_at) : "Never"}
                      </div>
                      <div className="text-slate-400 font-medium text-[10px]">
                        {r.last_flight_at ? daysAgoLabel(r.days_since_last_flight, "") : `${r.days_since_enrolled} days since enrolled`}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Progress</div>
                      <div className="text-slate-900 font-bold text-[13px]">
                        {r.progress.total > 0 ? `${r.progress.completed}/${r.progress.total}` : "—"}
                      </div>
                      <div className="mt-1">{progressBar(r.progress.percent)}</div>
                    </div>
                  </div>
                </div>

                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <IconChevronRight className="w-4 h-4 text-slate-200" />
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm font-medium">
            No students match these filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1">
        <div className="text-[12px] text-slate-500 font-medium">
          Showing{" "}
          <span className="text-slate-900 font-semibold">
            {filteredRows.length === 0 ? 0 : table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
          </span>{" "}
          to{" "}
          <span className="text-slate-900 font-semibold">
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              filteredRows.length
            )}
          </span>{" "}
          of <span className="text-slate-900 font-semibold">{filteredRows.length}</span> students
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-lg h-9 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-all text-[12px] font-bold px-4"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-lg h-9 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-all text-[12px] font-bold px-4"
          >
            Next
          </Button>
        </div>
      </div>

      {/* TODO: Add quick actions (e.g., message/call, schedule next flight, assign instructor) once communication tooling exists. */}
    </div>
  )
}


