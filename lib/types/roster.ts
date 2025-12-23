export interface RosterRule {
  id: string
  instructor_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  effective_from: string
  effective_until: string | null
  notes: string | null
  created_at: string
  updated_at: string
  voided_at: string | null
}

