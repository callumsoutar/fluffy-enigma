"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, Mail, PlusCircle, Printer } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import RecordPaymentModal from "@/components/invoices/RecordPaymentModal"

export type InvoiceViewActionsProps = {
  invoiceId: string
  invoiceNumber?: string | null
  billToEmail?: string | null
  status?: string | null
  balanceDue?: number | null
  totalAmount?: number | null
  totalPaid?: number | null
}

export default function InvoiceViewActions({
  invoiceId,
  invoiceNumber,
  billToEmail,
  status,
  balanceDue,
  totalAmount,
  totalPaid,
}: InvoiceViewActionsProps) {
  const [paymentOpen, setPaymentOpen] = React.useState(false)

  const canEmail = !!billToEmail
  const isPaid = status === "paid"
  const emailInvoice = () => {
    if (!billToEmail) return
    const subject = encodeURIComponent(`Invoice ${invoiceNumber || ""}`.trim())
    const body = encodeURIComponent(
      `Hi,\n\nPlease find your invoice ${invoiceNumber || ""}.\n\nBalance due: $${
        typeof balanceDue === "number" ? balanceDue.toFixed(2) : "0.00"
      }\n\nThanks,\n`
    )
    window.location.href = `mailto:${billToEmail}?subject=${subject}&body=${body}`
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="gap-2 print:hidden">
            Options
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              if (!canEmail) {
                e.preventDefault()
                return
              }
              emailInvoice()
            }}
            disabled={!canEmail}
          >
            <Mail className="h-4 w-4" />
            Send Email
          </DropdownMenuItem>
          {!isPaid && (
            <DropdownMenuItem
              onSelect={() => {
                void invoiceId
                setPaymentOpen(true)
              }}
            >
              <PlusCircle className="h-4 w-4" />
              Record Payment
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <RecordPaymentModal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        invoiceId={invoiceId}
        invoiceNumber={invoiceNumber}
        totalAmount={totalAmount ?? null}
        totalPaid={totalPaid ?? null}
        balanceDue={balanceDue ?? null}
      />
    </>
  )
}
