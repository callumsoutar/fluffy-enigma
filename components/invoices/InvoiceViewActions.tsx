"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, Mail, PlusCircle, Printer, Download, Loader2, Calendar } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import RecordPaymentModal from "@/components/invoices/RecordPaymentModal"
import { pdf } from "@react-pdf/renderer"
import InvoiceReportPDF from "./InvoiceReportPDF"
import type { InvoiceDocumentData, InvoiceDocumentItem, InvoicingSettings } from "./InvoiceDocumentView"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export type InvoiceViewActionsProps = {
  invoiceId: string
  invoice: InvoiceDocumentData
  items: InvoiceDocumentItem[]
  settings: InvoicingSettings
  status?: string | null
  billToEmail?: string | null
  bookingId?: string | null
  onPaymentSuccess?: () => void
}

export default function InvoiceViewActions({
  invoiceId,
  invoice,
  items,
  settings,
  status,
  billToEmail,
  bookingId,
  onPaymentSuccess,
}: InvoiceViewActionsProps) {
  const router = useRouter()
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [isDownloading, setIsDownloading] = React.useState(false)
  const [isPrinting, setIsPrinting] = React.useState(false)

  const canEmail = !!billToEmail
  const isPaid = status === "paid"

  const handleDownloadPDF = async () => {
    setIsDownloading(true)
    try {
      const doc = <InvoiceReportPDF invoice={invoice} items={items} settings={settings} />
      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `Invoice-${invoice.invoiceNumber || invoiceId.slice(0, 8)}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("Invoice PDF downloaded")
    } catch (error) {
      console.error("Error downloading PDF:", error)
      toast.error("Failed to download PDF")
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePrint = async () => {
    setIsPrinting(true)
    try {
      const doc = <InvoiceReportPDF invoice={invoice} items={items} settings={settings} />
      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      const printWindow = window.open(url, "_blank")
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }
      } else {
        toast.error("Pop-up blocked. Please allow pop-ups to print.")
      }
    } catch (error) {
      console.error("Error printing PDF:", error)
      toast.error("Failed to generate print view")
    } finally {
      setIsPrinting(false)
    }
  }

  const emailInvoice = () => {
    if (!billToEmail) return
    const subject = encodeURIComponent(`Invoice ${invoice.invoiceNumber || ""}`.trim())
    const body = encodeURIComponent(
      `Hi,\n\nPlease find your invoice ${invoice.invoiceNumber || ""}.\n\nBalance due: $${
        typeof invoice.balanceDue === "number" ? invoice.balanceDue.toFixed(2) : "0.00"
      }\n\nThanks,\n`
    )
    window.location.href = `mailto:${billToEmail}?subject=${subject}&body=${body}`
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {!isPaid && (
          <Button
            type="button"
            size="sm"
            className="h-8 sm:h-9 gap-1.5"
            onClick={() => setPaymentOpen(true)}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add Payment</span>
            <span className="sm:hidden">Pay</span>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              className="h-8 sm:h-9 gap-1.5"
            >
              Options
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem 
              onSelect={(e) => { e.preventDefault(); emailInvoice(); }} 
              disabled={!canEmail}
            >
              <Mail className="h-4 w-4 mr-2" />
              Email Invoice
            </DropdownMenuItem>

            <DropdownMenuItem 
              onSelect={(e) => { e.preventDefault(); handleDownloadPDF(); }} 
              disabled={isDownloading}
            >
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Download PDF
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handlePrint(); }} disabled={isPrinting}>
              {isPrinting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
              Print PDF
            </DropdownMenuItem>
            
            {bookingId && (
              <DropdownMenuItem onSelect={() => router.push(`/bookings/${bookingId}`)}>
                <Calendar className="h-4 w-4 mr-2" />
                View Booking
              </DropdownMenuItem>
            )}
            
            {isPaid && (
              <DropdownMenuItem onSelect={() => setPaymentOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Record Payment
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <RecordPaymentModal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        invoiceId={invoiceId}
        invoiceNumber={invoice.invoiceNumber}
        totalAmount={invoice.totalAmount ?? null}
        totalPaid={invoice.totalPaid ?? null}
        balanceDue={invoice.balanceDue ?? null}
        onSuccess={onPaymentSuccess}
      />
    </>
  )
}
