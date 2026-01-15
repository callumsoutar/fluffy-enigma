"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Save, CheckCircle2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import type { InvoiceStatus } from "@/lib/types/invoices"

interface InvoiceActionsToolbarProps {
  mode: 'new' | 'edit' | 'view'
  invoiceId?: string
  invoiceNumber?: string | null
  status?: InvoiceStatus
  rightSlot?: React.ReactNode
  onSave?: () => void
  onApprove?: () => void
  onDelete?: () => void
  saveDisabled?: boolean
  approveDisabled?: boolean
  saveLoading?: boolean
  approveLoading?: boolean
  showApprove?: boolean
  bookingId?: string | null
}

export default function InvoiceActionsToolbar({
  mode,
  invoiceId: _invoiceId,
  invoiceNumber,
  status,
  rightSlot,
  onSave,
  onApprove,
  onDelete,
  saveDisabled = false,
  approveDisabled = false,
  saveLoading = false,
  approveLoading = false,
  showApprove = false,
}: InvoiceActionsToolbarProps) {
  const router = useRouter()
  const displayInvoiceNumber =
    invoiceNumber || (_invoiceId ? `#${_invoiceId.slice(0, 8)}` : null)

  const getStatusBadgeVariant = (status?: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return 'default'
      case 'pending':
        return 'secondary'
      case 'overdue':
        return 'destructive'
      case 'draft':
        return 'outline'
      case 'cancelled':
      case 'refunded':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getStatusLabel = (status?: InvoiceStatus) => {
    if (!status) return 'Draft'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const isReadOnly = mode === 'view' || (status && status !== 'draft')

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 sm:gap-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3 sm:gap-2 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        <div className="h-8 w-px bg-border shrink-0 hidden sm:block" />

        {displayInvoiceNumber && (
          <div className="flex items-center gap-3">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground leading-none mb-1">
                Invoice
              </span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-xl tracking-tight truncate leading-none">
                  {displayInvoiceNumber}
                </span>
                {status && (
                  <Badge
                    variant={getStatusBadgeVariant(status)}
                    className="px-1.5 py-0 h-4.5 text-[9px] font-bold uppercase tracking-wider rounded sm:hidden shrink-0"
                  >
                    {getStatusLabel(status)}
                  </Badge>
                )}
              </div>
            </div>
            {status && (
              <Badge
                variant={getStatusBadgeVariant(status)}
                className="hidden sm:inline-flex px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md shrink-0"
              >
                {getStatusLabel(status)}
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar justify-end">
        <div className="flex items-center gap-2 shrink-0">
          {rightSlot}

          {mode === 'new' && (
            <>
              {onSave && (
                <Button
                  type="button"
                  size="sm"
                  onClick={onSave}
                  disabled={saveDisabled || saveLoading}
                  variant="outline"
                  className="h-8 sm:h-9"
                >
                  {saveLoading ? 'Saving...' : 'Save Draft'}
                </Button>
              )}
              {showApprove && onApprove && (
                <Button
                  type="button"
                  size="sm"
                  onClick={onApprove}
                  disabled={approveDisabled || approveLoading}
                  className="h-8 sm:h-9 gap-1.5"
                >
                  {approveLoading ? 'Approving...' : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </>
                  )}
                </Button>
              )}
            </>
          )}

          {mode === 'edit' && !isReadOnly && (
            <>
              {onSave && (
                <Button
                  type="button"
                  size="sm"
                  onClick={onSave}
                  disabled={saveDisabled || saveLoading}
                  variant="outline"
                  className="h-8 sm:h-9 gap-1.5"
                >
                  {saveLoading ? 'Saving...' : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </>
                  )}
                </Button>
              )}
              {showApprove && onApprove && (
                <Button
                  type="button"
                  size="sm"
                  onClick={onApprove}
                  disabled={approveDisabled || approveLoading}
                  className="h-8 sm:h-9 gap-1.5"
                >
                  {approveLoading ? 'Approving...' : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </>
                  )}
                </Button>
              )}
              {onDelete && (
                <Button
                  type="button"
                  size="sm"
                  onClick={onDelete}
                  variant="destructive"
                  className="h-8 sm:h-9 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Delete</span>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
