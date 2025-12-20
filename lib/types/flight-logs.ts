// Flight log types based on database schema

export interface FlightLog {
  id: string
  booking_id: string
  checked_out_aircraft_id: string | null
  checked_out_instructor_id: string | null
  eta: string | null // ISO timestamp
  hobbs_start: number | null
  hobbs_end: number | null
  tach_start: number | null
  tach_end: number | null
  flight_time_hobbs: number | null
  flight_time_tach: number | null
  flight_time: number | null
  fuel_on_board: number | null
  passengers: string | null
  route: string | null
  equipment: Record<string, unknown> | null // JSONB
  briefing_completed: boolean
  authorization_completed: boolean
  flight_remarks: string | null
  solo_end_hobbs: number | null
  dual_time: number | null
  solo_time: number | null
  total_hours_start: number | null
  total_hours_end: number | null
  flight_type_id: string | null
  lesson_id: string | null
  description: string | null
  remarks: string | null
  created_at: string
  updated_at: string
}

// Extended flight log with joined data
export interface FlightLogWithRelations extends FlightLog {
  checked_out_aircraft?: {
    id: string
    registration: string
    type: string
    model: string | null
  } | null
  checked_out_instructor?: {
    id: string
    first_name: string | null
    last_name: string | null
    user_id: string | null
    users?: {
      id: string
      first_name: string | null
      last_name: string | null
      email: string
    } | null
  } | null
  booking?: {
    id: string
    aircraft_id: string
    user_id: string | null
    instructor_id: string | null
    start_time: string
    end_time: string
    purpose: string
    student?: {
      id: string
      first_name: string | null
      last_name: string | null
      email: string
    } | null
    instructor?: {
      id: string
      first_name: string | null
      last_name: string | null
      user_id: string | null
      users?: {
        id: string
        first_name: string | null
        last_name: string | null
        email: string
      } | null
    } | null
  } | null
}
