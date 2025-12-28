export interface ExperienceType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  voided_at?: string | null;
}

export interface ExperienceTypeFormData {
  name: string;
  description: string;
  is_active: boolean;
}

