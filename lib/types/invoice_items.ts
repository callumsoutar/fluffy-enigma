// Invoice item types based on database schema

export interface InvoiceItem {
  id: string
  invoice_id: string
  chargeable_id: string | null
  description: string
  quantity: number
  unit_price: number
  amount: number
  tax_rate: number | null
  tax_amount: number | null
  rate_inclusive: number | null
  line_total: number | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  deleted_by: string | null
}

// Extended invoice item with joined chargeable data
export interface InvoiceItemWithRelations extends InvoiceItem {
  chargeable?: {
    id: string
    name: string
    description: string | null
    rate: number | null
    is_taxable: boolean | null
  } | null
}
