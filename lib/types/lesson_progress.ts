import type { InstructorWithUser } from "./instructors"

export interface LessonProgress {
  id: string
  booking_id: string
  user_id: string
  instructor_id: string | null
  instructor_comments: string | null
  lesson_highlights: string | null
  areas_for_improvement: string | null
  airmanship: string | null
  focus_next_lesson: string | null
  safety_concerns: string | null
  weather_conditions: string | null
  status: 'pass' | 'not yet competent' | null
  attempt: number | null
  created_at?: string
  updated_at?: string
  date?: string // Often used in UI, derived from booking or created_at
}

export interface LessonProgressWithInstructor extends LessonProgress {
  instructor?: InstructorWithUser | null
}
