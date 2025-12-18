/**
 * Observation types for aircraft observations/defects
 */

export type ObservationStage = 'open' | 'investigation' | 'resolution' | 'closed'
export type ObservationPriority = 'low' | 'medium' | 'high'

export interface Observation {
  id: string
  aircraft_id: string
  name: string
  description: string | null
  stage: ObservationStage
  priority: ObservationPriority | null
  reported_by: string
  assigned_to: string | null
  reported_date: string
  resolved_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  closed_by: string | null
  resolution_comments: string | null
}

export interface ObservationWithUser extends Observation {
  reported_by_user?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
  assigned_to_user?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
  closed_by_user?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
}
