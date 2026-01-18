"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Save, CheckCircle2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import type { InvoiceStatus } from "@/lib/types/invoices"
import type { UserResult } from "./MemberSelect"
import Link from "next/link"

interface InvoiceActionsToolbarProps {
  mode: 'new' | 'edit' | 'view'
  invoiceId?: string
  invoiceNumber?: string | null
  status?: InvoiceStatus
  member?: UserResult | null
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
  member,
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

  const displayName = member
    ? [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email
    : ""

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4 sm:gap-8 overflow-hidden">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3 sm:gap-2 shrink-0 text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          {displayInvoiceNumber && (
            <div className="flex items-center gap-4 shrink-0">
              <span className="font-bold text-base sm:text-xl tracking-tight text-slate-900 leading-none">
                {displayInvoiceNumber}
              </span>
              
              {status && (
                <Badge
                  variant={getStatusBadgeVariant(status)}
                  className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md shrink-0 border-none shadow-sm"
                >
                  {getStatusLabel(status)}
                </Badge>
              )}
            </div>
          )}

          {member && (
            <>
              <div className="hidden md:block h-4 w-px bg-slate-200/60 shrink-0" />
              <div className="hidden md:flex items-center px-3 py-1.5 min-w-0">
                <Link 
                  href={`/members/${member.id}`}
                  className="font-medium text-sm tracking-tight text-slate-500 hover:text-slate-900 transition-colors truncate leading-none"
                >
                  {displayName}
                </Link>
              </div>
            </>
          )}
        </div>
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
