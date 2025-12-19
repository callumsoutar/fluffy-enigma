// Invoice types based on database schema

export type InvoiceStatus = 
  | 'draft'
  | 'pending'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'refunded'

export interface Invoice {
  id: string
  invoice_number: string | null
  user_id: string
  status: InvoiceStatus
  issue_date: string // ISO timestamp
  due_date: string | null // ISO timestamp
  paid_date: string | null // ISO timestamp
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

// Extended invoice with joined data
export interface InvoiceWithRelations extends Invoice {
  user?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
  booking?: {
    id: string
    start_time: string
    end_time: string
    status: string
  } | null
}

export interface InvoicesFilter {
  status?: InvoiceStatus[]
  user_id?: string
  search?: string // Search in invoice_number, user name, reference
  start_date?: string // Filter by issue_date
  end_date?: string // Filter by issue_date
}

export interface InvoicesResponse {
  invoices: InvoiceWithRelations[]
  total: number
}
