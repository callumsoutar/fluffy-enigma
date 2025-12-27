/**
 * Database types generated from Supabase
 * This file contains TypeScript types for all database tables
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      licenses: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      endorsements: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          voided_at?: string | null
        }
      }
      users_endorsements: {
        Row: {
          id: string
          user_id: string
          endorsement_id: string
          issued_date: string
          expiry_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          endorsement_id: string
          issued_date?: string
          expiry_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          endorsement_id?: string
          issued_date?: string
          expiry_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          voided_at?: string | null
        }
      }
      memberships: {
        Row: {
          id: string
          user_id: string
          membership_type_id: string
          start_date: string
          end_date: string | null
          expiry_date: string
          purchased_date: string
          is_active: boolean
          auto_renew: boolean
          grace_period_days: number
          notes: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
          invoice_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          membership_type_id: string
          start_date?: string
          end_date?: string | null
          expiry_date: string
          purchased_date?: string
          is_active?: boolean
          auto_renew?: boolean
          grace_period_days?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          invoice_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          membership_type_id?: string
          start_date?: string
          end_date?: string | null
          expiry_date?: string
          purchased_date?: string
          is_active?: boolean
          auto_renew?: boolean
          grace_period_days?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          invoice_id?: string | null
        }
      }
      membership_types: {
        Row: {
          id: string
          name: string
          code: string
          description: string | null
          duration_months: number
          is_active: boolean
          benefits: Json | null
          created_at: string
          updated_at: string
          chargeable_id: string | null
        }
        Insert: {
          id?: string
          name: string
          code: string
          description?: string | null
          duration_months?: number
          is_active?: boolean
          benefits?: Json | null
          created_at?: string
          updated_at?: string
          chargeable_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          code?: string
          description?: string | null
          duration_months?: number
          is_active?: boolean
          benefits?: Json | null
          created_at?: string
          updated_at?: string
          chargeable_id?: string | null
        }
      }
      chargeables: {
        Row: {
          id: string
          name: string
          description: string | null
          rate: number | null
          is_active: boolean
          is_taxable: boolean | null
          created_at: string
          updated_at: string
          voided_at: string | null
          chargeable_type_id: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          rate?: number | null
          is_active?: boolean
          is_taxable?: boolean | null
          created_at?: string
          updated_at?: string
          voided_at?: string | null
          chargeable_type_id: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          rate?: number | null
          is_active?: boolean
          is_taxable?: boolean | null
          created_at?: string
          updated_at?: string
          voided_at?: string | null
          chargeable_type_id?: string
        }
      }
      invoices: {
        Row: {
          id: string
          invoice_number: string | null
          user_id: string
          status: string
          issue_date: string
          due_date: string | null
          paid_date: string | null
          subtotal: number | null
          tax_total: number | null
          total_amount: number | null
          total_paid: number | null
          balance_due: number | null
          notes: string | null
          created_at: string
          updated_at: string
          booking_id: string | null
          reference: string | null
          payment_method: string | null
          payment_reference: string | null
          tax_rate: number
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
        }
        Insert: {
          id?: string
          invoice_number?: string | null
          user_id: string
          status?: string
          issue_date?: string
          due_date?: string | null
          paid_date?: string | null
          subtotal?: number | null
          tax_total?: number | null
          total_amount?: number | null
          total_paid?: number | null
          balance_due?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          booking_id?: string | null
          reference?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          tax_rate?: number
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
        }
        Update: {
          id?: string
          invoice_number?: string | null
          user_id?: string
          status?: string
          issue_date?: string
          due_date?: string | null
          paid_date?: string | null
          subtotal?: number | null
          tax_total?: number | null
          total_amount?: number | null
          total_paid?: number | null
          balance_due?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          booking_id?: string | null
          reference?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          tax_rate?: number
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
        }
      }
      users: {
        Row: {
          id: string
          email: string
          first_name: string | null
          last_name: string | null
          phone: string | null
          date_of_birth: string | null
          gender: string | null
          street_address: string | null
          city: string | null
          state: string | null
          postal_code: string | null
          country: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          emergency_contact_relationship: string | null
          medical_certificate_expiry: string | null
          pilot_license_number: string | null
          pilot_license_type: string | null
          pilot_license_id: string | null
          pilot_license_expiry: string | null
          is_active: boolean
          created_at: string
          updated_at: string
          date_of_last_flight: string | null
          company_name: string | null
          occupation: string | null
          employer: string | null
          notes: string | null
          public_directory_opt_in: boolean
          class_1_medical_due: string | null
          class_2_medical_due: string | null
          DL9_due: string | null
          BFR_due: string | null
        }
        Insert: {
          id?: string
          email: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          date_of_birth?: string | null
          gender?: string | null
          street_address?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          country?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          emergency_contact_relationship?: string | null
          medical_certificate_expiry?: string | null
          pilot_license_number?: string | null
          pilot_license_type?: string | null
          pilot_license_id?: string | null
          pilot_license_expiry?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          date_of_last_flight?: string | null
          company_name?: string | null
          occupation?: string | null
          employer?: string | null
          notes?: string | null
          public_directory_opt_in?: boolean
          class_1_medical_due?: string | null
          class_2_medical_due?: string | null
          DL9_due?: string | null
          BFR_due?: string | null
        }
        Update: {
          id?: string
          email?: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          date_of_birth?: string | null
          gender?: string | null
          street_address?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          country?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          emergency_contact_relationship?: string | null
          medical_certificate_expiry?: string | null
          pilot_license_number?: string | null
          pilot_license_type?: string | null
          pilot_license_id?: string | null
          pilot_license_expiry?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
          date_of_last_flight?: string | null
          company_name?: string | null
          occupation?: string | null
          employer?: string | null
          notes?: string | null
          public_directory_opt_in?: boolean
          class_1_medical_due?: string | null
          class_2_medical_due?: string | null
          DL9_due?: string | null
          BFR_due?: string | null
        }
      }
      exam: {
        Row: {
          id: string
          name: string
          description: string | null
          passing_score: number
          is_active: boolean
          syllabus_id: string | null
          created_at: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          passing_score: number
          is_active?: boolean
          syllabus_id?: string | null
          created_at?: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          passing_score?: number
          is_active?: boolean
          syllabus_id?: string | null
          created_at?: string
          updated_at?: string
          voided_at?: string | null
        }
      }
      exam_results: {
        Row: {
          id: string
          exam_id: string
          user_id: string
          score: number
          result: Database["public"]["Enums"]["exam_result"]
          exam_date: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          exam_id: string
          user_id: string
          score: number
          result: Database["public"]["Enums"]["exam_result"]
          exam_date?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          exam_id?: string
          user_id?: string
          score?: number
          result?: Database["public"]["Enums"]["exam_result"]
          exam_date?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      syllabus: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          number_of_exams: number
          created_at: string
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
          number_of_exams?: number
          created_at?: string
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          number_of_exams?: number
          created_at?: string
          updated_at?: string
          voided_at?: string | null
        }
      }
      student_syllabus_enrollment: {
        Row: {
          id: string
          user_id: string
          syllabus_id: string
          enrolled_at: string
          completion_date: string | null
          status: string
          notes: string | null
          primary_instructor_id: string | null
          aircraft_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          syllabus_id: string
          enrolled_at?: string
          completion_date?: string | null
          status?: string
          notes?: string | null
          primary_instructor_id?: string | null
          aircraft_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          syllabus_id?: string
          enrolled_at?: string
          completion_date?: string | null
          status?: string
          notes?: string | null
          primary_instructor_id?: string | null
          aircraft_type?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      gender_enum: "male" | "female"
      exam_result: "PASS" | "FAIL"
    }
  }
}

// Helper types
export type License = Database["public"]["Tables"]["licenses"]["Row"]
export type LicenseInsert = Database["public"]["Tables"]["licenses"]["Insert"]
export type LicenseUpdate = Database["public"]["Tables"]["licenses"]["Update"]

export type Endorsement = Database["public"]["Tables"]["endorsements"]["Row"]
export type EndorsementInsert = Database["public"]["Tables"]["endorsements"]["Insert"]
export type EndorsementUpdate = Database["public"]["Tables"]["endorsements"]["Update"]

export type UserEndorsement = Database["public"]["Tables"]["users_endorsements"]["Row"]
export type UserEndorsementInsert = Database["public"]["Tables"]["users_endorsements"]["Insert"]
export type UserEndorsementUpdate = Database["public"]["Tables"]["users_endorsements"]["Update"]

export type Membership = Database["public"]["Tables"]["memberships"]["Row"]
export type MembershipInsert = Database["public"]["Tables"]["memberships"]["Insert"]
export type MembershipUpdate = Database["public"]["Tables"]["memberships"]["Update"]

export type MembershipType = Database["public"]["Tables"]["membership_types"]["Row"]
export type MembershipTypeInsert = Database["public"]["Tables"]["membership_types"]["Insert"]
export type MembershipTypeUpdate = Database["public"]["Tables"]["membership_types"]["Update"]

export type Chargeable = Database["public"]["Tables"]["chargeables"]["Row"]
export type ChargeableInsert = Database["public"]["Tables"]["chargeables"]["Insert"]
export type ChargeableUpdate = Database["public"]["Tables"]["chargeables"]["Update"]

export type Invoice = Database["public"]["Tables"]["invoices"]["Row"]
export type InvoiceInsert = Database["public"]["Tables"]["invoices"]["Insert"]
export type InvoiceUpdate = Database["public"]["Tables"]["invoices"]["Update"]

export type User = Database["public"]["Tables"]["users"]["Row"]
export type UserInsert = Database["public"]["Tables"]["users"]["Insert"]
export type UserUpdate = Database["public"]["Tables"]["users"]["Update"]

export type Exam = Database["public"]["Tables"]["exam"]["Row"]
export type ExamInsert = Database["public"]["Tables"]["exam"]["Insert"]
export type ExamUpdate = Database["public"]["Tables"]["exam"]["Update"]

export type ExamResult = Database["public"]["Tables"]["exam_results"]["Row"]
export type ExamResultInsert = Database["public"]["Tables"]["exam_results"]["Insert"]
export type ExamResultUpdate = Database["public"]["Tables"]["exam_results"]["Update"]

export type Syllabus = Database["public"]["Tables"]["syllabus"]["Row"]
export type SyllabusInsert = Database["public"]["Tables"]["syllabus"]["Insert"]
export type SyllabusUpdate = Database["public"]["Tables"]["syllabus"]["Update"]

export type StudentSyllabusEnrollment =
  Database["public"]["Tables"]["student_syllabus_enrollment"]["Row"]
export type StudentSyllabusEnrollmentInsert =
  Database["public"]["Tables"]["student_syllabus_enrollment"]["Insert"]
export type StudentSyllabusEnrollmentUpdate =
  Database["public"]["Tables"]["student_syllabus_enrollment"]["Update"]
