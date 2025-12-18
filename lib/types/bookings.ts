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
  authorization_override: boolean | null
  authorization_override_by: string | null
  authorization_override_at: string | null
  authorization_override_reason: string | null
  cancellation_category_id: string | null
  cancellation_reason: string | null
  cancelled_by: string | null
  cancelled_notes: string | null
  cancelled_at: string | null
  voucher_number: string | null
}

// Extended booking with joined data
export interface BookingWithRelations extends Booking {
  aircraft?: {
    id: string
    registration: string
    type: string
    model: string
    manufacturer: string | null
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
