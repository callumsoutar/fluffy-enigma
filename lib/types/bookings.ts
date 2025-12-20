// Booking types based on database schema

export type BookingStatus = 
  | 'unconfirmed'
  | 'confirmed'
  | 'briefing'
  | 'flying'
  | 'complete'
  | 'cancelled'

export type BookingType = 
  | 'flight'
  | 'groundwork'
  | 'maintenance'
  | 'other'

export interface Booking {
  id: string
  aircraft_id: string
  user_id: string | null
  flight_type_id: string | null
  start_time: string // ISO timestamp
  end_time: string // ISO timestamp
  status: BookingStatus
  booking_type: BookingType
  notes: string | null
  created_at: string
  updated_at: string
  instructor_id: string | null
  purpose: string
  remarks: string | null
  lesson_id: string | null
  cancellation_category_id: string | null
  cancellation_reason: string | null
  cancelled_by: string | null
  cancelled_notes: string | null
  cancelled_at: string | null
  voucher_number: string | null
  // Flight log fields (consolidated from flight_logs table)
  checked_out_aircraft_id: string | null
  checked_out_instructor_id: string | null
  eta: string | null // ISO timestamp
  hobbs_start: number | null
  hobbs_end: number | null
  tach_start: number | null
  tach_end: number | null
  airswitch_start: number | null
  airswitch_end: number | null
  flight_time_hobbs: number | null
  flight_time_tach: number | null
  flight_time_airswitch: number | null
  flight_time: number | null
  fuel_on_board: number | null
  passengers: string | null
  route: string | null
  equipment: Record<string, unknown> | null // JSONB
  briefing_completed: boolean | null
  authorization_completed: boolean | null
  flight_remarks: string | null
  solo_end_hobbs: number | null
  solo_end_tach: number | null
  dual_time: number | null
  solo_time: number | null
  total_hours_start: number | null
  total_hours_end: number | null

  // Aircraft TTIS delta tracking (authoritative, server-side only)
  applied_aircraft_delta: number | null
  applied_total_time_method: string | null
  correction_delta: number | null
  corrected_at: string | null // ISO timestamp
  corrected_by: string | null
  correction_reason: string | null

  // Check-in billing/audit fields (financially critical)
  billing_basis: 'hobbs' | 'tacho' | 'airswitch' | null
  billing_hours: number | null
  checkin_invoice_id: string | null
  checkin_approved_at: string | null // ISO timestamp
  checkin_approved_by: string | null
}

// Extended booking with joined data
export interface BookingWithRelations extends Booking {
  aircraft?: {
    id: string
    registration: string
    type: string
    model: string
    manufacturer: string | null
    record_hobbs?: boolean
    record_tacho?: boolean
    record_airswitch?: boolean
  } | null
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
    user?: {
      id: string
      email: string
    } | null
  } | null
  flight_type?: {
    id: string
    name: string
    instruction_type?: 'trial' | 'dual' | 'solo' | null
  } | null
  lesson?: {
    id: string
    name: string
    description: string | null
  } | null
  checked_out_aircraft?: {
    id: string
    registration: string
    type: string
    model: string | null
    manufacturer: string | null
    record_hobbs?: boolean
    record_tacho?: boolean
    record_airswitch?: boolean
  } | null
  checked_out_instructor?: {
    id: string
    first_name: string | null
    last_name: string | null
    user_id: string | null
    user?: {
      id: string
      first_name: string | null
      last_name: string | null
      email: string
    } | null
  } | null
}

export interface BookingsFilter {
  status?: BookingStatus[]
  booking_type?: BookingType[]
  aircraft_id?: string
  instructor_id?: string
  user_id?: string
  search?: string // Search in aircraft, student, instructor names
  start_date?: string
  end_date?: string
}

export interface BookingsResponse {
  bookings: BookingWithRelations[]
  total: number
}
