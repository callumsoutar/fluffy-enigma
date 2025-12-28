"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { EquipmentTable } from "@/components/equipment/equipment-table"
import type { EquipmentFilter, EquipmentWithIssuance } from "@/lib/types/equipment"
import { AddEquipmentModal } from "@/components/equipment/AddEquipmentModal"
import { IssueEquipmentModal } from "@/components/equipment/IssueEquipmentModal"
import { UpdateEquipmentModal } from "@/components/equipment/UpdateEquipmentModal"
import { ReturnEquipmentModal } from "@/components/equipment/ReturnEquipmentModal"

// Fetch equipment from API
async function fetchEquipment(filters?: EquipmentFilter): Promise<EquipmentWithIssuance[]> {
  const params = new URLSearchParams()
  
  if (filters?.search) {
    params.append('search', filters.search)
  }
  if (filters?.status) {
    params.append('status', filters.status)
  }
  if (filters?.type) {
    params.append('type', filters.type)
  }
  if (filters?.issued !== undefined) {
    params.append('issued', filters.issued.toString())
  }

  const response = await fetch(`/api/equipment?${params.toString()}`)
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized')
    }
    if (response.status === 403) {
      throw new Error('Forbidden: Insufficient permissions')
    }
    throw new Error('Failed to fetch equipment')
  }
  const data = await response.json()
  return data.equipment
}

export default function EquipmentPage() {
  const [addModalOpen, setAddModalOpen] = React.useState(false)
  const [issueModalOpen, setIssueModalOpen] = React.useState(false)
  const [returnModalOpen, setReturnModalOpen] = React.useState(false)
  const [updateModalOpen, setUpdateModalOpen] = React.useState(false)
  const [selectedEquipment, setSelectedEquipment] = React.useState<EquipmentWithIssuance | null>(null)

  const {
    data: equipment = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["equipment"],
    queryFn: () => fetchEquipment(),
    staleTime: 30_000,
  })

  const handleIssue = (equipment: EquipmentWithIssuance) => {
    setSelectedEquipment(equipment)
    setIssueModalOpen(true)
  }

  const handleReturn = (equipment: EquipmentWithIssuance) => {
    setSelectedEquipment(equipment)
    setReturnModalOpen(true)
  }

  const handleLogUpdate = (equipment: EquipmentWithIssuance) => {
    setSelectedEquipment(equipment)
    setUpdateModalOpen(true)
  }

  const handleRefresh = () => {
    refetch()
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
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <div className="flex flex-col gap-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-muted-foreground">Loading equipment...</div>
                    </div>
                  ) : isError ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-muted-foreground">
                        Failed to load equipment. You may not have permission to view this page.
                      </div>
                    </div>
                  ) : (
                    <EquipmentTable 
                      equipment={equipment}
                      onIssue={handleIssue}
                      onReturn={handleReturn}
                      onLogUpdate={handleLogUpdate}
                      onAdd={() => setAddModalOpen(true)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Modals */}
      <AddEquipmentModal 
        open={addModalOpen} 
        onOpenChange={setAddModalOpen}
        onSuccess={handleRefresh}
      />
      
      {selectedEquipment && (
        <>
          <IssueEquipmentModal
            open={issueModalOpen}
            onOpenChange={setIssueModalOpen}
            equipment={selectedEquipment}
            onSuccess={handleRefresh}
          />
          
          <ReturnEquipmentModal
            open={returnModalOpen}
            onOpenChange={setReturnModalOpen}
            equipment={selectedEquipment}
            onSuccess={handleRefresh}
          />
          
          <UpdateEquipmentModal
            open={updateModalOpen}
            onOpenChange={setUpdateModalOpen}
            equipment={selectedEquipment}
            onSuccess={handleRefresh}
          />
        </>
      )}
    </SidebarProvider>
  )
}

