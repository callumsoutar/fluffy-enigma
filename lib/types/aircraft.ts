// Aircraft and aircraft type types based on database schema

/**
 * Aircraft type from aircraft_types table
 */
export interface AircraftType {
  id: string
  name: string
  category: string | null
  description: string | null
  created_at: string | null
  updated_at: string | null
}

/**
 * Base aircraft interface matching the aircraft table
 */
export interface Aircraft {
  id: string
  registration: string
  type: string
  model: string | null
  year_manufactured: number | null
  total_hours: number | null
  status: string | null
  notes: string | null
  created_at: string
  updated_at: string
  manufacturer: string | null
  capacity: number | null
  current_tach: number
  current_hobbs: number
  record_tacho: boolean
  record_hobbs: boolean
  record_airswitch: boolean
  on_line: boolean
  for_ato: boolean
  fuel_consumption: number | null
  prioritise_scheduling: boolean
  aircraft_image_url: string | null
  total_time_method: string | null
  aircraft_type_id: string | null
}

/**
 * Aircraft with related aircraft type information
 */
export interface AircraftWithType extends Aircraft {
  aircraft_type?: AircraftType | null
}

/**
 * Filter options for aircraft query
 */
export interface AircraftFilter {
  search?: string // Search in registration, model, type
  status?: string
  aircraft_type_id?: string
}

/**
 * API response for aircraft
 */
export interface AircraftResponse {
  aircraft: AircraftWithType[]
  total: number
}
