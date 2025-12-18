/**
 * Aircraft component types for maintenance items
 */

export type ComponentType = 
  | "battery"
  | "inspection"
  | "service"
  | "engine"
  | "fuselage"
  | "avionics"
  | "elt"
  | "propeller"
  | "landing_gear"
  | "other"

export type IntervalType = "HOURS" | "CALENDAR" | "BOTH"

export type ComponentStatus = "active" | "inactive" | "removed"

export interface AircraftComponent {
  id: string
  aircraft_id: string
  name: string
  description: string | null
  component_type: ComponentType | string
  status: ComponentStatus | string
  interval_type: IntervalType | string
  interval_hours: number | null
  interval_days: number | null
  current_due_date: string | null
  current_due_hours: number | null
  last_completed_date: string | null
  last_completed_hours: number | null
  priority: string | null
  extension_limit_hours: number | null
  notes: string | null
  created_at: string
  updated_at: string
  voided_at: string | null
}
