"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { IconCalendar, IconPlus, IconChevronRight } from "@tabler/icons-react"
import { format } from "date-fns"
import type { EquipmentUpdate, Equipment } from "@/lib/types/equipment"
import { UpdateEquipmentModal } from "@/components/equipment/UpdateEquipmentModal"

interface EquipmentUpdatesTableProps {
  updates: EquipmentUpdate[]
  userMap: Record<string, string>
  loading?: boolean
  error?: string | null
  equipment?: Equipment
  refresh?: () => void
}

export const EquipmentUpdatesTable: React.FC<EquipmentUpdatesTableProps> = ({ 
  updates, 
  userMap, 
  loading, 
  error, 
  equipment, 
  refresh 
}) => {
  const [modalOpen, setModalOpen] = React.useState(false)
  
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-slate-900">Update History</h3>
          <p className="text-slate-600 mt-1">Track maintenance and inspection records.</p>
        </div>
        {equipment && (
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-slate-900 text-white font-semibold h-10 px-5 hover:bg-slate-800"
          >
            <IconPlus className="h-4 w-4 mr-2" />
            Log Update
          </Button>
        )}
      </div>
      
      {equipment && (
        <UpdateEquipmentModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          equipment={equipment}
          onSuccess={refresh || (() => {})}
        />
      )}

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Updated By
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Update Date
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Next Due At
              </th>
              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-600">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={4} className="h-24 text-center text-slate-500 font-medium">Loading...</td></tr>
            ) : error ? (
              <tr><td colSpan={4} className="h-24 text-center text-red-500 font-medium">{error}</td></tr>
            ) : updates.length === 0 ? (
              <tr><td colSpan={4} className="h-24 text-center text-slate-500 font-medium">No update records found.</td></tr>
            ) : (
              updates.map((row) => {
                const updateDate = row.updated_at ? format(new Date(row.updated_at), 'dd MMM yyyy') : null
                const nextDueAt = row.next_due_at ? format(new Date(row.next_due_at), 'dd MMM yyyy') : null
                const notesTruncated = row.notes && row.notes.length > 50 ? row.notes.slice(0, 50) + '…' : row.notes
                
                return (
                  <tr
                    key={row.id}
                    className="group transition-colors hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-3.5 align-middle">
                      <span className="font-semibold text-slate-900">{userMap[row.updated_by] || row.updated_by}</span>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {updateDate ? <span className="font-medium text-slate-700">{updateDate}</span> : <span className="text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      {nextDueAt ? <span className="font-medium text-slate-700">{nextDueAt}</span> : <span className="text-slate-500">—</span>}
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
        ) : updates.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-slate-200 text-slate-500 font-medium">No update records found.</div>
        ) : (
          updates.map((row) => {
            const updateDate = row.updated_at ? format(new Date(row.updated_at), 'dd MMM yyyy') : null
            const nextDueAt = row.next_due_at ? format(new Date(row.next_due_at), 'dd MMM yyyy') : null
            
            return (
              <div
                key={row.id}
                className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50 transition-colors"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-900 rounded-l-lg" />
                
                <div className="flex justify-between items-start mb-3 pl-2">
                  <div className="flex flex-col">
                    <h3 className="font-semibold text-slate-900">{userMap[row.updated_by] || row.updated_by}</h3>
                    <span className="text-xs text-slate-600">{updateDate || "—"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <IconCalendar className="w-3 h-3" /> Updated
                    </div>
                    <div className="font-semibold text-sm text-slate-700">
                      {updateDate || "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <IconCalendar className="w-3 h-3" /> Next Due
                    </div>
                    <div className="font-semibold text-sm text-slate-700">
                      {nextDueAt || "—"}
                    </div>
                  </div>
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

