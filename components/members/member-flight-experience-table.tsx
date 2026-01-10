"use client"

import * as React from "react"
import { format } from "date-fns"
import { Clock, ChevronDown, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AddFlightExperienceModal } from "./AddFlightExperienceModal"

interface FlightExperience {
  id: string
  occurred_at: string
  value: number
  unit: string
  notes: string | null
  conditions: string | null
  experience_type: {
    id: string
    name: string
  } | null
  instructor: {
    user: {
      first_name: string | null
      last_name: string | null
    } | null
  } | null
  booking: {
    aircraft: {
      registration: string
    } | null
  } | null
}

interface MemberFlightExperienceTableProps {
  memberId: string
  experience: FlightExperience[]
}

export function MemberFlightExperienceTable({ memberId, experience }: MemberFlightExperienceTableProps) {
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({})
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }))
  }

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return "-"
    try {
      return format(new Date(value), "MMM d, yyyy")
    } catch {
      return "-"
    }
  }

  const groupedExperience = React.useMemo(() => {
    const groups: Record<string, {
      name: string
      records: FlightExperience[]
      total: number
      unit: string
    }> = {}

    experience.forEach(record => {
      const typeName = record.experience_type?.name || "Other"
      if (!groups[typeName]) {
        groups[typeName] = {
          name: typeName,
          records: [],
          total: 0,
          unit: record.unit
        }
      }
      groups[typeName].records.push(record)
      groups[typeName].total += Number(record.value)
    })

    return groups
  }, [experience])

  if (experience.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-slate-900">Flight Experience Log</h3>
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            size="sm"
            className="h-8 rounded-lg bg-slate-900 text-[11px] font-bold text-white shadow-sm hover:bg-slate-800"
          >
            <Plus className="mr-1.5 h-3 w-3" />
            Add Experience
          </Button>
        </div>

        <div className="rounded-lg border border-dashed border-slate-200 p-12 text-center bg-slate-50/30">
          <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-6 h-6 text-slate-300" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">No flight experience records</h3>
          <p className="text-xs text-slate-500 mt-2 max-w-[280px] mx-auto">
            Flight experience logged during lessons or manual entries will appear here.
          </p>
        </div>

        <AddFlightExperienceModal 
          memberId={memberId}
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-slate-900">Flight Experience Log</h3>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {experience.length} Records
          </span>
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            size="sm"
            className="h-8 rounded-lg bg-slate-900 text-[11px] font-bold text-white shadow-sm hover:bg-slate-800"
          >
            <Plus className="mr-1.5 h-3 w-3" />
            Add Experience
          </Button>
        </div>
      </div>

      {Object.values(groupedExperience).map((group) => {
        const isExpanded = expandedGroups[group.name] || false

        return (
          <div key={group.name} className="space-y-3">
            <button 
              onClick={() => toggleGroup(group.name)}
              className="flex items-center gap-2 px-1 hover:opacity-70 transition-opacity w-full text-left group"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{group.name}</h4>
              <div className="ml-auto flex items-center gap-2">
                {!isExpanded && (
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                    {group.total.toFixed(1)} {group.unit}
                  </span>
                )}
              </div>
            </button>

            {isExpanded && (
              <>
                <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="px-6 py-3 text-left font-semibold text-xs text-slate-500 w-[160px]">Date</th>
                        <th className="px-6 py-3 text-left font-semibold text-xs text-slate-500 w-[140px]">Aircraft</th>
                        <th className="px-6 py-3 text-left font-semibold text-xs text-slate-500 w-[200px]">Instructor</th>
                        <th className="px-6 py-3 text-right font-semibold text-xs text-slate-500">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.records.map((record) => (
                        <tr key={record.id} className="transition-colors hover:bg-slate-50/50">
                          <td className="px-6 py-4 align-middle whitespace-nowrap text-slate-700">
                            {formatDateTime(record.occurred_at)}
                          </td>
                          <td className="px-6 py-4 align-middle text-slate-900 font-medium">
                            {record.booking?.aircraft?.registration || "-"}
                          </td>
                          <td className="px-6 py-4 align-middle text-slate-700">
                            {record.instructor?.user?.first_name} {record.instructor?.user?.last_name || "-"}
                          </td>
                          <td className="px-6 py-4 align-middle text-right text-slate-700">
                            <span className="font-semibold text-slate-900">{record.value}</span>
                            <span className="text-[10px] text-slate-500 ml-1 uppercase">{record.unit}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50/80 font-semibold border-t border-slate-200">
                        <td colSpan={3} className="px-6 py-3 text-right text-xs uppercase tracking-wider text-slate-500">Total {group.name}</td>
                        <td className="px-6 py-3 text-right text-slate-900">
                          <span className="text-sm font-bold">{group.total.toFixed(1)}</span>
                          <span className="text-[10px] text-slate-500 ml-1 uppercase">{group.unit}</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden space-y-3">
                  {group.records.map((record) => (
                    <div key={record.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-xs text-slate-900">{formatDateTime(record.occurred_at)}</span>
                          <span className="text-[10px] font-bold text-slate-600">
                            {record.booking?.aircraft?.registration || "-"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded text-[10px] font-bold text-slate-600 border border-slate-100">
                          {record.value} {record.unit}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <div className="text-[10px] text-slate-500 mb-0.5">Instructor</div>
                          <div className="text-xs text-slate-900 font-medium">
                            {record.instructor?.user?.first_name} {record.instructor?.user?.last_name || "-"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm flex justify-between items-center">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total {group.name}</span>
                    <div className="text-slate-900">
                      <span className="text-sm font-bold">{group.total.toFixed(1)}</span>
                      <span className="text-[10px] text-slate-500 ml-1 uppercase">{group.unit}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )
      })}

      <AddFlightExperienceModal 
        memberId={memberId}
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
      />
    </div>
  )
}

