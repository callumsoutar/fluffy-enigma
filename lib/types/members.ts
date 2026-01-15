// Member and person types based on database schema

/**
 * Person type classification
 * Members: Users with valid (non-expired) memberships
 * Instructors: Users with instructor records
 * Staff: Users with admin/owner roles (or could be separate staff table)
 * Contacts: Users without valid memberships or instructor records
 */
export type PersonType = 'member' | 'instructor' | 'staff' | 'contact' | 'all'

/**
 * Membership status
 */
export type MembershipStatus = 'active' | 'expired' | 'inactive' | 'all'

/**
 * Base user interface matching the users table
 */
export interface User {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  date_of_birth: string | null // ISO date string
  gender: string | null
  street_address: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  next_of_kin_name: string | null
  next_of_kin_phone: string | null
  emergency_contact_relationship: string | null
  medical_certificate_expiry: string | null // ISO date string
  pilot_license_number: string | null
  pilot_license_type: string | null
  pilot_license_expiry: string | null // ISO date string
  is_active: boolean
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
  date_of_last_flight: string | null // ISO timestamp
  company_name: string | null
  occupation: string | null
  employer: string | null
  notes: string | null
  pilot_license_id: string | null
  public_directory_opt_in: boolean
  class_1_medical_due: string | null // ISO date string
  class_2_medical_due: string | null // ISO date string
  DL9_due: string | null // ISO date string
  BFR_due: string | null // ISO date string
}

/**
 * Membership information
 */
export interface Membership {
  id: string
  user_id: string
  membership_type_id: string
  start_date: string // ISO timestamp
  end_date: string | null // ISO timestamp
  expiry_date: string // ISO date string
  purchased_date: string // ISO timestamp
  is_active: boolean
  auto_renew: boolean
  grace_period_days: number
  notes: string | null
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
  updated_by: string | null
  invoice_id: string | null
}

/**
 * Membership type information
 */
export interface MembershipType {
  id: string
  name: string
  code: string
  description: string | null
  duration_months: number
  is_active: boolean
  benefits: Record<string, unknown> | null
  created_at: string
  updated_at: string
  chargeable_id: string | null
}

/**
 * Instructor information
 */
export interface Instructor {
  id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  status: string
  employment_type: string | null
  hire_date: string | null // ISO timestamp
  termination_date: string | null // ISO timestamp
  is_actively_instructing: boolean
  created_at: string
  updated_at: string
}

/**
 * User with relations (membership, instructor, role info)
 */
export interface MemberWithRelations extends User {
  // Auth status info
  is_auth_user?: boolean
  auth_user_confirmed_at?: string | null

  // Membership info (if member)
  membership?: {
    id: string
    membership_type: {
      id: string
      name: string
      code: string
    }
    start_date: string
    end_date: string | null
    expiry_date: string
    is_active: boolean
    auto_renew: boolean
  } | null
  
  // Instructor info (if instructor)
  instructor?: {
    id: string
    status: string
    is_actively_instructing: boolean
    employment_type: string | null
  } | null
  
  // Role info
  role?: {
    role: string
  } | null
}

/**
 * Filter options for members query
 */
export interface MembersFilter {
  person_type?: PersonType
  membership_status?: MembershipStatus
  search?: string // Search in name, email, phone
  is_active?: boolean
  membership_type_id?: string
}

/**
 * API response for members
 */
export interface MembersResponse {
  members: MemberWithRelations[]
  total: number
}
