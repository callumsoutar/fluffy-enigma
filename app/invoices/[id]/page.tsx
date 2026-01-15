"use client"

import React, { useEffect, useState, useRef } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import MemberSelect, { type UserResult } from "@/components/invoices/MemberSelect"
import InvoiceActionsToolbar from "@/components/invoices/InvoiceActionsToolbar"
import InvoiceLineItemAddRow from "@/components/invoices/InvoiceLineItemAddRow"
import type { Invoice, InvoiceWithRelations } from "@/lib/types/invoices"
import type { InvoiceItem, InvoiceItemWithRelations } from "@/lib/types/invoice_items"
import { format } from "date-fns"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar as CalendarIcon, Pencil, X, Check, Trash2, ChevronRight, CheckCircle2 } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import type { Chargeable } from '@/lib/types/database'
import { toast } from "sonner"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useOrganizationTaxRate } from "@/hooks/use-tax-rate"
import { InvoiceCalculations } from "@/lib/invoice-calculations"
import { roundToTwoDecimals } from "@/lib/invoice-calculations"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import InvoiceDocumentView, { type InvoicingSettings } from "@/components/invoices/InvoiceDocumentView"
import InvoiceViewActions from "@/components/invoices/InvoiceViewActions"

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const invoiceId = params.id as string
  const isNewInvoice = invoiceId === 'new' || !invoiceId

  const { taxRate: organizationTaxRate } = useOrganizationTaxRate()

  // State for edit mode
  const [invoice, setInvoice] = useState<InvoiceWithRelations | null>(null)
  const [items, setItems] = useState<InvoiceItemWithRelations[]>([])
  const [loading, setLoading] = useState(!isNewInvoice)
  const [itemsLoading, setItemsLoading] = useState(!isNewInvoice)
  const [error, setError] = useState<string | null>(null)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [reference, setReference] = useState("")
  const [invoiceDate, setInvoiceDate] = useState<Date | undefined>(isNewInvoice ? new Date() : undefined)
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined)
  const [selectedMember, setSelectedMember] = useState<UserResult | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const initialInvoiceRef = useRef<InvoiceWithRelations | null>(null)
  const initialItemsRef = useRef<InvoiceItemWithRelations[]>([])
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editRate, setEditRate] = useState<number>(0)
  const [editQuantity, setEditQuantity] = useState<number>(1)
  const [notes, setNotes] = useState("")
  const [approveLoading, setApproveLoading] = useState(false)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [invoiceSettings, setInvoiceSettings] = useState<InvoicingSettings>({
    schoolName: "Flight School",
    billingAddress: "",
    gstNumber: "",
    contactPhone: "",
    contactEmail: "",
    invoiceFooter: "Thank you for your business.",
    paymentTerms: "Payment terms: Net 30 days.",
  })

  // New state for draft mode
  const [draftInvoice, setDraftInvoice] = useState<Partial<Invoice>>({
    user_id: '',
    status: 'draft',
    issue_date: new Date().toISOString(),
    due_date: '',
    reference: '',
    notes: '',
    subtotal: 0,
    tax_total: 0,
    total_amount: 0,
    total_paid: 0,
    balance_due: 0
  })
  const [draftItems, setDraftItems] = useState<InvoiceItem[]>([])

  // Initialize due date for new invoices (default 7 days)
  useEffect(() => {
    if (!isNewInvoice) return
    
    const calculatedDueDate = new Date()
    calculatedDueDate.setDate(calculatedDueDate.getDate() + 7)
    setDueDate(calculatedDueDate)
    
    setDraftInvoice(prev => ({
      ...prev,
      due_date: calculatedDueDate.toISOString(),
    }))
  }, [isNewInvoice])

  // Fetch invoice if editing
  useEffect(() => {
    if (!invoiceId || isNewInvoice) return
    setLoading(true)
    fetch(`/api/invoices/${invoiceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.invoice) {
          setInvoice(data.invoice)
        } else {
          setInvoice(null)
        }
        setLoading(false)
      })
      .catch(() => {
        setError("Failed to load invoice")
        setLoading(false)
      })
  }, [invoiceId, isNewInvoice])

  // Fetch invoicing settings for invoice rendering (billing header + terms/footer)
  useEffect(() => {
    if (isNewInvoice) return
    fetch("/api/settings/invoicing")
      .then((res) => res.json())
      .then((data) => {
        if (data?.settings) setInvoiceSettings(data.settings)
      })
      .catch(() => {
        // Non-blocking: fall back to defaults
      })
  }, [isNewInvoice])

  const fetchItems = React.useCallback(() => {
    if (!invoiceId || isNewInvoice) return
    setItemsLoading(true)
    fetch(`/api/invoice_items?invoice_id=${invoiceId}`)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.invoice_items || [])
        setItemsLoading(false)
      })
      .catch(() => {
        setItemsError("Failed to load invoice items")
        setItemsLoading(false)
      })
  }, [invoiceId, isNewInvoice])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  useEffect(() => {
    if (invoice && invoice.user_id) {
      fetch(`/api/users?id=${invoice.user_id}`)
        .then(res => res.json())
        .then(data => {
          if (data.users && data.users.length > 0) {
            setSelectedMember(data.users[0])
          } else {
            setSelectedMember(null)
          }
        })
    } else {
      setSelectedMember(null)
    }
  }, [invoice])

  // Pre-populate user from URL search params for new invoices
  useEffect(() => {
    if (!isNewInvoice) return

    const userId = searchParams.get('user_id')
    if (!userId) return

    fetch(`/api/users?id=${userId}`)
      .then(res => res.json())
      .then(data => {
        if (data.users && data.users.length > 0) {
          setSelectedMember(data.users[0])
        }
      })
      .catch(err => {
        console.error('Failed to fetch user from URL parameter:', err)
      })
  }, [isNewInvoice, searchParams])

  useEffect(() => {
    if (invoice) {
      setReference(invoice.reference || "")
      setInvoiceDate(invoice.issue_date ? new Date(invoice.issue_date) : undefined)
      setDueDate(invoice.due_date ? new Date(invoice.due_date) : undefined)
      setNotes(invoice.notes || "")
    }
  }, [invoice])

  // Track initial invoice and items for dirty checking
  useEffect(() => {
    if (invoice) initialInvoiceRef.current = invoice
  }, [invoice])
  useEffect(() => {
    initialItemsRef.current = items
  }, [items])

  // Dirty check for invoice fields
  useEffect(() => {
    if (!invoice) {
      setDirty(false)
      return
    }
    const changed =
      reference !== (initialInvoiceRef.current?.reference || "") ||
      (invoiceDate && invoiceDate.toISOString().slice(0, 10) !== initialInvoiceRef.current?.issue_date?.slice(0, 10)) ||
      (dueDate && dueDate.toISOString().slice(0, 10) !== initialInvoiceRef.current?.due_date?.slice(0, 10)) ||
      (selectedMember && selectedMember.id !== initialInvoiceRef.current?.user_id) ||
      notes !== (initialInvoiceRef.current?.notes || "")
    setDirty(!!changed)
  }, [reference, invoiceDate, dueDate, selectedMember, notes, invoice])

  const handleAddItemWithUnitPrice = (item: Chargeable, quantity: number, unitPrice: number, taxRateOverride?: number) => {
    if (!invoiceId || isNewInvoice) return
    setAdding(true)
    const effectiveTaxRate = typeof taxRateOverride === "number"
      ? taxRateOverride
      : (item?.is_taxable ? (invoice?.tax_rate ?? organizationTaxRate) : 0)
    fetch("/api/invoice_items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice_id: invoiceId,
        chargeable_id: item.id,
        description: item.name,
        quantity,
        unit_price: unitPrice,
        tax_rate: effectiveTaxRate,
      }),
    })
      .then(res => res.json())
      .then(() => {
        setAdding(false)
        fetchItems()
      })
      .catch(() => {
        setAdding(false)
        toast.error('Failed to add item')
      })
  }

  // Save handler for all invoice fields
  const handleSave = async () => {
    if (!invoice) return
    setSaveLoading(true)
    try {
      const patch: Record<string, string | number | undefined> = {}
      if (reference !== (invoice.reference || "")) patch.reference = reference
      if (invoiceDate && invoiceDate.toISOString().slice(0, 10) !== invoice.issue_date?.slice(0, 10)) {
        patch.issue_date = invoiceDate.toISOString().slice(0, 10)
      }
      if (dueDate && dueDate.toISOString().slice(0, 10) !== invoice.due_date?.slice(0, 10)) {
        patch.due_date = dueDate.toISOString().slice(0, 10)
      }
      if (selectedMember && selectedMember.id !== invoice.user_id) patch.user_id = selectedMember.id
      if (notes !== (invoice.notes || "")) patch.notes = notes
      if (Object.keys(patch).length === 0) {
        setSaveLoading(false)
        setDirty(false)
        return
      }
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to save invoice')
        setSaveLoading(false)
        return
      }
      const data = await fetch(`/api/invoices/${invoice.id}`).then(r => r.json())
      if (data.invoice) {
        setInvoice(data.invoice)
      }
      toast.success('Invoice saved')
      setDirty(false)
    } catch {
      toast.error('Failed to save invoice')
    } finally {
      setSaveLoading(false)
    }
  }

  const startEditItem = (item: InvoiceItemWithRelations) => {
    setEditingItemId(item.id)
    setEditRate(item.rate_inclusive || item.unit_price)
    setEditQuantity(item.quantity)
  }

  const cancelEditItem = () => {
    setEditingItemId(null)
  }

  const saveEditItem = async (item: InvoiceItemWithRelations) => {
    setAdding(true)
    try {
      const taxRate = item.tax_rate || invoice?.tax_rate || organizationTaxRate
      const taxExclusiveUnitPrice = editRate / (1 + taxRate)
      
      const res = await fetch("/api/invoice_items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          unit_price: taxExclusiveUnitPrice,
          quantity: editQuantity,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to update item')
        return
      }
      toast.success('Item updated')
      setEditingItemId(null)
      fetchItems()
    } catch {
      toast.error('Failed to update item')
    } finally {
      setAdding(false)
    }
  }

  // Draft item editing functions for new invoice mode
  const startDraftItemEdit = (item: InvoiceItem) => {
    setEditingItemId(item.id)
    setEditRate(item.rate_inclusive || item.unit_price)
    setEditQuantity(item.quantity)
  }

  const saveDraftItemEdit = (item: InvoiceItem, idx: number) => {
    try {
      const taxExclusiveUnitPrice = editRate / (1 + organizationTaxRate)
      
      const calculatedAmounts = InvoiceCalculations.calculateItemAmounts({
        quantity: editQuantity,
        unit_price: taxExclusiveUnitPrice,
        tax_rate: organizationTaxRate
      })

      setDraftItems(prev => prev.map((draftItem, index) =>
        index === idx ? {
          ...draftItem,
          unit_price: taxExclusiveUnitPrice,
          quantity: editQuantity,
          rate_inclusive: calculatedAmounts.rate_inclusive,
          amount: calculatedAmounts.amount,
          tax_amount: calculatedAmounts.tax_amount,
          line_total: calculatedAmounts.line_total,
        } : draftItem
      ))

      setEditingItemId(null)
      toast.success('Item updated')
    } catch (error) {
      console.error('Failed to calculate item amounts:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update item calculations')
    }
  }

  const deleteDraftItem = (idx: number) => {
    setDraftItems(prev => prev.filter((_, index) => index !== idx))
    toast.success('Item deleted')
  }

  const handleApprove = async () => {
    if (!invoice) return
    setApproveLoading(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to approve invoice')
        setApproveLoading(false)
        return
      }
      const data = await fetch(`/api/invoices/${invoice.id}`).then(r => r.json())
      if (data.invoice) {
        setInvoice(data.invoice)
      }
      toast.success('Invoice approved')
      router.push(`/invoices/${invoice.id}`)
    } catch {
      toast.error('Failed to approve invoice')
    } finally {
      setApproveLoading(false)
    }
  }

  const deleteItem = async (itemId: string) => {
    setDeletingItemId(itemId)
    try {
      const res = await fetch('/api/invoice_items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to delete item')
      } else {
        toast.success('Item deleted')
        fetchItems()
      }
    } catch {
      toast.error('Failed to delete item')
    } finally {
      setDeletingItemId(null)
    }
  }

  const handleDeleteInvoice = async () => {
    if (!invoice) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to delete invoice")
        setDeleting(false)
        return
      }
      toast.success("Invoice deleted")
      setDeleteDialogOpen(false)
      router.push("/invoices")
    } catch {
      toast.error("Failed to delete invoice")
      setDeleting(false)
    }
  }

  // New methods for draft invoice creation
  const createInvoiceWithItems = async () => {
    if (!selectedMember) {
      toast.error('Please select a member')
      return
    }
    
    if (draftItems.length === 0) {
      toast.error('Please add at least one item')
      return
    }
    
    setSaveLoading(true)
    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedMember.id,
          status: 'draft',
          reference: draftInvoice.reference,
          issue_date: draftInvoice.issue_date,
          due_date: draftInvoice.due_date,
          notes: draftInvoice.notes,
          items: draftItems.map(item => ({
            chargeable_id: item.chargeable_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate
          }))
        })
      })
      
      const result = await response.json()
      if (result.id) {
        toast.success('Invoice created successfully')
        router.replace(`/invoices/${result.id}`)
      } else {
        throw new Error(result.error || 'Failed to create invoice')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create invoice')
    } finally {
      setSaveLoading(false)
    }
  }

  const approveInvoice = async () => {
    if (!selectedMember) {
      toast.error('Please select a member')
      return
    }
    
    if (draftItems.length === 0) {
      toast.error('Please add at least one item')
      return
    }
    
    setApproveLoading(true)
    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedMember.id,
          status: 'pending',
          reference: draftInvoice.reference,
          issue_date: draftInvoice.issue_date,
          due_date: draftInvoice.due_date,
          notes: draftInvoice.notes,
          items: draftItems.map(item => ({
            chargeable_id: item.chargeable_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate
          }))
        })
      })
      
      const result = await response.json()
      if (result.id) {
        toast.success('Invoice approved')
        router.replace(`/invoices/${result.id}`)
      } else {
        throw new Error(result.error || 'Failed to approve invoice')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve invoice')
    } finally {
      setApproveLoading(false)
    }
  }

  // Update draft state when form fields change
  useEffect(() => {
    if (isNewInvoice) {
      setDraftInvoice(prev => ({
        ...prev,
        reference: reference,
        issue_date: invoiceDate?.toISOString(),
        due_date: dueDate?.toISOString(),
        notes: notes,
        user_id: selectedMember?.id || ''
      }))
    }
  }, [reference, invoiceDate, dueDate, notes, selectedMember, isNewInvoice])

  // Calculate totals for draft items
  const getDraftTotals = () => {
    try {
      return InvoiceCalculations.calculateInvoiceTotals(draftItems)
    } catch (error) {
      console.error('Failed to calculate draft totals:', error)
      return {
        subtotal: 0,
        tax_total: 0,
        total_amount: 0
      }
    }
  }

  const { subtotal: draftSubtotal, tax_total: draftTotalTax, total_amount: draftTotal } = getDraftTotals()

  const isReadOnly = invoice?.status ? invoice.status !== "draft" : false

  if (loading) return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col bg-muted/20">
          <div className="mx-auto w-full max-w-[920px] px-4 sm:px-6 lg:px-10 py-10">
            <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground shadow-sm ring-1 ring-border/40">
              Loading invoice...
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
  
  // Show different UI based on mode
  if (isNewInvoice) {
    return (
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col bg-muted/20">
          <div className="mx-auto w-full max-w-[920px] px-4 sm:px-6 lg:px-10 py-4 lg:py-8">
            <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 py-2.5 sm:py-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b shadow-sm">
                <InvoiceActionsToolbar
                  mode="new"
                  onSave={createInvoiceWithItems}
                  onApprove={approveInvoice}
                  saveDisabled={!selectedMember || draftItems.length === 0}
                  approveDisabled={!selectedMember || draftItems.length === 0}
                  saveLoading={saveLoading}
                  approveLoading={approveLoading}
                  showApprove={true}
                />
              </div>

              <div className="mt-6 space-y-6">
                  <Card className="shadow-sm ring-1 ring-border/40">
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-6">
                        <div>
                          <div className="text-sm font-medium text-foreground/80">Invoice</div>
                          <div className="mt-1 text-2xl font-semibold tracking-tight">New invoice</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Create a draft invoice, add line items, then approve when ready.
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 space-y-4">
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-foreground/80">Bill to</label>
                            <MemberSelect value={selectedMember} onSelect={setSelectedMember} />
                          </div>

                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-foreground/80">Reference</label>
                            <Input
                              placeholder="e.g. PO-1234, Training block, etc."
                              value={reference}
                              onChange={e => setReference(e.target.value)}
                              className="w-full bg-background"
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-foreground/80">Invoice date</label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-start text-left font-normal bg-background"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                  {invoiceDate ? format(invoiceDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="p-0">
                                <Calendar
                                  mode="single"
                                  selected={invoiceDate}
                                  onSelect={setInvoiceDate}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-foreground/80">Due date</label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-start text-left font-normal bg-background"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                  {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="p-0">
                                <Calendar
                                  mode="single"
                                  selected={dueDate}
                                  onSelect={setDueDate}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card className="shadow-sm ring-1 ring-border/40">
                    <div className="p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-base font-semibold">Line items</div>
                        </div>
                      </div>

                      <div className="mt-4 overflow-hidden rounded-xl border bg-background">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableHead className="w-[52%] text-xs font-medium text-muted-foreground">Item</TableHead>
                              <TableHead className="w-[84px] text-right text-xs font-medium text-muted-foreground">Qty</TableHead>
                              <TableHead className="w-[120px] text-right text-xs font-medium text-muted-foreground">Rate</TableHead>
                              <TableHead className="w-[160px] text-right text-xs font-medium text-muted-foreground">Tax</TableHead>
                              <TableHead className="w-[140px] text-right text-xs font-medium text-muted-foreground">Amount</TableHead>
                              <TableHead className="w-[92px] text-right text-xs font-medium text-muted-foreground"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {draftItems.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                                  No line items yet.
                                </TableCell>
                              </TableRow>
                            ) : (
                              draftItems.map((item, idx) => (
                                <TableRow key={item.id + idx} className="hover:bg-muted/20">
                                  <TableCell className="whitespace-normal py-3">
                                    <div className="font-medium">{item.description}</div>
                                  </TableCell>
                                  <TableCell className="py-3 text-right tabular-nums">
                                    {editingItemId === item.id ? (
                                      <Input
                                        type="number"
                                        inputMode="numeric"
                                        className="h-9 w-[84px] text-right tabular-nums"
                                        value={editQuantity}
                                        min={1}
                                        step={1}
                                        onChange={e => setEditQuantity(Number(e.target.value))}
                                      />
                                    ) : (
                                      <span>{item.quantity}</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-3 text-right tabular-nums">
                                    {editingItemId === item.id ? (
                                      <Input
                                        type="number"
                                        inputMode="decimal"
                                        className="h-9 w-[120px] text-right tabular-nums"
                                        value={editRate}
                                        min={0}
                                        step={0.01}
                                        onChange={e => setEditRate(Number(e.target.value))}
                                      />
                                    ) : (
                                      <span>${(item.rate_inclusive || item.unit_price || 0).toFixed(2)}</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-3 text-right tabular-nums">
                                    ${(item.tax_amount || 0).toFixed(2)}
                                  </TableCell>
                                  <TableCell className="py-3 text-right font-semibold tabular-nums">
                                    ${(item.line_total || 0).toFixed(2)}
                                  </TableCell>
                                  <TableCell className="py-3 text-right">
                                    <div className="group inline-flex items-center justify-end gap-1">
                                      {editingItemId === item.id ? (
                                        <>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-green-700 hover:bg-green-500/10"
                                            onClick={() => saveDraftItemEdit(item, idx)}
                                            disabled={adding}
                                            aria-label="Save item"
                                          >
                                            <Check className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground"
                                            onClick={cancelEditItem}
                                            aria-label="Cancel edit"
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </>
                                      ) : (
                                        <>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground opacity-60 hover:opacity-100 hover:text-foreground hover:bg-muted/40 group-hover:opacity-100"
                                            onClick={() => startDraftItemEdit(item)}
                                            aria-label="Edit item"
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-600 opacity-60 hover:opacity-100 hover:bg-red-500/10 group-hover:opacity-100"
                                            onClick={() => deleteDraftItem(idx)}
                                            aria-label="Delete item"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}

                            <InvoiceLineItemAddRow
                              disabled={adding}
                              taxRate={organizationTaxRate}
                              layout="table-row"
                              onAdd={(item) => {
                                try {
                                  // Fetch the chargeable to get its tax status if needed, 
                                  // but for now we'll assume the taxRate passed in is correct for taxable items
                                  // In a real app, you might want to fetch more details here.
                                  
                                  const calculatedAmounts = InvoiceCalculations.calculateItemAmounts({
                                    quantity: item.quantity,
                                    unit_price: item.unit_price,
                                    tax_rate: organizationTaxRate, // Simplified: using org tax rate
                                  })

                                  setDraftItems((prev) => [
                                    ...prev,
                                    {
                                      id: item.chargeable_id + "-" + Date.now(),
                                      invoice_id: "",
                                      chargeable_id: item.chargeable_id,
                                      description: item.description,
                                      quantity: item.quantity,
                                      unit_price: item.unit_price,
                                      rate_inclusive: calculatedAmounts.rate_inclusive,
                                      amount: calculatedAmounts.amount,
                                      tax_rate: organizationTaxRate,
                                      tax_amount: calculatedAmounts.tax_amount,
                                      line_total: calculatedAmounts.line_total,
                                      notes: null,
                                      created_at: "",
                                      updated_at: "",
                                      deleted_at: null,
                                      deleted_by: null,
                                    },
                                  ])
                                  toast.success("Item added")
                                } catch (error) {
                                  console.error("Failed to calculate item amounts:", error)
                                  toast.error(error instanceof Error ? error.message : "Failed to add item")
                                }
                              }}
                            />
                          </TableBody>
                        </Table>
                      </div>

                      <div className="mt-6 flex justify-end">
                        <div className="w-full max-w-sm space-y-2.5 text-sm">
                          <div className="flex items-center justify-between gap-8">
                            <div className="text-muted-foreground">Subtotal (excl. Tax):</div>
                            <div className="font-medium tabular-nums">${draftSubtotal.toFixed(2)}</div>
                          </div>
                          <div className="flex items-center justify-between gap-8">
                            <div className="text-muted-foreground">Tax:</div>
                            <div className="font-medium tabular-nums">${draftTotalTax.toFixed(2)}</div>
                          </div>
                          <div className="border-t pt-2.5 flex items-center justify-between gap-8">
                            <div className="text-base font-semibold">Total:</div>
                            <div className="text-lg font-semibold tabular-nums text-primary">${draftTotal.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card className="shadow-sm ring-1 ring-border/40">
                    <div className="p-6">
                      <Collapsible defaultOpen={false} className="w-full">
                        <CollapsibleTrigger className="group flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition w-full">
                          <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                          <span>{notes ? "Edit notes" : "Add notes"}</span>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                          <textarea
                            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-vertical transition placeholder:text-muted-foreground"
                            placeholder="Add notes for this invoice..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                          />
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </Card>

              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  // Error handling for edit mode
  if (error || !invoice) return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col bg-muted/20">
          <div className="mx-auto w-full max-w-[920px] px-4 sm:px-6 lg:px-10 py-10">
            <div className="rounded-xl border bg-card p-10 text-center text-destructive shadow-sm ring-1 ring-border/40">
              Invoice not found.
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )

  // Existing edit mode UI
  const subtotal = roundToTwoDecimals(items.reduce((sum, item) => sum + (item.amount || 0), 0))
  const totalTax = roundToTwoDecimals(items.reduce((sum, item) => sum + (item.tax_amount || 0), 0))
  const total = roundToTwoDecimals(items.reduce((sum, item) => sum + (item.line_total || 0), 0))

  const billToName =
    (selectedMember
      ? `${selectedMember.first_name || ""} ${selectedMember.last_name || ""}`.trim() || selectedMember.email
      : (invoice.user
          ? `${invoice.user.first_name || ""} ${invoice.user.last_name || ""}`.trim() || invoice.user.email
          : invoice.user_id)
    ) || invoice.user_id

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col bg-muted/20">
          <div className="mx-auto w-full max-w-[920px] px-4 sm:px-6 lg:px-10 py-4 lg:py-8">
            <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 py-2.5 sm:py-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b shadow-sm">
              <InvoiceActionsToolbar
                mode={isReadOnly ? 'view' : 'edit'}
                invoiceId={invoice.id}
                invoiceNumber={invoice.invoice_number}
                status={invoice.status}
                rightSlot={
                  isReadOnly ? (
                    <InvoiceViewActions
                      invoiceId={invoice.id}
                      billToEmail={invoice.user?.email || selectedMember?.email || null}
                      status={invoice.status}
                      settings={invoiceSettings}
                      bookingId={invoice.booking_id}
                      invoice={{
                        invoiceNumber: invoice.invoice_number || `#${invoice.id.slice(0, 8)}`,
                        issueDate: invoice.issue_date,
                        dueDate: invoice.due_date,
                        taxRate: invoice.tax_rate ?? organizationTaxRate,
                        subtotal: invoice.subtotal ?? subtotal,
                        taxTotal: invoice.tax_total ?? totalTax,
                        totalAmount: invoice.total_amount ?? total,
                        totalPaid: invoice.total_paid ?? 0,
                        balanceDue:
                          invoice.balance_due ??
                          Math.max(0, (invoice.total_amount ?? total) - (invoice.total_paid ?? 0)),
                        billToName,
                      }}
                      items={items.map((i) => ({
                        id: i.id,
                        description: i.description,
                        quantity: i.quantity,
                        unit_price: i.unit_price,
                        rate_inclusive: i.rate_inclusive,
                        line_total: i.line_total,
                      }))}
                    />
                  ) : null
                }
                onSave={handleSave}
                onApprove={handleApprove}
                onDelete={() => setDeleteDialogOpen(true)}
                saveDisabled={!dirty || isReadOnly}
                approveDisabled={isReadOnly}
                saveLoading={saveLoading}
                approveLoading={approveLoading}
                showApprove={invoice.status === 'draft'}
                bookingId={invoice.booking_id}
              />
            </div>

            <div className="mt-6 space-y-6">
              {isReadOnly ? (
                <InvoiceDocumentView
                  settings={invoiceSettings}
                  invoice={{
                    invoiceNumber: invoice.invoice_number || `#${invoice.id.slice(0, 8)}`,
                    issueDate: invoice.issue_date,
                    dueDate: invoice.due_date,
                    taxRate: invoice.tax_rate ?? organizationTaxRate,
                    subtotal: invoice.subtotal ?? subtotal,
                    taxTotal: invoice.tax_total ?? totalTax,
                    totalAmount: invoice.total_amount ?? total,
                    totalPaid: invoice.total_paid ?? 0,
                    balanceDue:
                      invoice.balance_due ??
                      Math.max(0, (invoice.total_amount ?? total) - (invoice.total_paid ?? 0)),
                    billToName,
                  }}
                  items={items.map((i) => ({
                    id: i.id,
                    description: i.description,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    rate_inclusive: i.rate_inclusive,
                    line_total: i.line_total,
                  }))}
                />
              ) : (
                <>
              <Card className="shadow-sm ring-1 ring-border/40">
                <div className="p-6">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <div className="text-sm font-medium text-foreground/80">Invoice</div>
                      <div className="mt-1 text-2xl font-semibold tracking-tight">
                        {invoice.invoice_number || `#${invoice.id.slice(0, 8)}`}
                      </div>
                      {dirty && !isReadOnly && (
                        <div className="mt-1 text-sm text-muted-foreground">You have unsaved changes.</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {invoice?.status && (
                        invoice.status === 'paid' ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-semibold text-green-700 uppercase tracking-wide">Paid</span>
                          </div>
                        ) : (
                          <Badge
                            className="large"
                            variant={(() => {
                              switch (invoice.status) {
                                case 'draft': return 'secondary'
                                case 'pending': return 'secondary'
                                case 'overdue': return 'destructive'
                                case 'cancelled': return 'outline'
                                case 'refunded': return 'outline'
                                default: return 'outline'
                              }
                            })()}
                          >
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground/80">Bill to</label>
                        <MemberSelect
                          value={selectedMember}
                          onSelect={setSelectedMember}
                          disabled={isReadOnly}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground/80">Reference</label>
                        <Input
                          placeholder="e.g. PO-1234, Training block, etc."
                          value={reference}
                          onChange={e => setReference(e.target.value)}
                          disabled={isReadOnly}
                          className="w-full bg-background"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground/80">Invoice date</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              disabled={isReadOnly}
                              className="w-full justify-start text-left font-normal bg-background"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                              {invoiceDate ? format(invoiceDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="p-0">
                            <Calendar
                              mode="single"
                              selected={invoiceDate}
                              onSelect={setInvoiceDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground/80">Due date</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              disabled={isReadOnly}
                              className="w-full justify-start text-left font-normal bg-background"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                              {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="p-0">
                            <Calendar
                              mode="single"
                              selected={dueDate}
                              onSelect={setDueDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="shadow-sm ring-1 ring-border/40">
                <div className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold">Line items</div>
                    </div>
                    {itemsLoading && (
                      <div className="text-sm text-muted-foreground">Loading…</div>
                    )}
                  </div>

                  <div className="mt-4 overflow-hidden rounded-xl border bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="w-[52%] text-xs font-medium text-muted-foreground">Item</TableHead>
                          <TableHead className="w-[84px] text-right text-xs font-medium text-muted-foreground">Qty</TableHead>
                          <TableHead className="w-[120px] text-right text-xs font-medium text-muted-foreground">Rate</TableHead>
                          <TableHead className="w-[160px] text-right text-xs font-medium text-muted-foreground">Tax</TableHead>
                          <TableHead className="w-[140px] text-right text-xs font-medium text-muted-foreground">Amount</TableHead>
                          <TableHead className="w-[92px] text-right text-xs font-medium text-muted-foreground"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemsError ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-10 text-center text-sm text-destructive">
                              {itemsError}
                            </TableCell>
                          </TableRow>
                        ) : items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                              No items yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          items.map((item: InvoiceItemWithRelations, idx: number) => (
                            <TableRow key={item.id + idx} className="hover:bg-muted/20">
                              <TableCell className="whitespace-normal py-3">
                                <div className="font-medium">{item.description}</div>
                              </TableCell>
                              <TableCell className="py-3 text-right tabular-nums">
                                {editingItemId === item.id && !isReadOnly ? (
                                  <Input
                                    type="number"
                                    inputMode="numeric"
                                    className="h-9 w-[84px] text-right tabular-nums"
                                    value={editQuantity}
                                    min={1}
                                    step={1}
                                    onChange={e => setEditQuantity(Number(e.target.value))}
                                  />
                                ) : (
                                  <span>{item.quantity}</span>
                                )}
                              </TableCell>
                              <TableCell className="py-3 text-right tabular-nums">
                                {editingItemId === item.id && !isReadOnly ? (
                                  <Input
                                    type="number"
                                    inputMode="decimal"
                                    className="h-9 w-[120px] text-right tabular-nums"
                                    value={editRate}
                                    min={0}
                                    step={0.01}
                                    onChange={e => setEditRate(Number(e.target.value))}
                                  />
                                ) : (
                                  <span>${(item.rate_inclusive || item.unit_price || 0).toFixed(2)}</span>
                                )}
                              </TableCell>
                              <TableCell className="py-3 text-right tabular-nums">
                                ${(item.tax_amount || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="py-3 text-right font-semibold tabular-nums">
                                ${(item.line_total || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="py-3 text-right">
                                <div className="group inline-flex items-center justify-end gap-1">
                                  {editingItemId === item.id && !isReadOnly ? (
                                    <>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-green-700 hover:bg-green-500/10"
                                        onClick={() => saveEditItem(item)}
                                        disabled={adding}
                                        aria-label="Save item"
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground"
                                        onClick={cancelEditItem}
                                        aria-label="Cancel edit"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : !isReadOnly ? (
                                    <>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground opacity-60 hover:opacity-100 hover:text-foreground hover:bg-muted/40 group-hover:opacity-100"
                                        onClick={() => startEditItem(item)}
                                        aria-label="Edit item"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-red-600 opacity-60 hover:opacity-100 hover:bg-red-500/10 group-hover:opacity-100"
                                        onClick={() => deleteItem(item.id)}
                                        disabled={deletingItemId === item.id}
                                        aria-label="Delete item"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : null}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}

                        {!isReadOnly && !itemsError && (
                          <InvoiceLineItemAddRow
                            disabled={adding}
                            layout="table-row"
                            taxRate={invoice.tax_rate ?? organizationTaxRate}
                            onAdd={(item) => {
                              handleAddItemWithUnitPrice(item.chargeable, item.quantity, item.unit_price, invoice.tax_rate ?? organizationTaxRate)
                              toast.success("Item added")
                            }}
                          />
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {adding && <div className="pt-4 text-sm text-muted-foreground">Updating…</div>}

                  <div className="mt-6 flex justify-end">
                    <div className="w-full max-w-sm space-y-2.5 text-sm">
                      <div className="flex items-center justify-between gap-8">
                        <div className="text-muted-foreground">Subtotal (excl. Tax):</div>
                        <div className="font-medium tabular-nums">${subtotal.toFixed(2)}</div>
                      </div>
                      <div className="flex items-center justify-between gap-8">
                        <div className="text-muted-foreground">Tax:</div>
                        <div className="font-medium tabular-nums">${totalTax.toFixed(2)}</div>
                      </div>
                      <div className="border-t pt-2.5 flex items-center justify-between gap-8">
                        <div className="text-base font-semibold">Total:</div>
                        <div className="text-lg font-semibold tabular-nums text-primary">${total.toFixed(2)}</div>
                      </div>
                      {typeof invoice.total_paid === "number" && typeof invoice.balance_due === "number" && (
                        <>
                          <div className="pt-2 flex items-center justify-between gap-8">
                            <div className="text-muted-foreground">Paid:</div>
                            <div className="font-medium tabular-nums">${invoice.total_paid.toFixed(2)}</div>
                          </div>
                          <div className="flex items-center justify-between gap-8">
                            <div className="text-muted-foreground">Balance due:</div>
                            <div className="font-semibold tabular-nums">${invoice.balance_due.toFixed(2)}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
                </>
              )}

              <Card className="shadow-sm ring-1 ring-border/40">
                <div className="p-6">
                  <div className="text-base font-semibold">Notes</div>
                  <div className="mt-1 text-sm text-muted-foreground">Optional internal notes for this invoice.</div>

                  <Collapsible defaultOpen={false} className="w-full mt-4">
                    <CollapsibleTrigger className="group flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition w-full">
                      <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      <span>{notes ? "Edit notes" : "Add notes"}</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <textarea
                        className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-vertical transition placeholder:text-muted-foreground"
                        placeholder="Add notes for this invoice..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        disabled={isReadOnly}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </Card>
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Invoice</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this invoice? It cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteInvoice}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Yes, Delete"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
