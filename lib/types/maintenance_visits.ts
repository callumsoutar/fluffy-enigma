/**
 * Maintenance visit types
 */

export interface MaintenanceVisit {
  id: string
  aircraft_id: string
  component_id: string | null
  visit_date: string
  visit_type: string
  description: string
  total_cost: number | null
  hours_at_visit: number | null
  notes: string | null
  date_out_of_maintenance: string | null
  performed_by: string
  component_due_hours: number | null
  component_due_date: string | null
  next_due_hours: number | null
  next_due_date: string | null
  booking_id: string | null
  scheduled_for: string | null
  scheduled_end: string | null
  scheduled_by: string | null
  created_at: string
  updated_at: string
}

export type VisitType = 
  | "Scheduled"
  | "Unscheduled"
  | "Inspection"
  | "Repair"
  | "Modification"
