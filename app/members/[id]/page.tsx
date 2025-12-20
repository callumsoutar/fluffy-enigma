"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  IconArrowLeft,
  IconCalendar,
  IconUser,
  IconUsers,
  IconCreditCard,
  IconPlane,
  IconChartBar,
  IconClock,
  IconMail,
  IconChevronDown,
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
import type { MemberWithRelations } from "@/lib/types/members"
import { MemberPilotDetails } from "@/components/members/member-pilot-details"
import { MemberContactDetails } from "@/components/members/member-contact-details"
import { MemberMemberships } from "@/components/members/member-memberships"
import { MemberAccountTab } from "@/components/members/member-account-tab"
import { MemberFlightHistoryTab } from "@/components/members/member-flight-history-tab"

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

function getUserInitials(firstName: string | null, lastName: string | null, email: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase()
  }
  if (firstName) {
    return firstName.substring(0, 2).toUpperCase()
  }
  if (lastName) {
    return lastName.substring(0, 2).toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
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
  const [activeTab, setActiveTab] = React.useState("contact")
  const [underlineStyle, setUnderlineStyle] = React.useState({ left: 0, width: 0 })
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const [showScrollLeft, setShowScrollLeft] = React.useState(false)
  const [showScrollRight, setShowScrollRight] = React.useState(false)

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
    { id: "account", label: "Account", icon: IconCreditCard },
    { id: "flights", label: "Flight Management", icon: IconPlane },
    { id: "training", label: "Training", icon: IconChartBar },
    { id: "history", label: "History", icon: IconClock },
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
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || member.email
  const initials = getUserInitials(firstName, lastName, member.email)
  const isActive = member.is_active
  const membershipStartDate = member.membership?.start_date
    ? formatDate(member.membership.start_date)
    : null

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
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
                        <Badge
                          className={`rounded-md px-2 py-1 text-xs font-medium ${
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
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/bookings/new?member_id=${memberId}`)}>
                          <IconCalendar className="h-4 w-4 mr-2" />
                          Create Booking
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <IconUser className="h-4 w-4 mr-2" />
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <IconMail className="h-4 w-4 mr-2" />
                          Send Email
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      className="bg-gray-900 hover:bg-gray-800 text-white gap-2 font-semibold shadow-sm w-full sm:w-auto"
                      onClick={() => router.push(`/bookings/new?member_id=${memberId}`)}
                    >
                      <IconCalendar className="h-4 w-4" />
                      New Booking
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                        <Tabs.Content value="contact">
                          <MemberContactDetails memberId={memberId} member={member} />
                        </Tabs.Content>

                        <Tabs.Content value="pilot">
                          <MemberPilotDetails memberId={memberId} />
                        </Tabs.Content>

                        <Tabs.Content value="memberships">
                          <MemberMemberships memberId={memberId} />
                        </Tabs.Content>

                        <Tabs.Content value="account">
                          <MemberAccountTab memberId={memberId} member={member} />
                        </Tabs.Content>

                        <Tabs.Content value="flights">
                          <MemberFlightHistoryTab memberId={memberId} />
                        </Tabs.Content>

                        <Tabs.Content value="training">
                          <div>
                            <h2 className="text-lg font-semibold mb-4">Training</h2>
                            <p className="text-muted-foreground">Training information coming soon...</p>
                          </div>
                        </Tabs.Content>

                        <Tabs.Content value="history">
                          <div>
                            <h2 className="text-lg font-semibold mb-4">History</h2>
                            <p className="text-muted-foreground">History coming soon...</p>
                          </div>
                        </Tabs.Content>
                      </div>
                    </Tabs.Root>
                  </CardContent>
                </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
