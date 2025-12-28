"use client"

import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { IconCalendar, IconCircleCheck, IconChevronRight } from "@tabler/icons-react"
import { format } from "date-fns"
import type { EquipmentIssuance, Equipment } from "@/lib/types/equipment"

interface EquipmentIssuanceTableProps {
  issuances: EquipmentIssuance[]
  userMap: Record<string, string>
  loading?: boolean
  error?: string | null
  equipment?: Equipment
  refresh?: () => void
}

export const EquipmentIssuanceTable: React.FC<EquipmentIssuanceTableProps> = ({ 
  issuances, 
  userMap, 
  loading, 
  error 
}) => {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-2xl font-bold tracking-tight text-slate-900">Issuance History</h3>
        <p className="text-slate-600 mt-1">Track equipment loans and returns.</p>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Issued To
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Issued By
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Issued Date
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Expected Return
              </th>
              <th className="px-4 py-3 text-center font-semibold text-xs uppercase tracking-wide text-slate-600">
                Status
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="h-24 text-center text-slate-500 font-medium">Loading...</td></tr>
            ) : error ? (
              <tr><td colSpan={6} className="h-24 text-center text-red-500 font-medium">{error}</td></tr>
            ) : issuances.length === 0 ? (
              <tr><td colSpan={6} className="h-24 text-center text-slate-500 font-medium">No issuance records found.</td></tr>
            ) : (
              issuances.map((row) => {
                const issuedDate = row.issued_at ? format(new Date(row.issued_at), 'dd MMM yyyy') : null
                const expectedReturn = row.expected_return ? format(new Date(row.expected_return), 'dd MMM yyyy') : null
                const returnedDate = row.returned_at ? format(new Date(row.returned_at), 'dd MMM yyyy') : null
                const notesTruncated = row.notes && row.notes.length > 50 ? row.notes.slice(0, 50) + '…' : row.notes
                
                return (
                  <tr
                    key={row.id}
                    className="group transition-colors hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-3.5 align-middle">
                      <span className="font-semibold text-slate-900">{userMap[row.user_id] || row.user_id}</span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <span className="font-medium text-slate-600">{userMap[row.issued_by] || row.issued_by}</span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {issuedDate ? <span className="font-medium text-slate-700">{issuedDate}</span> : <span className="text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {expectedReturn ? <span className="font-medium text-slate-700">{expectedReturn}</span> : <span className="text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-center align-middle">
                      {returnedDate ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium px-2 py-0.5">
                          Returned {returnedDate}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-medium px-2 py-0.5">
                          Out
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-middle max-w-[200px]">
                      {row.notes && row.notes.length > 50 ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <span className="text-slate-600 cursor-pointer hover:text-slate-900 underline decoration-dotted text-sm" tabIndex={0} aria-label="Show full notes">
                              {notesTruncated}
                            </span>
                          </PopoverTrigger>
                          <PopoverContent side="top" className="text-sm max-w-xs whitespace-pre-line">
                            {row.notes}
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="text-slate-600 text-sm">{row.notes || "—"}</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-200 text-slate-500 font-medium">Loading...</div>
        ) : error ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-200 text-red-500 font-medium">{error}</div>
        ) : issuances.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-200 text-slate-500 font-medium">No issuance records found.</div>
        ) : (
          issuances.map((row) => {
            const issuedDate = row.issued_at ? format(new Date(row.issued_at), 'dd MMM yyyy') : null
            const expectedReturn = row.expected_return ? format(new Date(row.expected_return), 'dd MMM yyyy') : null
            const returnedDate = row.returned_at ? format(new Date(row.returned_at), 'dd MMM yyyy') : null
            
            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50 transition-colors"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-900 rounded-l-lg" />
                
                <div className="flex justify-between items-start mb-3 pl-2">
                  <div className="flex flex-col">
                    <h3 className="font-semibold text-slate-900">{userMap[row.user_id] || row.user_id}</h3>
                    <span className="text-xs text-slate-600">Issued by {userMap[row.issued_by] || row.issued_by}</span>
                  </div>
                  {returnedDate ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium px-2 py-0.5">
                      Returned
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-medium px-2 py-0.5">
                      Out
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <IconCalendar className="w-3 h-3" /> Issued
                    </div>
                    <div className="font-semibold text-sm text-slate-700">
                      {issuedDate || "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <IconCircleCheck className="w-3 h-3" /> Expected
                    </div>
                    <div className="font-semibold text-sm text-slate-700">
                      {expectedReturn || "—"}
                    </div>
                  </div>
                  {returnedDate && (
                    <div className="space-y-1 col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                        <IconCircleCheck className="w-3 h-3 text-emerald-600" /> Returned
                      </div>
                      <div className="font-semibold text-sm text-emerald-700">
                        {returnedDate}
                      </div>
                    </div>
                  )}
                </div>

                {row.notes && (
                  <div className="mt-3 pt-3 border-t border-slate-100 pl-2">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {row.notes}
                    </p>
                  </div>
                )}

                <div className="absolute right-4 bottom-4">
                  <IconChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

