import type { InstructorCategory } from "@/lib/types/instructor-categories"

/**
 * Instructor related types.
 *
 * Designed to mirror the Supabase instructors table joined with the
 * users table so the UI can render staff lists without additional joins.
 */
export interface InstructorUser {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  is_active: boolean
}

export type InstructorStatus = "active" | "inactive" | "deactivated" | "suspended"
export type EmploymentType = "full_time" | "part_time" | "casual" | "contractor"

export interface InstructorWithUser {
  id: string
  user_id: string
  status: InstructorStatus
  employment_type: EmploymentType | null
  hire_date: string | null
  termination_date: string | null
  is_actively_instructing: boolean
  rating: string | null
  rating_category: InstructorCategory | null
  instructor_check_due_date: string | null
  instrument_check_due_date: string | null
  class_1_medical_due_date: string | null
  notes: string | null
  night_removal: boolean | null
  aerobatics_removal: boolean | null
  multi_removal: boolean | null
  tawa_removal: boolean | null
  ifr_removal: boolean | null
  created_at: string
  updated_at: string
  user: InstructorUser
}

export interface InstructorsResponse {
  instructors: InstructorWithUser[]
  total: number
}

