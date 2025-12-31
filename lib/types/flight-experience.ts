export type ExperienceUnit = 'hours' | 'count' | 'landings'

export interface FlightExperienceEntry {
  id: string
  booking_id: string
  lesson_progress_id: string
  user_id: string
  instructor_id: string
  experience_type_id: string
  value: number
  unit: ExperienceUnit
  occurred_at: string
  notes: string | null
  conditions: string | null
  created_at: string | null
  updated_at: string | null
  created_by: string | null
}

export interface FlightExperienceEntryWithType extends FlightExperienceEntry {
  experience_type?: {
    id: string
    name: string
  } | null
}


