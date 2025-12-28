export interface Exam {
  id: string;
  name: string;
  description: string | null;
  syllabus_id: string | null;
  passing_score: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  voided_at?: string | null;
}

export interface ExamFormData {
  name: string;
  description: string;
  syllabus_id: string;
  passing_score: number;
  is_active: boolean;
}

