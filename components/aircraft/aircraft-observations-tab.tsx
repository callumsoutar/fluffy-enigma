"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IconPlus, IconAlertTriangle, IconUser, IconCalendar, IconEdit, IconCheck } from "@tabler/icons-react"
import { format } from "date-fns"
import type { ObservationWithUser } from "@/lib/types/observations"
import { useIsMobile } from "@/hooks/use-mobile"
import { AddObservationModal } from "./AddObservationModal"
import { ViewObservationModal } from "./ViewObservationModal"
import { ResolveObservationModal } from "./ResolveObservationModal"

interface ObservationsTabProps {
  aircraftId: string
}

const priorityColor: Record<string, string> = {
  low: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-red-100 text-red-800 border-red-200",
}

const stageColor: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 border-blue-200",
  investigation: "bg-orange-100 text-orange-800 border-orange-200",
  resolution: "bg-purple-100 text-purple-800 border-purple-200",
  closed: "bg-gray-100 text-gray-700 border-gray-200",
}

// Mobile Observation Card Component
function ObservationCard({ 
  observation, 
  onView, 
  onResolve 
}: { 
  observation: ObservationWithUser
  onView: () => void
  onResolve: () => void
}) {
  const getUserName = (obs: ObservationWithUser) => {
    if (obs.reported_by_user) {
      const name = [
        obs.reported_by_user.first_name,
        obs.reported_by_user.last_name,
      ]
        .filter(Boolean)
        .join(" ")
      return name || obs.reported_by_user.email || "Unknown"
    }
    return "Unknown"
  }

  return (
    <Card 
      className="hover:shadow-md transition-all duration-200 border border-gray-200 bg-white"
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header: Name and Stage */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base text-gray-900 mb-2 line-clamp-2">
                {observation.name}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  className={`${stageColor[observation.stage] || ""} border font-medium text-xs px-2 py-0.5`}
                  variant="outline"
                >
                  {observation.stage}
                </Badge>
                <Badge
                  className={`${priorityColor[observation.priority || "medium"] || ""} border font-medium text-xs px-2 py-0.5`}
                  variant="outline"
                >
                  {observation.priority || "medium"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <IconUser className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="truncate">{getUserName(observation)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <IconCalendar className="h-4 w-4 text-gray-400 shrink-0" />
              <span>{format(new Date(observation.created_at), "dd MMM yyyy · HH:mm")}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            {observation.stage !== "closed" && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs h-8"
                onClick={onResolve}
              >
                <IconCheck className="h-3.5 w-3.5 mr-1.5" />
                Resolve
              </Button>
            )}
            <Button 
              size="sm" 
              variant="default"
              className={`${observation.stage !== "closed" ? "flex-1" : "w-full"} text-xs h-8 bg-indigo-600 hover:bg-indigo-700`}
              onClick={onView}
            >
              <IconEdit className="h-3.5 w-3.5 mr-1.5" />
              View
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function AircraftObservationsTab({ aircraftId }: ObservationsTabProps) {
  const [view, setView] = React.useState<"open" | "all">("open")
  const [modalOpen, setModalOpen] = React.useState(false)
  const [selectedObservationId, setSelectedObservationId] = React.useState<string | null>(null)
  const [resolveObservationId, setResolveObservationId] = React.useState<string | null>(null)
  const [mounted, setMounted] = React.useState(false)
  const isMobile = useIsMobile()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const {
    data: observations,
    isLoading,
    isError,
    refetch,
  } = useQuery<ObservationWithUser[]>({
    queryKey: ["observations", aircraftId],
    queryFn: async () => {
      const res = await fetch(`/api/observations?aircraft_id=${aircraftId}`)
      if (!res.ok) throw new Error("Failed to fetch observations")
      return res.json()
    },
  })

  const getUserName = (observation: ObservationWithUser) => {
    if (observation.reported_by_user) {
      const name = [
        observation.reported_by_user.first_name,
        observation.reported_by_user.last_name,
      ]
        .filter(Boolean)
        .join(" ")
      return name || observation.reported_by_user.email || "Unknown"
    }
    return "Unknown"
  }

  // Filter observations based on view
  const filteredObservations =
    observations && observations.length > 0
      ? view === "open"
        ? observations.filter((o) => o.stage !== "closed")
        : observations
      : []

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
          <span>Failed to load observations.</span>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Tabs and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Tabs value={view} onValueChange={(v) => setView(v as "open" | "all")} className="w-full sm:w-auto">
          <TabsList className="grid w-full sm:w-auto grid-cols-2">
            <TabsTrigger value="open" className="text-sm">
              Open Observations
            </TabsTrigger>
            <TabsTrigger value="all" className="text-sm">
              All Observations
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm text-sm sm:text-base flex items-center gap-2 w-full sm:w-auto justify-center"
          onClick={() => setModalOpen(true)}
        >
          <IconPlus className="w-4 h-4" />
          <span className="sm:inline">Add Observation</span>
        </Button>
      </div>

      {/* Mobile Card View */}
      {mounted && isMobile ? (
        <div className="space-y-3">
          {filteredObservations.length === 0 ? (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <IconAlertTriangle className="h-10 w-10 opacity-50" />
                <p className="text-sm font-medium">
                  {!observations || observations.length === 0
                    ? "No observations found for this aircraft."
                    : view === "open"
                    ? "No open observations"
                    : "No observations"}
                </p>
              </div>
            </Card>
          ) : (
            filteredObservations.map((obs) => (
              <ObservationCard
                key={obs.id}
                observation={obs}
                onView={() => setSelectedObservationId(obs.id)}
                onResolve={() => setResolveObservationId(obs.id)}
              />
            ))
          )}
        </div>
      ) : mounted ? (
        /* Desktop Table View */
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                <TableHead className="font-semibold text-gray-900">Name</TableHead>
                <TableHead className="font-semibold text-gray-900">Stage</TableHead>
                <TableHead className="font-semibold text-gray-900">Priority</TableHead>
                <TableHead className="font-semibold text-gray-900">Created</TableHead>
                <TableHead className="font-semibold text-gray-900">Reported By</TableHead>
                <TableHead className="font-semibold text-gray-900 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredObservations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <IconAlertTriangle className="h-10 w-10 opacity-50" />
                      <p className="text-sm font-medium">
                        {!observations || observations.length === 0
                          ? "No observations found for this aircraft."
                          : view === "open"
                          ? "No open observations"
                          : "No observations"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredObservations.map((obs) => (
                  <TableRow 
                    key={obs.id} 
                    className="hover:bg-gray-50/50 transition-colors border-b border-gray-100"
                  >
                    <TableCell className="font-medium text-gray-900 py-4">
                      {obs.name}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge
                        className={`${stageColor[obs.stage] || ""} border font-medium`}
                        variant="outline"
                      >
                        {obs.stage}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge
                        className={`${priorityColor[obs.priority || "medium"] || ""} border font-medium`}
                        variant="outline"
                      >
                        {obs.priority || "medium"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600 py-4">
                      {format(new Date(obs.created_at), "dd MMM yyyy · HH:mm")}
                    </TableCell>
                    <TableCell className="text-gray-600 py-4">
                      {getUserName(obs)}
                    </TableCell>
                    <TableCell className="text-right py-4">
                      <div className="flex items-center justify-end gap-2">
                        {obs.stage !== "closed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => setResolveObservationId(obs.id)}
                          >
                            <IconCheck className="h-3.5 w-3.5 mr-1.5" />
                            Resolve
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="default"
                          className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700"
                          onClick={() => setSelectedObservationId(obs.id)}
                        >
                          <IconEdit className="h-3.5 w-3.5 mr-1.5" />
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Loading placeholder during SSR/hydration */
        <div className="space-y-3">
          <Skeleton className="w-full h-32" />
          <Skeleton className="w-full h-32" />
        </div>
      )}

      {/* Modals */}
      <AddObservationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        aircraftId={aircraftId}
        refresh={refetch}
      />
      {selectedObservationId && (
        <ViewObservationModal
          open={!!selectedObservationId}
          onClose={() => setSelectedObservationId(null)}
          observationId={selectedObservationId}
          refresh={refetch}
        />
      )}
      {resolveObservationId && (
        <ResolveObservationModal
          open={!!resolveObservationId}
          onClose={() => setResolveObservationId(null)}
          observationId={resolveObservationId}
          refresh={refetch}
        />
      )}
    </div>
  )
}
