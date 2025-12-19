"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { InvoicesTable } from "@/components/invoices/invoices-table"
import type { InvoiceWithRelations, InvoicesFilter, InvoiceStatus } from "@/lib/types/invoices"

// Fetch invoices from API
async function fetchInvoices(filters?: InvoicesFilter): Promise<InvoiceWithRelations[]> {
  const params = new URLSearchParams()
  
  if (filters?.status) {
    params.append('status', filters.status.join(','))
  }
  if (filters?.user_id) {
    params.append('user_id', filters.user_id)
  }
  if (filters?.search) {
    params.append('search', filters.search)
  }
  if (filters?.start_date) {
    params.append('start_date', filters.start_date)
  }
  if (filters?.end_date) {
    params.append('end_date', filters.end_date)
  }

  const response = await fetch(`/api/invoices?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch invoices')
  }
  const data = await response.json()
  return data.invoices
}

export default function InvoicesPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState("all")
  const [mounted, setMounted] = React.useState(false)
  const [filters, setFilters] = React.useState<InvoicesFilter>({})

  // Prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Build filters based on active tab and user filters
  const queryFilters = React.useMemo(() => {
    const baseFilters: InvoicesFilter = { ...filters }

    // If there's a search query, search across all invoices (ignore tab filters)
    // Otherwise, apply tab-specific filters
    if (!filters.search) {
      switch (activeTab) {
        case "draft":
          baseFilters.status = ["draft"]
          break
        case "pending":
          baseFilters.status = ["pending"]
          break
        case "paid":
          baseFilters.status = ["paid"]
          break
        case "overdue":
          baseFilters.status = ["overdue"]
          break
        case "all":
          // No filters for "all" tab
          break
      }
    }

    return baseFilters
  }, [activeTab, filters])

  const {
    data: allInvoices = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["invoices", queryFilters],
    queryFn: () => fetchInvoices(queryFilters),
    staleTime: 30_000,
  })

  // Calculate tab counts
  const countsFilters: InvoicesFilter = filters.search ? { search: filters.search } : {}
  const {
    data: allInvoicesForCounts = [],
  } = useQuery({
    queryKey: ["invoices", "counts", countsFilters],
    queryFn: () => fetchInvoices(countsFilters),
    staleTime: 30_000,
  })

  const tabCounts = React.useMemo(() => {
    if (!mounted || isLoading) {
      return { all: 0, draft: 0, pending: 0, paid: 0, overdue: 0 }
    }

    return {
      all: allInvoicesForCounts.length,
      draft: allInvoicesForCounts.filter((inv) => inv.status === "draft").length,
      pending: allInvoicesForCounts.filter((inv) => inv.status === "pending").length,
      paid: allInvoicesForCounts.filter((inv) => inv.status === "paid").length,
      overdue: allInvoicesForCounts.filter((inv) => inv.status === "overdue").length,
    }
  }, [allInvoicesForCounts, isLoading, mounted])

  // Filter invoices based on active tab
  const filteredInvoices = React.useMemo(() => {
    if (isLoading || !mounted) return []
    return allInvoices
  }, [allInvoices, isLoading, mounted])

  // Handle filter changes from table component
  const handleFiltersChange = React.useCallback((tableFilters: {
    search?: string
    status?: InvoiceStatus[]
  }) => {
    setFilters((prev) => {
      const newFilters: InvoicesFilter = { ...prev }
      
      // Update search
      if (tableFilters.search) {
        newFilters.search = tableFilters.search
      } else {
        delete newFilters.search
      }
      
      // Handle status filter based on whether we're searching
      if (tableFilters.search) {
        // When searching, allow status filter to work independently of tabs
        if (tableFilters.status) {
          newFilters.status = tableFilters.status
        } else {
          delete newFilters.status
        }
      } else {
        // When not searching, respect tab filters
        if (!["draft", "pending", "paid", "overdue"].includes(activeTab) && tableFilters.status) {
          newFilters.status = tableFilters.status
        } else if (["draft", "pending", "paid", "overdue"].includes(activeTab)) {
          // Clear status filter when in a tab that sets it
          delete newFilters.status
        }
      }
      
      return newFilters
    })
  }, [activeTab])

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
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
                      <p className="text-muted-foreground">
                        View and manage all invoices
                      </p>
                    </div>
                    <Button
                      onClick={() => router.push('/invoices/new')}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      New Invoice
                    </Button>
                  </div>

                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                      <TabsTrigger value="all">
                        All ({tabCounts.all})
                      </TabsTrigger>
                      <TabsTrigger value="draft">
                        Draft ({tabCounts.draft})
                      </TabsTrigger>
                      <TabsTrigger value="pending">
                        Pending ({tabCounts.pending})
                      </TabsTrigger>
                      <TabsTrigger value="paid">
                        Paid ({tabCounts.paid})
                      </TabsTrigger>
                      <TabsTrigger value="overdue">
                        Overdue ({tabCounts.overdue})
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="all" className="mt-4">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-muted-foreground">Loading invoices...</div>
                        </div>
                      ) : isError ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-muted-foreground">Failed to load invoices.</div>
                        </div>
                      ) : (
                        <InvoicesTable
                          invoices={filteredInvoices}
                          onFiltersChange={handleFiltersChange}
                        />
                      )}
                    </TabsContent>
                    <TabsContent value="draft" className="mt-4">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-muted-foreground">Loading invoices...</div>
                        </div>
                      ) : isError ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-muted-foreground">Failed to load invoices.</div>
                        </div>
                      ) : (
                        <InvoicesTable
                          invoices={filteredInvoices}
                          onFiltersChange={handleFiltersChange}
                        />
                      )}
                    </TabsContent>
                    <TabsContent value="pending" className="mt-4">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-muted-foreground">Loading invoices...</div>
                        </div>
                      ) : isError ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-muted-foreground">Failed to load invoices.</div>
                        </div>
                      ) : (
                        <InvoicesTable
                          invoices={filteredInvoices}
                          onFiltersChange={handleFiltersChange}
                        />
                      )}
                    </TabsContent>
                    <TabsContent value="paid" className="mt-4">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-muted-foreground">Loading invoices...</div>
                        </div>
                      ) : isError ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-muted-foreground">Failed to load invoices.</div>
                        </div>
                      ) : (
                        <InvoicesTable
                          invoices={filteredInvoices}
                          onFiltersChange={handleFiltersChange}
                        />
                      )}
                    </TabsContent>
                    <TabsContent value="overdue" className="mt-4">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-muted-foreground">Loading invoices...</div>
                        </div>
                      ) : isError ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-muted-foreground">Failed to load invoices.</div>
                        </div>
                      ) : (
                        <InvoicesTable
                          invoices={filteredInvoices}
                          onFiltersChange={handleFiltersChange}
                        />
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
