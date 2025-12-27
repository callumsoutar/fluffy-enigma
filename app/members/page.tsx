"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { MembersTable } from "@/components/members/members-table"
import type { MembersFilter, PersonType } from "@/lib/types/members"

import type { MemberWithRelations } from "@/lib/types/members"

// Fetch members from API
async function fetchMembers(filters?: MembersFilter): Promise<MemberWithRelations[]> {
  const params = new URLSearchParams()
  
  if (filters?.person_type) {
    params.append('person_type', filters.person_type)
  }
  if (filters?.membership_status) {
    params.append('membership_status', filters.membership_status)
  }
  if (filters?.search) {
    params.append('search', filters.search)
  }
  if (filters?.is_active !== undefined) {
    params.append('is_active', filters.is_active.toString())
  }
  if (filters?.membership_type_id) {
    params.append('membership_type_id', filters.membership_type_id)
  }

  const response = await fetch(`/api/members?${params.toString()}`)
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized')
    }
    if (response.status === 403) {
      throw new Error('Forbidden: Insufficient permissions')
    }
    throw new Error('Failed to fetch members')
  }
  const data = await response.json()
  return data.members
}

function getPersonTypeLabel(member: MemberWithRelations): PersonType {
  const hasActiveMembership = member.membership?.is_active
  const hasInstructorRecord = !!member.instructor
  const roleName = member.role?.role

  if (roleName === 'owner' || roleName === 'admin') {
    return 'staff'
  }
  if (hasInstructorRecord) {
    return 'instructor'
  }
  if (hasActiveMembership) {
    return 'member'
  }
  return 'contact'
}

export default function MembersPage() {
  const [activeTab, setActiveTab] = React.useState<PersonType>("member")
  const [mounted, setMounted] = React.useState(false)

  // Prevent hydration mismatch by only calculating after mount
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const {
    data: allMembers = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["members"],
    queryFn: () => fetchMembers(),
    staleTime: 30_000,
  })

  // Calculate tab counts (memoized to prevent recalculation)
  const tabCounts = React.useMemo(() => {
    if (!mounted || isLoading) {
      return { all: 0, member: 0, instructor: 0, staff: 0, contact: 0 }
    }

    return {
      all: allMembers.length,
      member: allMembers.filter((m) => getPersonTypeLabel(m) === 'member').length,
      instructor: allMembers.filter((m) => getPersonTypeLabel(m) === 'instructor').length,
      staff: allMembers.filter((m) => getPersonTypeLabel(m) === 'staff').length,
      contact: allMembers.filter((m) => getPersonTypeLabel(m) === 'contact').length,
    }
  }, [allMembers, isLoading, mounted])

  // Filter members based on active tab
  const filteredMembers = React.useMemo(() => {
    if (isLoading || !mounted) return []

    if (activeTab === "all") {
      return allMembers
    }

    return allMembers.filter((member) => {
      return getPersonTypeLabel(member) === activeTab
    })
  }, [allMembers, activeTab, isLoading, mounted])

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
                      <div className="text-muted-foreground">Loading members...</div>
                    </div>
                  ) : isError ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-muted-foreground">
                        Failed to load members. You may not have permission to view this page.
                      </div>
                    </div>
                  ) : (
                    <MembersTable
                      members={filteredMembers}
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                      tabCounts={tabCounts}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
