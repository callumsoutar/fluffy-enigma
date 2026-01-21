"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  IconArrowLeft,
  IconCalendar,
  IconUser,
  IconUsers,
  IconCreditCard,
  IconMail,
  IconChevronDown,
  IconReceipt,
  IconUserPlus,
  IconKey,
  IconShieldCheck,
  IconRefresh,
  IconCheck,
  IconHistory,
  IconChartBar,
} from "@tabler/icons-react"
import Link from "next/link"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import * as Tabs from "@radix-ui/react-tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { toast } from "sonner"
import { getUserInitials } from "@/lib/utils"
import type { MemberWithRelations } from "@/lib/types/members"
import { MemberPilotDetails } from "@/components/members/member-pilot-details"
import { MemberContactDetails } from "@/components/members/member-contact-details"
import { MemberMemberships } from "@/components/members/member-memberships"
import { MemberAccountTab } from "@/components/members/member-account-tab"
import { MemberUpcomingBookingsTable } from "@/components/members/member-upcoming-bookings-table"
import { MemberFlightHistoryTab } from "@/components/members/member-flight-history-tab"
import { MemberTrainingTab } from "@/components/members/member-training-tab"
import { MemberHistoryTab } from "@/components/members/member-history-tab"
import { useAuth } from "@/contexts/auth-context"
import { isValidRole, type UserRole } from "@/lib/types/roles"
import { CreateInstructorProfileDialog } from "@/components/members/CreateInstructorProfileDialog"
import { StickyFormActions } from "@/components/ui/sticky-form-actions"
import { NewBookingModal } from "@/components/bookings/new-booking-modal"

async function fetchMember(id: string): Promise<MemberWithRelations> {
  const response = await fetch(`/api/members/${id}`)
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Member not found')
    }
    if (response.status === 403) {
      throw new Error('Forbidden: Insufficient permissions')
    }
    throw new Error('Failed to fetch member')
  }
  const data = await response.json()
  return data.member
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return ""
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return ""
  }
}

export default function MemberDetailPage() {
  const params = useParams()
  const router = useRouter()
  const memberId = params.id as string
  const queryClient = useQueryClient()
  const { role: viewerRole } = useAuth()
  const isStaffViewer = viewerRole === "admin" || viewerRole === "owner"
  const [activeTab, setActiveTab] = React.useState("contact")
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const [showScrollLeft, setShowScrollLeft] = React.useState(false)
  const [showScrollRight, setShowScrollRight] = React.useState(false)
  const [isUpdatingRole, setIsUpdatingRole] = React.useState(false)
  const [isInviting, setIsInviting] = React.useState(false)
  const [roleUpdateError, setRoleUpdateError] = React.useState<string | null>(null)
  const [showCreateInstructorDialog, setShowCreateInstructorDialog] = React.useState(false)
  const [isBookingModalOpen, setIsBookingModalOpen] = React.useState(false)

  // Form states for sticky banner
  const [isContactDirty, setIsContactDirty] = React.useState(false)
  const [isContactSaving, setIsContactSaving] = React.useState(false)
  const contactUndoRef = React.useRef<(() => void) | null>(null)

  const [isPilotDirty, setIsPilotDirty] = React.useState(false)
  const [isPilotSaving, setIsPilotSaving] = React.useState(false)
  const pilotUndoRef = React.useRef<(() => void) | null>(null)

  const [isConfirming, setIsConfirming] = React.useState(false)
  const [isResettingPassword, setIsResettingPassword] = React.useState(false)

  const {
    data: member,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["member", memberId],
    queryFn: () => fetchMember(memberId),
    enabled: !!memberId,
  })

  // ... (rest of the code)

  async function confirmUser() {
    if (!isStaffViewer || isConfirming || !member?.is_auth_user) return
    setIsConfirming(true)
    const toastId = toast.loading("Confirming user...")
    try {
      const res = await fetch(`/api/members/${memberId}/confirm`, {
        method: "POST",
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Failed to confirm user")
      }

      toast.success("User confirmed successfully", { id: toastId })
      await queryClient.invalidateQueries({ queryKey: ["member", memberId] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to confirm user", { id: toastId })
    } finally {
      setIsConfirming(false)
    }
  }

  async function resetPassword() {
    if (!isStaffViewer || isResettingPassword || !member?.is_auth_user) return
    setIsResettingPassword(true)
    const toastId = toast.loading("Sending reset email...")
    try {
      const res = await fetch(`/api/members/${memberId}/reset-password`, {
        method: "POST",
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Failed to send reset email")
      }

      toast.success("Password reset email sent", { id: toastId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send reset email", { id: toastId })
    } finally {
      setIsResettingPassword(false)
    }
  }

  // Update underline position when tab changes and scroll active tab into view
  React.useEffect(() => {
    const activeTabElement = tabRefs.current[activeTab]
    const tabsList = tabsListRef.current
    
    if (activeTabElement && tabsList) {
      const tabsListRect = tabsList.getBoundingClientRect()
      const activeTabRect = activeTabElement.getBoundingClientRect()
      
      setUnderlineStyle({
        left: activeTabRect.left - tabsListRect.left,
        width: activeTabRect.width
      })

      // Scroll active tab into view on mobile/tablet
      if (window.innerWidth < 768) {
        const scrollLeft = tabsList.scrollLeft
        const tabLeft = activeTabRect.left - tabsListRect.left
        const tabWidth = activeTabRect.width
        const containerWidth = tabsListRect.width
        
        // Calculate scroll position to center the tab
        const targetScroll = scrollLeft + tabLeft - (containerWidth / 2) + (tabWidth / 2)
        
        tabsList.scrollTo({
          left: Math.max(0, targetScroll),
          behavior: 'smooth'
        })
      }
    }
  }, [activeTab])

  // Initial positioning on mount
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const activeTabElement = tabRefs.current[activeTab]
      const tabsList = tabsListRef.current
      
      if (activeTabElement && tabsList) {
        const tabsListRect = tabsList.getBoundingClientRect()
        const activeTabRect = activeTabElement.getBoundingClientRect()
        
        setUnderlineStyle({
          left: activeTabRect.left - tabsListRect.left,
          width: activeTabRect.width
        })
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [activeTab])

  // Check scroll position for fade indicators
  React.useEffect(() => {
    const tabsList = tabsListRef.current
    if (!tabsList) return

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = tabsList
      setShowScrollLeft(scrollLeft > 0)
      setShowScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
    }

    checkScroll()
    tabsList.addEventListener('scroll', checkScroll)
    window.addEventListener('resize', checkScroll)

    return () => {
      tabsList.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [activeTab])

  const tabItems = [
    { id: "contact", label: "Contact", icon: IconMail },
    { id: "pilot", label: "Pilot Details", icon: IconUser },
    { id: "memberships", label: "Memberships", icon: IconUsers },
    { id: "finances", label: "Finances", icon: IconCreditCard },
    { id: "flights", label: "Bookings", icon: IconCalendar },
    { id: "logbook", label: "Logbook", icon: IconHistory },
    { id: "training", label: "Training", icon: IconChartBar },
    { id: "account", label: "Account", icon: IconUser },
  ]

  if (isLoading) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading member...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (isError || !member) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">
              {error instanceof Error ? error.message : "Failed to load member"}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const firstName = member.first_name || ""
  const lastName = member.last_name || ""
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || member.email || "Unknown Member"
  const initials = getUserInitials(firstName, lastName, member.email)
  const isActive = member.is_active
  const membershipStartDate = member.membership?.start_date
    ? formatDate(member.membership.start_date)
    : null

  const memberRole: UserRole | null =
    member.role?.role && isValidRole(member.role.role) ? member.role.role : null
  const hasInstructorProfile = Boolean(member.instructor?.id)

  const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
    { value: "member", label: "Member" },
    { value: "student", label: "Student" },
    { value: "instructor", label: "Instructor" },
    { value: "admin", label: "Admin" },
    { value: "owner", label: "Owner" },
  ]

  async function updateMemberRole(nextRole: UserRole) {
    if (!isStaffViewer) return
    setRoleUpdateError(null)
    setIsUpdatingRole(true)
    try {
      const res = await fetch(`/api/members/${memberId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error || "Failed to update role")
      }

      await queryClient.invalidateQueries({ queryKey: ["member", memberId] })
    } catch (e) {
      setRoleUpdateError(e instanceof Error ? e.message : "Failed to update role")
    } finally {
      setIsUpdatingRole(false)
    }
  }

  async function inviteUser() {
    if (!isStaffViewer || isInviting) return
    setIsInviting(true)
    const toastId = toast.loading("Sending invitation...")
    try {
      const res = await fetch(`/api/members/${memberId}/invite`, {
        method: "POST",
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(json.error || "Failed to send invitation")
      }

      toast.success("Invitation sent successfully", { id: toastId })
      
      // If the ID changed (syncing IDs), we need to redirect to the new URL
      if (json.auth_user_id && json.auth_user_id !== memberId) {
        router.push(`/members/${json.auth_user_id}`)
      } else {
        await queryClient.invalidateQueries({ queryKey: ["member", memberId] })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send invitation", { id: toastId })
    } finally {
      setIsInviting(false)
    }
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
          <div className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8">
            {/* Back Link */}
            <Link
              href="/members"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <IconArrowLeft className="h-4 w-4" />
              Back to Members
            </Link>

            {/* Member Summary Card */}
            <Card className="mb-6 shadow-sm border border-border/50 bg-card">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 sm:gap-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-20 w-20 rounded-full bg-gray-100 border-0">
                      <AvatarFallback className="bg-gray-100 text-gray-600 text-xl font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <h1 className="text-2xl font-bold text-gray-900 break-words">{fullName}</h1>
                        <Badge
                          className={`rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap ${
                            isActive 
                              ? "bg-green-100 text-green-700 border-0" 
                              : "bg-red-100 text-red-700 border-0"
                          }`}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
                        {member.email && (
                          <span>{member.email}</span>
                        )}
                        {member.phone && (
                          <span>{member.phone}</span>
                        )}
                        {membershipStartDate && (
                          <span>Member since {membershipStartDate}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="gap-2 bg-white hover:bg-gray-50 border-gray-300 text-gray-700 font-medium w-full sm:w-auto"
                        >
                          Quick Actions
                          <IconChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => setIsBookingModalOpen(true)}>
                          <IconCalendar className="h-4 w-4 mr-2" />
                          New Booking
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/invoices/new?user_id=${memberId}`)}>
                          <IconReceipt className="h-4 w-4 mr-2" />
                          New Invoice
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      className="bg-[#6564db] hover:bg-[#232ed1] text-white gap-2 font-semibold shadow-sm w-full sm:w-auto"
                      onClick={() => setIsBookingModalOpen(true)}
                    >
                      <IconCalendar className="h-4 w-4" />
                      New Booking
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <CreateInstructorProfileDialog
              open={showCreateInstructorDialog}
              onOpenChange={setShowCreateInstructorDialog}
              userId={memberId}
              onCreated={async () => {
                await queryClient.invalidateQueries({ queryKey: ["member", memberId] })
              }}
            />

            <NewBookingModal
              open={isBookingModalOpen}
              onOpenChange={setIsBookingModalOpen}
              prefill={{
                member: member ? {
                  id: member.id,
                  first_name: member.first_name,
                  last_name: member.last_name,
                  email: member.email,
                } : null
              }}
              onCreated={async () => {
                await queryClient.invalidateQueries({ queryKey: ["member", memberId] })
                await queryClient.invalidateQueries({ queryKey: ["member-bookings", memberId] })
              }}
            />

            {/* Tabbed Content */}
            <Card className="shadow-sm border border-border/50 bg-card">
              <CardContent className="p-0">
                    <Tabs.Root
                      value={activeTab}
                      onValueChange={setActiveTab}
                      className="w-full flex flex-col"
                    >
                      {/* Tab Header with Animated Underline */}
                      <div className="w-full border-b border-gray-200 bg-white relative">
                        {/* Mobile: Simple Tab Switcher */}
                        <div className="md:hidden px-4 pt-3 pb-3">
                          <Select value={activeTab} onValueChange={setActiveTab}>
                            <SelectTrigger className="w-full h-11 border-2 border-gray-300 hover:border-indigo-400 focus:border-indigo-500">
                              <SelectValue>
                                {(() => {
                                  const activeTabItem = tabItems.find(t => t.id === activeTab)
                                  const Icon = activeTabItem?.icon || IconMail
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
                                const isActive = activeTab === tab.id
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

                        {/* Desktop: Horizontal scrollable tabs */}
                        <div className="hidden md:flex items-center px-6 pt-2 relative">
                          {/* Left fade gradient */}
                          {showScrollLeft && (
                            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
                          )}
                          {/* Right fade gradient */}
                          {showScrollRight && (
                            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                          )}
                          <div className="flex items-center w-full overflow-x-auto scrollbar-hide scroll-smooth">
                            <Tabs.List
                              ref={tabsListRef}
                              className="flex flex-row gap-1 min-h-[48px] relative min-w-max"
                              aria-label="Member tabs"
                            >
                              {/* Animated underline */}
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
                                    role="tab"
                                    aria-selected={activeTab === tab.id}
                                  >
                                    <Icon className="w-5 h-5 flex-shrink-0" />
                                    <span>{tab.label}</span>
                                  </Tabs.Trigger>
                                )
                              })}
                            </Tabs.List>
                          </div>
                        </div>
                      </div>

                      {/* Tab Content */}
                      <div className="w-full p-4 sm:p-6">
                        <Tabs.Content value="account">
                          <div className="space-y-6">
                            {/* Account Information */}
                            <Card className="shadow-sm border border-border/50 bg-card">
                              <CardContent className="p-4 sm:p-6">
                                <div className="mb-6">
                                  <h2 className="text-lg font-semibold text-gray-900">Account Information</h2>
                                  <p className="text-sm text-muted-foreground">
                                    Manage portal access and system roles.
                                  </p>
                                </div>

                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                  {/* Portal Access Status */}
                                  <div className="rounded-xl border border-border/60 bg-white p-4">
                                    <div className="text-sm font-semibold text-gray-900 mb-4">Portal Access</div>
                                    <div className="flex items-center gap-3">
                                      <Badge
                                        className={`rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap ${
                                          member.is_auth_user 
                                            ? "bg-blue-100 text-blue-700 border-0" 
                                            : "bg-orange-100 text-orange-700 border-0"
                                        }`}
                                      >
                                        {member.is_auth_user ? "Active Access" : "No Access"}
                                      </Badge>
                                      <span className="text-sm text-muted-foreground">
                                        {member.is_auth_user 
                                          ? (member.auth_user_confirmed_at 
                                              ? `Confirmed on ${formatDate(member.auth_user_confirmed_at)}`
                                              : "Waiting for confirmation")
                                          : "User has not been invited to the portal."}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Role Selection */}
                                  <div className="rounded-xl border border-border/60 bg-white p-4">
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                      <div className="text-sm font-semibold text-gray-900">System Role</div>
                                      {memberRole && (
                                        <Badge className="rounded-md px-2 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 border-0 whitespace-nowrap">
                                          {memberRole}
                                        </Badge>
                                      )}
                                    </div>
                                    <Select
                                      value={memberRole ?? "member"}
                                      onValueChange={(value) => updateMemberRole(value as UserRole)}
                                      disabled={!isStaffViewer || isUpdatingRole}
                                    >
                                      <SelectTrigger className="w-full h-10 bg-white border-gray-300">
                                        <SelectValue placeholder="Select role" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {ROLE_OPTIONS.map((opt) => (
                                          <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {!isStaffViewer && (
                                      <p className="mt-2 text-xs text-muted-foreground">
                                        Only admins/owners can change roles.
                                      </p>
                                    )}
                                    {roleUpdateError && (
                                      <p className="mt-2 text-xs text-red-700">{roleUpdateError}</p>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Account Actions */}
                            {isStaffViewer && (
                              <Card className="shadow-sm border border-border/50 bg-card">
                                <CardContent className="p-4 sm:p-6">
                                  <div className="mb-6">
                                    <h2 className="text-lg font-semibold text-gray-900">Account Actions</h2>
                                    <p className="text-sm text-muted-foreground">
                                      Administrative actions for user account management.
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap gap-3">
                                    <Button
                                      variant="outline"
                                      className="gap-2"
                                      onClick={inviteUser}
                                      disabled={isInviting || member.is_auth_user}
                                    >
                                      <IconUserPlus className="h-4 w-4" />
                                      {member.is_auth_user ? "Already Invited" : "Send Invitation"}
                                    </Button>

                                    <Button
                                      variant="outline"
                                      className="gap-2"
                                      onClick={resetPassword}
                                      disabled={isResettingPassword || !member.is_auth_user}
                                    >
                                      <IconKey className="h-4 w-4" />
                                      Reset Password
                                    </Button>

                                    {!member.auth_user_confirmed_at && member.is_auth_user && (
                                      <Button
                                        variant="outline"
                                        className="gap-2 border-green-200 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                        onClick={confirmUser}
                                        disabled={isConfirming}
                                      >
                                        <IconShieldCheck className="h-4 w-4" />
                                        Confirm User Manually
                                      </Button>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )}

                            {/* Instructor Profile Configuration */}
                            {memberRole && ["instructor", "admin", "owner"].includes(memberRole) && (
                              <Card className="shadow-sm border border-border/50 bg-card">
                                <CardContent className="p-4 sm:p-6">
                                  <div className="mb-6">
                                    <h2 className="text-lg font-semibold text-gray-900">Instructor Profile</h2>
                                    <p className="text-sm text-muted-foreground">
                                      Domain profile for rostering and operational data.
                                    </p>
                                  </div>

                                  <div className="rounded-xl border border-border/60 bg-white p-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                      <div>
                                        {hasInstructorProfile ? (
                                          <div className="text-sm font-medium text-green-800 flex items-center gap-2">
                                            <IconCheck className="h-4 w-4" />
                                            Instructor profile configured
                                          </div>
                                        ) : (
                                          <div className="text-sm font-medium text-amber-800">
                                            No instructor profile found.
                                          </div>
                                        )}
                                        <p className="mt-1 text-sm text-muted-foreground">
                                          {hasInstructorProfile 
                                            ? "All operational details are managed in the staff directory."
                                            : "This user has a staff role but needs a profile for operational use."}
                                        </p>
                                      </div>

                                      <div className="flex-shrink-0">
                                        {!hasInstructorProfile ? (
                                          <Button
                                            onClick={() => setShowCreateInstructorDialog(true)}
                                            disabled={!isStaffViewer}
                                            className="bg-amber-600 hover:bg-amber-700 text-white w-full sm:w-auto"
                                          >
                                            Create Instructor Profile
                                          </Button>
                                        ) : (
                                          <Button
                                            variant="outline"
                                            onClick={() => router.push(`/staff/instructors/${member.instructor!.id}`)}
                                            className="w-full sm:w-auto gap-2"
                                          >
                                            <IconRefresh className="h-4 w-4" />
                                            Edit Operational Profile
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        </Tabs.Content>

                        <Tabs.Content value="contact">
                          <MemberContactDetails 
                            memberId={memberId} 
                            member={member} 
                            onDirtyChange={setIsContactDirty}
                            onSavingChange={setIsContactSaving}
                            onUndoRef={contactUndoRef}
                            formId="contact-details-form"
                          />
                        </Tabs.Content>

                        <Tabs.Content value="pilot">
                          <MemberPilotDetails 
                            memberId={memberId} 
                            onDirtyChange={setIsPilotDirty}
                            onSavingChange={setIsPilotSaving}
                            onUndoRef={pilotUndoRef}
                            formId="pilot-details-form"
                          />
                        </Tabs.Content>

                        <Tabs.Content value="memberships">
                          <MemberMemberships memberId={memberId} />
                        </Tabs.Content>

                        <Tabs.Content value="finances">
                          <MemberAccountTab memberId={memberId} member={member} />
                        </Tabs.Content>

                        <Tabs.Content value="flights">
                          <div className="space-y-6">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold text-slate-900">Upcoming Bookings</h3>
                            </div>
                            <MemberUpcomingBookingsTable memberId={memberId} />
                          </div>
                        </Tabs.Content>

                        <Tabs.Content value="logbook">
                          <div className="space-y-6">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold text-slate-900">Flight History</h3>
                            </div>
                            <MemberFlightHistoryTab memberId={memberId} />
                          </div>
                        </Tabs.Content>

                        <Tabs.Content value="training">
                          <MemberTrainingTab memberId={memberId} />
                        </Tabs.Content>
                      </div>
                    </Tabs.Root>
                  </CardContent>
                </Card>

                {/* Member History / Audit Log */}
                <MemberHistoryTab memberId={memberId} />
          </div>
        </div>
        {activeTab === "contact" && (
          <StickyFormActions
            formId="contact-details-form"
            isDirty={isContactDirty}
            isSaving={isContactSaving}
            onUndo={() => contactUndoRef.current?.()}
            message="You have unsaved contact details."
            saveLabel="Save Changes"
          />
        )}
        {activeTab === "pilot" && (
          <StickyFormActions
            formId="pilot-details-form"
            isDirty={isPilotDirty}
            isSaving={isPilotSaving}
            onUndo={() => pilotUndoRef.current?.()}
            message="You have unsaved pilot details."
            saveLabel="Save Changes"
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
