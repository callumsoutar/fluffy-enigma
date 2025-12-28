export type SyllabusStage = 
  | 'basic syllabus'
  | 'advances syllabus'
  | 'circuit training'
  | 'terrain and weather awareness'
  | 'instrument flying and flight test revision';

export interface Lesson {
  id: string;
  syllabus_id: string;
  name: string;
  description: string | null;
  order: number;
  is_active: boolean;
  is_required: boolean;
  syllabus_stage: SyllabusStage | null;
  created_at: string;
  updated_at: string;
}

export interface LessonInsert {
  syllabus_id: string;
  name: string;
  description?: string | null;
  order?: number;
  is_active?: boolean;
  is_required?: boolean;
  syllabus_stage?: SyllabusStage | null;
}

export interface LessonUpdate {
  name?: string;
  description?: string | null;
  order?: number;
  is_active?: boolean;
  is_required?: boolean;
  syllabus_stage?: SyllabusStage | null;
}

