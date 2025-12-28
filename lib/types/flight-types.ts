// Flight types based on database schema

export type InstructionType = 'trial' | 'dual' | 'solo'

export interface FlightType {
  id: string
  name: string
  description: string | null
  instruction_type: InstructionType | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FlightTypeFormData {
  name: string
  description: string
  instruction_type: InstructionType | null
  is_active: boolean
}

