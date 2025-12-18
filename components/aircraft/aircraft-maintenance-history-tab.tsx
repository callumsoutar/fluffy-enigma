"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { IconDotsVertical, IconEdit, IconTool, IconAlertTriangle } from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { format } from "date-fns"
import type { MaintenanceVisit } from "@/lib/types/maintenance_visits"

interface MaintenanceHistoryTabProps {
  aircraftId: string
}

interface MaintenanceVisitWithUser extends MaintenanceVisit {
  performed_by_user?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
  component?: {
    id: string
    name: string
  } | null
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—"
  try {
    return format(new Date(dateString), "dd MMM yyyy")
  } catch {
    return "—"
  }
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "—"
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) {
    return "—"
  }
  return `${hours.toFixed(1)}h`
}

function getUserName(visit: MaintenanceVisitWithUser): string {
  if (visit.performed_by_user) {
    const name = [
      visit.performed_by_user.first_name,
      visit.performed_by_user.last_name,
    ]
      .filter(Boolean)
      .join(" ")
    return name || visit.performed_by_user.email || "—"
  }
  return "—"
}

function getVisitTypeBadgeVariant(type: string): "default" | "destructive" | "outline" | "secondary" {
  switch (type?.toLowerCase()) {
    case "scheduled":
      return "default"
    case "unscheduled":
      return "secondary"
    case "inspection":
      return "outline"
    case "repair":
      return "destructive"
    case "modification":
      return "secondary"
    default:
      return "secondary"
  }
}

export function AircraftMaintenanceHistoryTab({ aircraftId }: MaintenanceHistoryTabProps) {
  const [editModalOpen, setEditModalOpen] = React.useState(false)
  const [selectedVisitId, setSelectedVisitId] = React.useState<string | null>(null)

  const {
    data: visits,
    isLoading,
    isError,
    refetch,
  } = useQuery<MaintenanceVisitWithUser[]>({
    queryKey: ["maintenance-visits", aircraftId],
    queryFn: async () => {
      const res = await fetch(`/api/maintenance-visits?aircraft_id=${aircraftId}`)
      if (!res.ok) throw new Error("Failed to fetch maintenance visits")
      return res.json()
    },
  })

  const handleEdit = (visitId: string) => {
    setSelectedVisitId(visitId)
    setEditModalOpen(true)
  }

  const handleEditClose = () => {
    setEditModalOpen(false)
    setSelectedVisitId(null)
    refetch()
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="w-full h-12" />
        <Skeleton className="w-full h-32" />
        <Skeleton className="w-full h-32" />
      </div>
    )
  }

  if (isError) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-red-600">
          <IconAlertTriangle className="h-5 w-5" />
          <span>Failed to load maintenance history.</span>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Maintenance History</h2>
          <p className="text-sm text-muted-foreground">
            {visits?.length || 0} total visit{(visits?.length || 0) !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
              <TableHead className="font-semibold text-gray-900">Visit Date</TableHead>
              <TableHead className="font-semibold text-gray-900">Visit Type</TableHead>
              <TableHead className="font-semibold text-gray-900">Description</TableHead>
              <TableHead className="font-semibold text-gray-900">Component</TableHead>
              <TableHead className="font-semibold text-gray-900">Technician</TableHead>
              <TableHead className="font-semibold text-gray-900">Hours at Visit</TableHead>
              <TableHead className="font-semibold text-gray-900">Total Cost</TableHead>
              <TableHead className="font-semibold text-gray-900">Date Out</TableHead>
              <TableHead className="font-semibold text-gray-900 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!visits || visits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <IconTool className="h-10 w-10 opacity-50" />
                    <p className="text-sm font-medium">No maintenance visits found</p>
                    <p className="text-xs text-center">Maintenance visits will appear here once recorded.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              visits.map((visit) => (
                <TableRow 
                  key={visit.id} 
                  className="hover:bg-gray-50/50 transition-colors border-b border-gray-100"
                >
                  <TableCell className="font-medium text-gray-900 py-4 whitespace-nowrap">
                    {formatDate(visit.visit_date)}
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge variant={getVisitTypeBadgeVariant(visit.visit_type)}>
                      {visit.visit_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-900 py-4 max-w-md">
                    <div className="line-clamp-2">{visit.description}</div>
                  </TableCell>
                  <TableCell className="text-gray-600 py-4">
                    {visit.component?.name || "—"}
                  </TableCell>
                  <TableCell className="text-gray-600 py-4">
                    {getUserName(visit)}
                  </TableCell>
                  <TableCell className="text-gray-600 py-4 whitespace-nowrap">
                    {formatHours(visit.hours_at_visit)}
                  </TableCell>
                  <TableCell className="text-gray-600 py-4 whitespace-nowrap">
                    {formatCurrency(visit.total_cost)}
                  </TableCell>
                  <TableCell className="text-gray-600 py-4 whitespace-nowrap">
                    {formatDate(visit.date_out_of_maintenance)}
                  </TableCell>
                  <TableCell className="text-right py-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                          <IconDotsVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(visit.id)}>
                          <IconEdit className="h-4 w-4 mr-2" />
                          Edit Visit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Modal - Placeholder for now */}
      {editModalOpen && selectedVisitId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Edit Maintenance Visit</h3>
            <p className="text-sm text-muted-foreground mb-4">Edit modal will be implemented here</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleEditClose}>Cancel</Button>
              <Button onClick={handleEditClose}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
