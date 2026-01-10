"use client"

import React from "react"
import type { FlightExperienceEntryWithType } from "@/lib/types/flight-experience"
import type { ExperienceType } from "@/lib/types/experience-types"
import { Badge } from "@/components/ui/badge"

interface FlightExperienceDisplayProps {
  flightExperiences: FlightExperienceEntryWithType[]
  experienceTypes: ExperienceType[]
}

export default function FlightExperienceDisplay({
  flightExperiences,
}: FlightExperienceDisplayProps) {
  if (!flightExperiences || flightExperiences.length === 0) {
    return (
      <div className="text-gray-500 italic p-4 bg-gray-50 rounded-lg border border-dashed">
        No flight experience recorded for this lesson.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">Category</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-700">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {flightExperiences.map((exp) => (
            <tr key={exp.id} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">
                  {exp.experience_type?.name || "Experience"}
                </div>
                {exp.notes && (
                  <div className="text-xs text-gray-500 mt-0.5">{exp.notes}</div>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <Badge variant="secondary" className="font-bold text-sm">
                  {exp.value}
                  <span className="ml-1 text-[10px] uppercase font-medium text-gray-500">
                    {exp.unit}
                  </span>
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
