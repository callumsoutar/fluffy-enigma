"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import * as Tabs from "@radix-ui/react-tabs"
import { toast } from "sonner"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Equipment, EquipmentStatus, EquipmentType, EquipmentIssuance, EquipmentUpdate } from "@/lib/types/equipment"
import { EQUIPMENT_TYPE_OPTIONS, EQUIPMENT_STATUS_OPTIONS } from "@/lib/types/equipment"
import { EquipmentIssuanceTable } from "@/components/equipment/EquipmentIssuanceTable"
import { EquipmentUpdatesTable } from "@/components/equipment/EquipmentUpdatesTable"
import { 
  IconArrowLeft, 
  IconPackage, 
  IconHistory, 
  IconSettings,
  IconDeviceFloppy,
  IconRotateClockwise,
  IconChevronDown,
  IconTrash,
  IconClipboardList,
  IconInfoCircle
} from "@tabler/icons-react"

const tabItems = [
  { id: "overview", label: "Overview", icon: IconInfoCircle },
  { id: "issuance", label: "Issuance History", icon: IconClipboardList },
  { id: "updates", label: "Updates", icon: IconHistory },
]

async function fetchEquipment(id: string): Promise<Equipment> {
  const response = await fetch(`/api/equipment/${id}`)

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized")
    }
    if (response.status === 403) {
      throw new Error("Forbidden: Insufficient permissions")
    }
    if (response.status === 404) {
      throw new Error("Equipment not found")
    }
    throw new Error("Failed to fetch equipment")
  }

  const payload = await response.json()
  return payload.equipment as Equipment
}

function getStatusBadgeClass(status: string) {
  const statusLower = status.toLowerCase()
  if (statusLower === "active") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (statusLower === "maintenance") return "bg-amber-50 text-amber-700 border-amber-200"
  if (statusLower === "lost") return "bg-red-50 text-red-700 border-red-200"
  if (statusLower === "retired") return "bg-slate-50 text-slate-700 border-slate-200"
  return "bg-slate-50 text-slate-700 border-slate-200"
}

export default function EquipmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const rawEquipmentId = params?.id
  const equipmentId = Array.isArray(rawEquipmentId) ? rawEquipmentId[0] : rawEquipmentId
  const [selectedTab, setSelectedTab] = React.useState("overview")
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)

  // Fetch equipment
  const {
    data: equipment,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["equipment", equipmentId],
    queryFn: () => {
      if (!equipmentId) {
        throw new Error("Equipment ID is missing")
      }
      return fetchEquipment(equipmentId)
    },
    enabled: Boolean(equipmentId),
  })

  // Local state for form editing
  const [formData, setFormData] = React.useState<Equipment | null>(null)
  const [initialFormData, setInitialFormData] = React.useState<Equipment | null>(null)
  const [isDirty, setIsDirty] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  // Issuance history state
  const [issuance, setIssuance] = React.useState<EquipmentIssuance[]>([])
  const [issuanceLoading, setIssuanceLoading] = React.useState(false)
  const [issuanceError, setIssuanceError] = React.useState<string | null>(null)
  const [userMap, setUserMap] = React.useState<Record<string, string>>({})

  // Updates history state
  const [updates, setUpdates] = React.useState<EquipmentUpdate[]>([])
  const [updatesLoading, setUpdatesLoading] = React.useState(false)
  const [updatesError, setUpdatesError] = React.useState<string | null>(null)
  const [updatesUserMap, setUpdatesUserMap] = React.useState<Record<string, string>>({})

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Initialize form data when equipment loads
  React.useEffect(() => {
    if (equipment) {
      setFormData(equipment)
      setInitialFormData(equipment)
    }
  }, [equipment])

  // Check if form is dirty
  React.useEffect(() => {
    if (formData && initialFormData) {
      setIsDirty(JSON.stringify(formData) !== JSON.stringify(initialFormData))
    }
  }, [formData, initialFormData])

  // Fetch issuance history
  const fetchIssuanceHistory = React.useCallback(() => {
    if (!equipmentId) return
    setIssuanceLoading(true)
    setIssuanceError(null)
    fetch(`/api/equipment-issuance?equipment_id=${equipmentId}`)
      .then((res) => res.json())
      .then((data) => {
        setIssuance(data.issuances || [])
        const userIds = Array.from(
          new Set((data.issuances || []).flatMap((row: EquipmentIssuance) => [row.user_id, row.issued_by]))
        )
        if (userIds.length > 0) {
          fetch(`/api/users?ids=${userIds.join(",")}`)
            .then((res) => res.json())
            .then((userData) => {
              const map: Record<string, string> = {}
              ;(userData.users || []).forEach((u: { id: string; first_name?: string; last_name?: string; email?: string }) => {
                map[u.id] = u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : (u.email || u.id)
              })
              setUserMap(map)
            })
        }
      })
      .catch(() => {
        setIssuanceError("Failed to load issuance history")
      })
      .finally(() => setIssuanceLoading(false))
  }, [equipmentId])

  // Fetch updates history
  const fetchUpdatesHistory = React.useCallback(() => {
    if (!equipmentId) return
    setUpdatesLoading(true)
    setUpdatesError(null)
    fetch(`/api/equipment-updates?equipment_id=${equipmentId}`)
      .then((res) => res.json())
      .then((data) => {
        setUpdates(data.updates || [])
        const userIds = Array.from(new Set((data.updates || []).map((row: EquipmentUpdate) => row.updated_by)))
        if (userIds.length > 0) {
          fetch(`/api/users?ids=${userIds.join(",")}`)
            .then((res) => res.json())
            .then((userData) => {
              const map: Record<string, string> = {}
              ;(userData.users || []).forEach((u: { id: string; first_name?: string; last_name?: string; email?: string }) => {
                map[u.id] = u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : (u.email || u.id)
              })
              setUpdatesUserMap(map)
            })
        }
      })
      .catch(() => {
        setUpdatesError("Failed to load update history")
      })
      .finally(() => setUpdatesLoading(false))
  }, [equipmentId])

  React.useEffect(() => {
    fetchIssuanceHistory()
  }, [fetchIssuanceHistory])

  React.useEffect(() => {
    fetchUpdatesHistory()
  }, [fetchUpdatesHistory])

  // Update underline position when tab changes
  React.useEffect(() => {
    const activeTabElement = tabRefs.current[selectedTab]
    const tabsList = tabsListRef.current
    
    if (activeTabElement && tabsList) {
      const tabsListRect = tabsList.getBoundingClientRect()
      const activeTabRect = activeTabElement.getBoundingClientRect()
      
      setUnderlineStyle({
        left: activeTabRect.left - tabsListRect.left,
        width: activeTabRect.width
      })
    }
  }, [selectedTab])

  // Save handler
  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!formData || !equipmentId) return
    
    setIsSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, created_at: _created_at, updated_at: _updated_at, voided_at: _voided_at, ...updateFields } = formData
      const res = await fetch(`/api/equipment/${equipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateFields),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || "Failed to update equipment")
      } else if (!json.equipment) {
        toast.warning("No equipment was updated. It may already be up to date or not found.")
      } else {
        setFormData(json.equipment)
        setInitialFormData(json.equipment)
        setIsDirty(false)
        toast.success("Equipment updated successfully")
      }
    } catch {
      toast.error("Network error while saving equipment")
    } finally {
      setIsSaving(false)
    }
  }

  // Undo handler
  function handleUndo() {
    if (initialFormData) {
      setFormData(initialFormData)
      setIsDirty(false)
    }
  }

  // Delete handler
  async function handleDelete() {
    if (!equipmentId) return
    
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/equipment/${equipmentId}`, {
        method: "DELETE",
      })
      
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error || "Failed to delete equipment")
        return
      }
      
      toast.success("Equipment deleted successfully")
      setShowDeleteDialog(false)
      router.push("/equipment")
    } catch {
      toast.error("Network error while deleting equipment")
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading || !equipment || !formData) {
    return (
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading equipment...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (isError) {
    return (
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">
              {(error as Error)?.message || "Failed to load equipment"}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="flex-1 mx-auto max-w-6xl w-full px-4 sm:px-6 lg:px-8 py-8">
            <Link
              href="/equipment"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <IconArrowLeft className="w-4 h-4" />
              Back to Equipment
            </Link>

            <Card className="mb-6 shadow-sm border border-border/50 bg-card">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 border border-slate-200">
                      <IconPackage className="h-8 w-8 text-slate-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-bold text-gray-900">
                          {equipment.name}
                        </h1>
                        <Badge variant="outline" className={cn("text-xs font-medium px-2 py-0.5", getStatusBadgeClass(equipment.status))}>
                          {equipment.status.charAt(0).toUpperCase() + equipment.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600">
                        <span className="capitalize">{equipment.type}</span>
                        {equipment.serial_number && (
                          <>
                            <span>•</span>
                            <span>SN: {equipment.serial_number}</span>
                          </>
                        )}
                        {equipment.label && (
                          <>
                            <span>•</span>
                            <span>{equipment.label}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2">
                        Options
                        <IconChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <IconTrash className="h-4 w-4 mr-2" />
                        Delete Equipment
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border border-border/50 bg-card">
              <CardContent className="p-0">
                <Tabs.Root
                  value={selectedTab}
                  onValueChange={setSelectedTab}
                  className="w-full flex flex-col"
                >
                  <div className="w-full border-b border-gray-200 bg-white relative">
                    <div className="hidden md:flex items-center px-6 pt-2 relative">
                      <div className="flex items-center w-full overflow-x-auto scrollbar-hide scroll-smooth">
                        <Tabs.List
                          ref={tabsListRef}
                          className="flex flex-row gap-1 min-h-[48px] relative min-w-max"
                          aria-label="Equipment tabs"
                        >
                          <div
                            className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                            style={{
                              left: `${underlineStyle.left}px`,
                              width: `${underlineStyle.width}px`,
                            }}
                          />
                          {tabItems.map((tab) => {
                            const Icon = tab.icon
                            return (
                              <Tabs.Trigger
                                key={tab.id}
                                ref={(el) => { tabRefs.current[tab.id] = el }}
                                value={tab.id}
                                className="inline-flex items-center gap-2 px-4 py-3 pb-1 text-base font-medium border-b-2 border-transparent transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 cursor-pointer data-[state=active]:text-indigo-800 data-[state=inactive]:text-gray-500 hover:text-indigo-600 whitespace-nowrap flex-shrink-0 min-h-[48px] min-w-[44px] touch-manipulation active:bg-gray-50"
                                style={{ background: "none", boxShadow: "none", borderRadius: 0 }}
                                aria-label={`${tab.label} tab`}
                              >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                <span>{tab.label}</span>
                              </Tabs.Trigger>
                            )
                          })}
                        </Tabs.List>
                      </div>
                    </div>

                    {/* Mobile: Simple Tab Switcher */}
                    <div className="md:hidden px-4 pt-3 pb-3">
                      <Select value={selectedTab} onValueChange={setSelectedTab}>
                        <SelectTrigger className="w-full h-11 border-2 border-gray-300 hover:border-indigo-400 focus:border-indigo-500">
                          <SelectValue>
                            {(() => {
                              const activeTabItem = tabItems.find(t => t.id === selectedTab)
                              const Icon = activeTabItem?.icon || IconInfoCircle
                              return (
                                <div className="flex items-center gap-2">
                                  <Icon className="w-4 h-4 text-indigo-600" />
                                  <span className="font-medium">{activeTabItem?.label || "Select tab"}</span>
                                </div>
                              )
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {tabItems.map((tab) => {
                            const Icon = tab.icon
                            const isActive = selectedTab === tab.id
                            return (
                              <SelectItem 
                                key={tab.id} 
                                value={tab.id}
                                className={isActive ? "bg-indigo-50" : ""}
                              >
                                <div className="flex items-center gap-2">
                                  <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-gray-500"}`} />
                                  <span className={isActive ? "font-semibold text-indigo-900" : ""}>
                                    {tab.label}
                                  </span>
                                </div>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="w-full p-4 sm:p-6">
                    <Tabs.Content value="overview">
                      <form className="space-y-8 pb-32" onSubmit={handleSave}>
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm">
                          <h3 className="flex items-center gap-2 text-base font-bold mb-5 text-gray-900 tracking-tight">
                            <IconSettings className="w-5 h-5 text-indigo-600" />
                            Equipment Details
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Name</label>
                              <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Equipment Name"
                                className="bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Label</label>
                              <Input
                                value={formData.label || ""}
                                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                                placeholder="Label"
                                className="bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Serial Number</label>
                              <Input
                                value={formData.serial_number || ""}
                                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                                placeholder="Serial Number"
                                className="bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Location</label>
                              <Input
                                value={formData.location || ""}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                placeholder="Location"
                                className="bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
                              <Select
                                value={formData.status}
                                onValueChange={(val) => setFormData({ ...formData, status: val as EquipmentStatus })}
                              >
                                <SelectTrigger className="bg-white w-full border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all">
                                  <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  {EQUIPMENT_STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Type</label>
                              <Select
                                value={formData.type}
                                onValueChange={(val) => setFormData({ ...formData, type: val as EquipmentType })}
                              >
                                <SelectTrigger className="bg-white w-full border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all">
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="mt-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes</label>
                            <Textarea
                              value={formData.notes || ""}
                              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                              placeholder="Notes"
                              className="bg-white min-h-[120px] border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all resize-y"
                            />
                          </div>
                        </div>
                      </form>
                    </Tabs.Content>

                    <Tabs.Content value="issuance">
                      <EquipmentIssuanceTable
                        issuances={issuance}
                        userMap={userMap}
                        loading={issuanceLoading}
                        error={issuanceError}
                        equipment={equipment}
                        refresh={fetchIssuanceHistory}
                      />
                    </Tabs.Content>

                    <Tabs.Content value="updates">
                      <EquipmentUpdatesTable
                        updates={updates}
                        userMap={updatesUserMap}
                        loading={updatesLoading}
                        error={updatesError}
                        equipment={equipment}
                        refresh={fetchUpdatesHistory}
                      />
                    </Tabs.Content>
                  </div>
                </Tabs.Root>
              </CardContent>
            </Card>

            {/* Sticky Form Actions */}
            {selectedTab === "overview" && isDirty && (
              <div
                className="fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl"
                style={{ zIndex: 50 }}
              >
                <div
                  className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4"
                  style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">You have unsaved equipment details.</p>
                    <div className="flex items-center justify-end gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={handleUndo}
                        disabled={isSaving}
                        className="h-12 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium px-8 min-w-[160px]"
                      >
                        <IconRotateClockwise className="h-4 w-4 mr-2" />
                        Undo changes
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSave}
                        size="lg"
                        disabled={isSaving}
                        className="h-12 bg-slate-700 hover:bg-slate-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all px-8 min-w-[160px]"
                      >
                        <IconDeviceFloppy className="h-4 w-4 mr-2" />
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <IconTrash className="h-5 w-5 text-destructive" />
              Delete Equipment
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{equipment.name}</strong>? This action cannot be undone and will permanently remove the equipment from your inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Equipment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}

