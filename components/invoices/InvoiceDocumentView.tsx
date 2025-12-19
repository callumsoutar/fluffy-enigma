import * as React from "react"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export type InvoicingSettings = {
  schoolName: string
  billingAddress: string
  gstNumber: string
  contactPhone: string
  contactEmail: string
  invoiceFooter: string
  paymentTerms: string
}

export type InvoiceDocumentItem = {
  id: string
  description: string | null
  quantity: number | null
  unit_price: number | null
  rate_inclusive: number | null
  line_total: number | null
}

export type InvoiceDocumentData = {
  invoiceNumber: string
  issueDate?: string | null
  dueDate?: string | null
  taxRate?: number | null
  subtotal?: number | null
  taxTotal?: number | null
  totalAmount?: number | null
  totalPaid?: number | null
  balanceDue?: number | null
  billToName: string
}

function money(n: number | null | undefined) {
  return (typeof n === "number" ? n : 0).toFixed(2)
}

function dateOnly(v: string | null | undefined) {
  if (!v) return "-"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return "-"
  return d.toLocaleDateString()
}

export default function InvoiceDocumentView({
  invoice,
  items,
  settings,
  actionsSlot,
}: {
  invoice: InvoiceDocumentData
  items: InvoiceDocumentItem[]
  settings: InvoicingSettings
  actionsSlot?: React.ReactNode
}) {
  const taxPercent = Math.round(((invoice.taxRate ?? 0) as number) * 100)

  return (
    <Card className="shadow-sm ring-1 ring-border/40 overflow-hidden">
      <div className="p-8 bg-background">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <div className="text-3xl font-semibold tracking-tight">INVOICE</div>
              <div className="mt-1 text-sm text-muted-foreground">{settings.schoolName}</div>
              <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                {settings.billingAddress ? (
                  <div className="whitespace-pre-line">{settings.billingAddress}</div>
                ) : null}
                {settings.gstNumber ? <div>GST: {settings.gstNumber}</div> : null}
                {settings.contactPhone ? <div>Ph: {settings.contactPhone}</div> : null}
                {settings.contactEmail ? <div>Email: {settings.contactEmail}</div> : null}
              </div>

              <div className="mt-6">
                <div className="text-sm font-semibold">Bill To:</div>
                <div className="text-sm">{invoice.billToName}</div>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/15 p-4 md:p-5 w-full md:w-[340px]">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="text-muted-foreground">Invoice Number</div>
                <div className="text-right font-semibold tabular-nums whitespace-nowrap">{invoice.invoiceNumber}</div>
                <div className="text-muted-foreground">Invoice Date</div>
                <div className="text-right font-semibold tabular-nums">{dateOnly(invoice.issueDate)}</div>
                <div className="text-muted-foreground">Due Date</div>
                <div className="text-right font-semibold tabular-nums">{dateOnly(invoice.dueDate)}</div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border bg-background">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Description
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right w-[110px]">
                    Quantity
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right w-[160px]">
                    Rate (incl. tax)
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right w-[160px]">
                    Amount
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      No items
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/10">
                      <TableCell className="py-3 text-sm">{item.description}</TableCell>
                      <TableCell className="py-3 text-right tabular-nums text-sm">
                        {item.quantity ?? 0}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums text-sm">
                        ${money(item.rate_inclusive ?? item.unit_price)}
                      </TableCell>
                      <TableCell className="py-3 text-right tabular-nums text-sm font-semibold">
                        ${money(item.line_total)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="w-full max-w-sm space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-8">
                <div className="text-muted-foreground">Subtotal (excl. Tax):</div>
                <div className="font-medium tabular-nums">${money(invoice.subtotal)}</div>
              </div>
              <div className="flex items-center justify-between gap-8">
                <div className="text-muted-foreground">Tax ({taxPercent}%):</div>
                <div className="font-medium tabular-nums">${money(invoice.taxTotal)}</div>
              </div>
              <div className="border-t pt-2.5 flex items-center justify-between gap-8">
                <div className="text-base font-semibold">Total:</div>
                <div className="text-lg font-semibold tabular-nums text-green-600">
                  ${money(invoice.totalAmount)}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-8">
                <div className="text-muted-foreground">Paid:</div>
                <div className="font-semibold tabular-nums text-blue-700">
                  ${money(invoice.totalPaid)}
                </div>
              </div>
              <div className="flex items-center justify-between gap-8">
                <div className="text-muted-foreground">Balance Due:</div>
                <div className="font-semibold tabular-nums text-red-600">
                  ${money(invoice.balanceDue)}
                </div>
              </div>
            </div>

            {actionsSlot ? <div className="mt-3 w-full">{actionsSlot}</div> : null}
          </div>

          <div className="mt-6 border-t pt-4 text-center text-sm text-muted-foreground space-y-1">
            <div>{settings.invoiceFooter}</div>
            <div className="text-xs">{settings.paymentTerms}</div>
          </div>
        </div>
      </div>
    </Card>
  )
}

