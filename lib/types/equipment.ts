// Equipment types based on database schema

/**
 * Equipment status enum
 */
export type EquipmentStatus = 'active' | 'lost' | 'maintenance' | 'retired';

/**
 * Equipment type enum
 */
export type EquipmentType = 
  | 'AIP'
  | 'Stationery'
  | 'Headset'
  | 'Technology'
  | 'Maps'
  | 'Radio'
  | 'Transponder'
  | 'ELT'
  | 'Lifejacket'
  | 'FirstAidKit'
  | 'FireExtinguisher'
  | 'Other';

/**
 * Base equipment interface matching the equipment table
 */
export interface Equipment {
  id: string;
  name: string;
  label: string | null;
  type: EquipmentType;
  status: EquipmentStatus;
  serial_number: string | null;
  purchase_date: string | null;
  warranty_expiry: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  location: string | null;
  year_purchased: number | null;
  voided_at: string | null;
}

/**
 * Equipment issuance record
 */
export interface EquipmentIssuance {
  id: string;
  equipment_id: string;
  user_id: string;
  issued_at: string;
  returned_at: string | null;
  issued_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  expected_return: string | null;
}

/**
 * Equipment update/maintenance record
 */
export interface EquipmentUpdate {
  id: string;
  equipment_id: string;
  next_due_at: string | null;
  updated_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Equipment with related issuance information
 */
export interface EquipmentWithIssuance extends Equipment {
  current_issuance?: EquipmentIssuance | null;
  issued_to_user?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

/**
 * Filter options for equipment query
 */
export interface EquipmentFilter {
  search?: string; // Search in name, serial_number, type
  status?: EquipmentStatus;
  type?: EquipmentType;
  issued?: boolean; // Filter for issued equipment
}

/**
 * API response for equipment
 */
export interface EquipmentResponse {
  equipment: EquipmentWithIssuance[];
  total: number;
}

/**
 * Equipment type options for dropdowns
 */
export const EQUIPMENT_TYPE_OPTIONS: { value: EquipmentType; label: string }[] = [
  { value: 'Headset', label: 'Headset' },
  { value: 'Technology', label: 'Technology' },
  { value: 'AIP', label: 'AIP' },
  { value: 'Stationery', label: 'Stationery' },
  { value: 'Maps', label: 'Maps' },
  { value: 'Radio', label: 'Radio' },
  { value: 'Transponder', label: 'Transponder' },
  { value: 'ELT', label: 'ELT' },
  { value: 'Lifejacket', label: 'Lifejacket' },
  { value: 'FirstAidKit', label: 'First Aid Kit' },
  { value: 'FireExtinguisher', label: 'Fire Extinguisher' },
  { value: 'Other', label: 'Other' },
];

/**
 * Equipment status options for dropdowns
 */
export const EQUIPMENT_STATUS_OPTIONS: { value: EquipmentStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'lost', label: 'Lost' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
];

