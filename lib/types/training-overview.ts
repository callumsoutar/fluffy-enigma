// Training overview types (club-wide instructor command centre)

export type TrainingActivityStatus = "active" | "at_risk" | "stale" | "new"

export type TrainingOverviewView = "at_risk" | "active" | "stale" | "all"

export interface TrainingOverviewStudent {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  is_active?: boolean
}

export interface TrainingOverviewSyllabus {
  id: string
  name: string
}

export interface TrainingProgressSummary {
  completed: number
  total: number
  percent: number | null
}

export interface TrainingOverviewRow {
  enrollment_id: string
  user_id: string
  syllabus_id: string
  enrolled_at: string
  status: string
  student: TrainingOverviewStudent
  syllabus: TrainingOverviewSyllabus
  last_flight_at: string | null
  activity_status: TrainingActivityStatus
  days_since_last_flight: number | null
  days_since_enrolled: number
  progress: TrainingProgressSummary
}

export interface TrainingOverviewSyllabusStats {
  syllabus: TrainingOverviewSyllabus
  total: number
  active: number
  at_risk: number
  stale: number
  never_flown: number
}

export interface TrainingOverviewStats {
  total_enrollments: number
  active: number
  at_risk: number
  stale: number
  never_flown: number
  by_syllabus: TrainingOverviewSyllabusStats[]
}

export interface TrainingOverviewResponse {
  rows: TrainingOverviewRow[]
  stats: TrainingOverviewStats
  syllabi: TrainingOverviewSyllabus[]
  generated_at: string
}


