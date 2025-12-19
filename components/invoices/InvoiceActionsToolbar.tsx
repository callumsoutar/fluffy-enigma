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
  bookingId,
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
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {displayInvoiceNumber && (
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Invoice</span>
            <span className="font-semibold text-lg">{displayInvoiceNumber}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {status && (
          <Badge
            variant={getStatusBadgeVariant(status)}
            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-md"
          >
            {getStatusLabel(status)}
          </Badge>
        )}
        {rightSlot}

        {mode === 'new' && (
          <>
            {onSave && (
              <Button
                type="button"
                onClick={onSave}
                disabled={saveDisabled || saveLoading}
                variant="outline"
              >
                {saveLoading ? 'Saving...' : 'Save Draft'}
              </Button>
            )}
            {showApprove && onApprove && (
              <Button
                type="button"
                onClick={onApprove}
                disabled={approveDisabled || approveLoading}
                className="gap-2"
              >
                {approveLoading ? 'Approving...' : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
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
                onClick={onSave}
                disabled={saveDisabled || saveLoading}
                variant="outline"
                className="gap-2"
              >
                {saveLoading ? 'Saving...' : (
                  <>
                    <Save className="h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            )}
            {showApprove && onApprove && (
              <Button
                type="button"
                onClick={onApprove}
                disabled={approveDisabled || approveLoading}
                className="gap-2"
              >
                {approveLoading ? 'Approving...' : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </>
                )}
              </Button>
            )}
            {onDelete && (
              <Button
                type="button"
                onClick={onDelete}
                variant="destructive"
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </>
        )}

        {bookingId && (
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/bookings/${bookingId}`)}
          >
            View Booking
          </Button>
        )}
      </div>
    </div>
  )
}
