export interface MemberFlightHistoryEntry {
  id: string
  user_id: string | null
  start_time: string
  end_time: string
  status: 'complete' | string
  purpose: string
  flight_time: number | null
  aircraft?: {
    id: string
    registration: string | null
  } | null
  instructor?: {
    id: string
    first_name: string | null
    last_name: string | null
  } | null
  flight_type?: {
    id: string
    name: string
  } | null
  lesson?: {
    id: string
    name: string
  } | null
}

export interface MemberFlightHistoryResponse {
  flights: MemberFlightHistoryEntry[]
  total: number
}


