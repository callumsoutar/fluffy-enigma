export interface Syllabus {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  number_of_exams: number;
  created_at?: string;
  updated_at?: string;
  voided_at?: string | null;
}

export interface SyllabusFormData {
  name: string;
  description: string;
  number_of_exams: number;
  is_active: boolean;
}

