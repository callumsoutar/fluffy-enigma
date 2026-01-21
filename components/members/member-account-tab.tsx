"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { DollarSign, Loader2 } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { MemberWithRelations } from "@/lib/types/members"
import type { AccountStatementEntry, AccountStatementResponse } from "@/lib/types/account-statement"

export type MemberAccountTabProps = {
  memberId: string
  member?: MemberWithRelations
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatCurrency(amount: number) {
  return `$${Math.abs(amount).toFixed(2)}`
}

function getEntryTypeBadge(type: AccountStatementEntry["entry_type"]) {
  switch (type) {
    case "invoice":
      return <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Invoice</span>
    case "payment":
      return <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Payment</span>
    case "credit_note":
      return <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">Credit Note</span>
    case "opening_balance":
      return <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">Opening</span>
    default:
      return null
  }
}

async function fetchAccountStatement(memberId: string): Promise<AccountStatementResponse> {
  const res = await fetch(`/api/account-statement?user_id=${memberId}`)
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload?.error || "Failed to load account statement")
  }
  return payload as AccountStatementResponse
}

export function MemberAccountTab({ memberId, member }: MemberAccountTabProps) {
  const router = useRouter()
  const statementQuery = useQuery({
    queryKey: ["account-statement", memberId],
    queryFn: () => fetchAccountStatement(memberId),
    enabled: !!memberId,
    refetchOnWindowFocus: true,
  })

  const statement = statementQuery.data?.statement ?? []
  const closingBalance = statementQuery.data?.closing_balance ?? 0

  // Pagination (client-side for now; easy to move server-side later)
  const [page, setPage] = React.useState(0)
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(statement.length / pageSize))
  const paginated = statement.slice(page * pageSize, (page + 1) * pageSize)

  React.useEffect(() => {
    // Reset pagination when member changes or statement changes
    setPage(0)
  }, [memberId, statement.length])

  return (
    <div className="flex flex-col gap-8">
      {/* Summary bar */}
      <div className="flex flex-col items-stretch bg-gray-50 rounded-lg p-4 md:p-6 border border-gray-100">
        <div className="flex flex-col items-center justify-center py-4">
          <DollarSign className="w-6 h-6 mb-2 text-green-500" />
          <div className="text-xs text-muted-foreground mb-2">Account Balance</div>
          {!member || statementQuery.isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground my-2" />
          ) : (
            <div className="flex flex-col items-center">
              {closingBalance < 0 ? (
                <>
                  <span className="text-2xl md:text-3xl font-bold text-green-600">${Math.abs(closingBalance).toFixed(2)}</span>
                  <span className="text-xs mt-1 uppercase tracking-wider text-green-700 font-semibold">Credit</span>
                </>
              ) : closingBalance > 0 ? (
                <>
                  <span className="text-2xl md:text-3xl font-bold text-red-600">${closingBalance.toFixed(2)}</span>
                  <span className="text-xs mt-1 uppercase tracking-wider text-red-700 font-semibold">Owing</span>
                </>
              ) : (
                <>
                  <span className="text-2xl md:text-3xl font-bold text-gray-700">$0.00</span>
                  <span className="text-xs mt-1 uppercase tracking-wider text-gray-500 font-semibold">Settled</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Statement table */}
      <div>
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">Account Statement</h3>
        <div className="rounded-md border overflow-x-auto bg-white shadow-sm">
          {statementQuery.isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p>Loading account statement...</p>
            </div>
          ) : statementQuery.isError ? (
            <div className="p-8 text-center text-destructive">
              {statementQuery.error instanceof Error ? statementQuery.error.message : "Failed to load account statement"}
            </div>
          ) : statement.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No transactions found for this member.</div>
          ) : (
            <>
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Reference</TableHead>
                    <TableHead className="font-semibold">Description</TableHead>
                    <TableHead className="font-semibold text-right">Total</TableHead>
                    <TableHead className="font-semibold text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((entry, idx) => {
                    const isOpening = entry.entry_type === "opening_balance"
                    const isInvoice = entry.entry_type === "invoice"
                    const isDebit = entry.amount > 0
                    return (
                      <TableRow
                        key={`${entry.entry_id}-${idx}`}
                        className={cn(
                          isOpening ? "bg-blue-50 font-semibold" : "hover:bg-gray-50",
                          isInvoice && "cursor-pointer"
                        )}
                        onClick={() => {
                          if (isInvoice) {
                            router.push(`/invoices/${entry.entry_id}`)
                          }
                        }}
                      >
                        <TableCell className="whitespace-nowrap">{formatDate(entry.date)}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          <div className="flex items-center gap-2">
                            {entry.reference}
                            {!isOpening && getEntryTypeBadge(entry.entry_type)}
                          </div>
                        </TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {isOpening ? (
                            <span className="text-gray-500">—</span>
                          ) : isDebit ? (
                            <span className="text-red-600 font-medium">{formatCurrency(entry.amount)}</span>
                          ) : (
                            <span className="text-green-600 font-medium">{formatCurrency(entry.amount)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap font-semibold">
                          {entry.balance < 0 ? (
                            <span className="text-green-600">${Math.abs(entry.balance).toFixed(2)} CR</span>
                          ) : entry.balance > 0 ? (
                            <span className="text-red-600">${entry.balance.toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-600">$0.00</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  <TableRow className="bg-blue-100 font-bold border-t-2 border-blue-300">
                    <TableCell colSpan={3} className="text-right uppercase tracking-wide">
                      Closing Balance
                    </TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right text-lg">
                      {closingBalance < 0 ? (
                        <span className="text-green-700">${Math.abs(closingBalance).toFixed(2)} CR</span>
                      ) : closingBalance > 0 ? (
                        <span className="text-red-700">${closingBalance.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-700">$0.00</span>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {statement.length > pageSize && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                  <div className="text-sm text-muted-foreground">
                    Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, statement.length)} of{" "}
                    {statement.length} entries
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      className="px-3 py-1 rounded border text-sm disabled:opacity-50 hover:bg-white transition-colors"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </button>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {page + 1} of {pageCount}
                    </span>
                    <button
                      className="px-3 py-1 rounded border text-sm disabled:opacity-50 hover:bg-white transition-colors"
                      onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                      disabled={page >= pageCount - 1}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}


